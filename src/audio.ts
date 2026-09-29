export interface VoiceFeatures {
  /** Overall loudness, 0..1, with a fast attack and a softer release. */
  level: number;
  /** Energy in low / mid / high bands, 0..1. */
  low: number;
  mid: number;
  high: number;
}

type AudioContextCtor = typeof AudioContext;

const BANDS: Array<[keyof Omit<VoiceFeatures, 'level'>, number, number]> = [
  ['low', 80, 350],
  ['mid', 350, 2200],
  ['high', 2200, 7500],
];

// createMediaElementSource() may be called only once per element and context.
const elementSources = new WeakMap<HTMLMediaElement, { ctx: AudioContext; node: MediaElementAudioSourceNode }>();

/**
 * Turns an audio source (microphone, any MediaStream or <audio>/<video> element)
 * into smooth loudness + band values for the sphere.
 */
export class VoiceAnalyser {
  sensitivity = 1;

  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: AudioNode | null = null;
  private ownedStream: MediaStream | null = null;
  private timeData = new Float32Array(0);
  private freqData = new Float32Array(0);
  private noiseFloor = -70;
  private capturedElement = false;
  private out: VoiceFeatures = { level: 0, low: 0, mid: 0, high: 0 };

  get connected(): boolean {
    return !!this.source;
  }

  /** Asks for the microphone and starts analysing it. */
  async useMicrophone(): Promise<MediaStream> {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw Object.assign(new Error('Microphone requires a secure context (https or localhost).'), {
        name: 'InsecureContextError',
      });
    }
    // Create/resume the context synchronously inside the user gesture, before awaiting.
    this.context();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    this.useStream(stream, true);
    return stream;
  }

  /** Analyse an arbitrary stream (WebRTC, screen capture, etc.). */
  useStream(stream: MediaStream, owned = false): void {
    this.detach();
    const ctx = this.context();
    this.source = ctx.createMediaStreamSource(stream);
    this.source.connect(this.analyserNode());
    if (owned) this.ownedStream = stream;
  }

  /** Analyse what an <audio>/<video> element is playing (e.g. TTS). Playback stays audible. */
  useElement(el: HTMLMediaElement): void {
    this.detach();
    const ctx = this.context();
    let entry = elementSources.get(el);
    if (!entry || entry.ctx !== ctx) {
      entry = { ctx, node: ctx.createMediaElementSource(el) };
      elementSources.set(el, entry);
      // Playback is usually started by a click, which lets a suspended context run.
      el.addEventListener('play', () => void (ctx.state === 'suspended' && ctx.resume().catch(() => {})));
    }
    entry.node.connect(ctx.destination);
    entry.node.connect(this.analyserNode());
    this.source = entry.node;
    this.capturedElement = true;
  }

  detach(): void {
    if (this.source) {
      try {
        this.source.disconnect();
        // Keep element audio audible after we stop listening to it.
        if (this.source instanceof MediaElementAudioSourceNode && this.ctx) this.source.connect(this.ctx.destination);
      } catch {
        /* already disconnected */
      }
    }
    this.source = null;
    this.ownedStream?.getTracks().forEach((t) => t.stop());
    this.ownedStream = null;
  }

  /** Browsers suspend audio until a user gesture; call from any click. */
  resume(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume().catch(() => {});
  }

  /** Pause audio processing (resumed automatically on the next use). */
  suspend(): void {
    // A captured <audio>/<video> plays through this context, so it must keep running.
    if (this.capturedElement) return;
    if (this.ctx?.state === 'running') void this.ctx.suspend().catch(() => {});
  }

  /** Reads the current features. `dt` in seconds. */
  read(dt: number): VoiceFeatures {
    const out = this.out;
    const a = this.analyser;
    if (!a || !this.source || this.ctx?.state !== 'running') {
      const k = 1 - Math.exp(-dt / 0.25);
      out.level -= out.level * k;
      out.low -= out.low * k;
      out.mid -= out.mid * k;
      out.high -= out.high * k;
      return out;
    }

    // Loudness (RMS in dBFS) mapped against an adaptive noise floor.
    a.getFloatTimeDomainData(this.timeData);
    let sum = 0;
    for (let i = 0; i < this.timeData.length; i++) sum += this.timeData[i] * this.timeData[i];
    const db = 10 * Math.log10(sum / this.timeData.length + 1e-12);

    if (db < this.noiseFloor) this.noiseFloor += (db - this.noiseFloor) * (1 - Math.exp(-dt / 0.4));
    else this.noiseFloor += dt * 2.5; // creeps up 2.5 dB/s while it is loud
    this.noiseFloor = Math.min(-30, Math.max(-95, this.noiseFloor));

    const gain = 20 * Math.log10(Math.max(0.05, this.sensitivity));
    const lower = Math.max(-58, this.noiseFloor + 8) - gain;
    const target = clamp01((db - lower) / 34);
    follow(out, 'level', Math.pow(target, 0.9), dt, 0.035, 0.2);

    // Bands.
    a.getFloatFrequencyData(this.freqData);
    const binHz = (this.ctx.sampleRate / 2) / this.freqData.length;
    const gate = smoothstep(0.02, 0.18, out.level);
    for (const [name, from, to] of BANDS) {
      const i0 = Math.max(1, Math.floor(from / binHz));
      const i1 = Math.min(this.freqData.length - 1, Math.ceil(to / binHz));
      let p = 0;
      for (let i = i0; i <= i1; i++) p += Math.pow(10, this.freqData[i] / 10);
      const bandDb = 10 * Math.log10(p / Math.max(1, i1 - i0 + 1) + 1e-12);
      follow(out, name, clamp01((bandDb + 95 + gain) / 55) * gate, dt, 0.05, 0.25);
    }
    return out;
  }

  private context(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const Ctor: AudioContextCtor =
        window.AudioContext || (window as unknown as { webkitAudioContext: AudioContextCtor }).webkitAudioContext;
      this.ctx = new Ctor();
      this.analyser = null;
    }
    this.resume();
    return this.ctx;
  }

  private analyserNode(): AnalyserNode {
    if (!this.analyser) {
      const a = this.context().createAnalyser();
      a.fftSize = 1024;
      a.smoothingTimeConstant = 0.5;
      this.analyser = a;
      this.timeData = new Float32Array(a.fftSize);
      this.freqData = new Float32Array(a.frequencyBinCount);
    }
    return this.analyser;
  }
}

/** Envelope follower: fast rise (`attack` s), slower fall (`release` s). */
function follow(obj: VoiceFeatures, key: keyof VoiceFeatures, target: number, dt: number, attack: number, release: number): void {
  const cur = obj[key];
  const tau = target > cur ? attack : release;
  obj[key] = cur + (target - cur) * (1 - Math.exp(-dt / tau));
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(a: number, b: number, v: number): number {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}
