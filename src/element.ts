import { VoiceAnalyser, type VoiceFeatures } from './audio';
import { CaptionView } from './captions';
import { COLOR_ROLES, resolveColors, toHex, type ColorRole, type RGB, type SphereColors } from './colors';
import { message, type MessageKey } from './i18n';
import { rotationMatrix, SphereRenderer } from './renderer';
import { SpeechSimulator } from './simulator';
import { SpeechTranscriber } from './speech';
import { STYLES } from './styles';

export type SphereQuality = 'auto' | 'low' | 'medium' | 'high';
/** What currently drives the animation. */
export type SphereSource = 'none' | 'microphone' | 'stream' | 'element' | 'simulation' | 'manual';

export interface TranscriptDetail {
  /** Whole current phrase: settled text + live hypothesis. */
  text: string;
  /** Text that has just been finalised (may be empty). */
  final: string;
  /** Live hypothesis that may still change. */
  interim: string;
  /** True when the phrase has no pending hypothesis. */
  isFinal: boolean;
}

/** The canvas (stage) is larger than the sphere: room for the voice pulse. */
const CANVAS_SCALE = 1.3;
const DPR_CAP: Record<Exclude<SphereQuality, 'auto'>, number> = { low: 1, medium: 1.5, high: 2 };
const DOWNGRADE: Record<Exclude<SphereQuality, 'auto'>, Exclude<SphereQuality, 'auto'>> = {
  high: 'medium',
  medium: 'low',
  low: 'low',
};

const COLOR_ATTRS: Record<string, ColorRole> = {
  'color-deep': 'deep',
  'color-body': 'body',
  'color-glow': 'glow',
  'color-accent': 'accent',
  'color-rim': 'rim',
};

const OBSERVED = [
  'preset', ...Object.keys(COLOR_ATTRS), 'size', 'lang', 'text', 'listening-text', 'captions',
  'caption-lines', 'caption-hold', 'sensitivity', 'speed', 'quality', 'interactive', 'simulate',
];

const TEMPLATE = `
<style>${STYLES}</style>
<div class="root" part="root">
  <div class="stage" part="stage">
    <div class="glow" part="glow" aria-hidden="true"></div>
    <canvas part="canvas" aria-hidden="true"></canvas>
    <div class="fallback" part="fallback" hidden></div>
    <button type="button" part="button" aria-pressed="false"></button>
  </div>
  <div class="caption" part="caption"><span class="line"></span></div>
  <div class="sr" role="status" aria-live="polite"></div>
</div>`;

/**
 * `<speak-louder-sphere>` — a glowing glass sphere that reacts to the voice
 * and shows live captions of what is being said.
 */
export class SpeakLouderSphereElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return OBSERVED;
  }

  private readonly rootEl: HTMLDivElement;
  private readonly stage: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private readonly fallback: HTMLDivElement;
  private readonly glow: HTMLDivElement;
  private readonly button: HTMLButtonElement;
  private readonly captionBox: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private readonly captions: CaptionView;

  private renderer: SphereRenderer | null = null;
  private canvasUsed = false;
  private quality: Exclude<SphereQuality, 'auto'> = 'high';
  private readonly analyser = new VoiceAnalyser();
  private transcriber: SpeechTranscriber | null = null;
  private simulator: SpeechSimulator | null = null;
  private src: SphereSource = 'none';
  private manualLevel = 0;
  private starting = false;

  private colorOverrides: Partial<SphereColors> = {};
  private rgb: Record<ColorRole, RGB> = resolveColors(null);

  // Animation state.
  private raf = 0;
  private last = 0;
  private lastDraw = 0;
  private time = Math.random() * 100;
  private onScreen = true;
  private features: VoiceFeatures = { level: 0, low: 0, mid: 0, high: 0 };
  private listen = 0;
  private hover = 0;
  private hovering = false;
  private pressed = false;
  private pulse = 0;
  private pulseV = 0;
  private glowLevel = 0;
  private glowShown = -1;
  private perfTime = 0;
  private perfSlow = 0;
  private readonly matrix = new Float32Array(9);
  private readonly reducedMotion =
    typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private hostWidth = -1;
  private refitRaf = 0;

  // Caption state.
  private phrase = '';
  private interim = '';
  private override: string | null = null;
  private notice: { text: string; kind: 'hint' | 'error' } | null = null;
  private holdTimer = 0;
  private noticeTimer = 0;
  private fadeTimer = 0;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = TEMPLATE;
    const $ = <T extends Element>(sel: string) => shadow.querySelector(sel) as T;
    this.rootEl = $('.root');
    this.stage = $('.stage');
    this.canvas = $('canvas');
    this.fallback = $('.fallback');
    this.glow = $('.glow');
    this.button = $('button');
    this.captionBox = $('.caption');
    this.status = $('.sr');
    this.captions = new CaptionView(this.captionBox, $('.line'));

    this.button.addEventListener('click', () => {
      this.analyser.resume();
      if (this.interactive) void this.toggle();
    });
    this.button.addEventListener('pointerenter', () => (this.hovering = true));
    this.button.addEventListener('pointerleave', () => {
      this.hovering = false;
      this.pressed = false;
    });
    this.button.addEventListener('pointerdown', () => (this.pressed = this.interactive));
    this.button.addEventListener('pointerup', () => (this.pressed = false));
    this.button.addEventListener('pointercancel', () => (this.pressed = false));
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** True while the microphone is on. */
  get listening(): boolean {
    return this.src === 'microphone';
  }

  /** What drives the sphere right now. */
  get source(): SphereSource {
    return this.src;
  }

  /** Current smoothed loudness 0..1. */
  get level(): number {
    return this.features.level;
  }

  /** Resolved colours as hex strings. */
  get colors(): SphereColors {
    const out = {} as SphereColors;
    for (const role of COLOR_ROLES) out[role] = toHex(this.rgb[role]);
    return out;
  }

  set colors(value: Partial<SphereColors>) {
    this.setColors(value);
  }

  /** Overrides some colours; pass `null` to go back to the preset/attributes. */
  setColors(colors: Partial<SphereColors> | null): void {
    this.colorOverrides = colors ? { ...this.colorOverrides, ...colors } : {};
    this.applyColors();
  }

  /** Turns the microphone (and live captions) on. Resolves to false if it failed. */
  async start(): Promise<boolean> {
    if (this.src === 'microphone') return true;
    if (this.starting) return false;
    this.starting = true;
    this.analyser.sensitivity = this.sensitivity;
    try {
      await this.analyser.useMicrophone();
      if (!this.isConnected) {
        this.analyser.detach();
        return false;
      }
      this.simulator = null;
      this.setSource('microphone');
      this.startTranscriber();
      return true;
    } catch (err) {
      this.onMicError(err);
      return false;
    } finally {
      this.starting = false;
    }
  }

  /** Turns the microphone / any audio source off. */
  stop(): void {
    this.transcriber?.stop();
    this.analyser.detach();
    this.simulator = null;
    this.setSource('none');
    if (this.flag('simulate')) this.simulate(true);
  }

  async toggle(): Promise<boolean> {
    if (this.listening) {
      this.stop();
      return false;
    }
    return this.start();
  }

  /** Drive the sphere from any MediaStream (e.g. a remote WebRTC voice). */
  connectStream(stream: MediaStream): void {
    this.transcriber?.stop();
    this.simulator = null;
    this.analyser.sensitivity = this.sensitivity;
    this.analyser.useStream(stream);
    this.setSource('stream');
  }

  /** Drive the sphere from an <audio>/<video> element (e.g. text-to-speech playback). */
  connectMediaElement(el: HTMLMediaElement): void {
    this.transcriber?.stop();
    this.simulator = null;
    this.analyser.sensitivity = this.sensitivity;
    this.analyser.useElement(el);
    this.setSource('element');
  }

  /** Fake speech for previews. */
  simulate(on = true): void {
    if (on) {
      if (this.src === 'microphone' || this.src === 'simulation') return;
      this.analyser.detach();
      this.simulator = new SpeechSimulator();
      this.setSource('simulation');
    } else if (this.src === 'simulation') {
      this.simulator = null;
      this.setSource('none');
    }
  }

  /** Drive the sphere manually with your own loudness value 0..1. */
  setLevel(level: number): void {
    if (this.src !== 'manual') {
      this.transcriber?.stop();
      this.analyser.detach();
      this.simulator = null;
      this.setSource('manual');
    }
    this.manualLevel = Math.min(1, Math.max(0, Number(level) || 0));
  }

  /** Show your own text under the sphere (e.g. the assistant's reply). `null` clears it. */
  setCaption(text: string | null): void {
    this.override = text;
    this.phrase = '';
    this.interim = '';
    clearTimeout(this.holdTimer);
    this.swapCaption();
  }

  clearCaption(): void {
    this.setCaption(null);
  }

  /**
   * Feed a transcript into the captions — used internally for the Web Speech API,
   * and handy for plugging in your own speech-to-text (Whisper, Deepgram, …).
   */
  pushTranscript(update: { final?: string; interim?: string }): void {
    const fin = (update.final ?? '').trim();
    const interim = (update.interim ?? '').trim();
    if (!fin && !interim && !this.interim) return;

    this.override = null;
    clearTimeout(this.fadeTimer);
    this.captionBox.classList.remove('fading');
    if (fin) this.phrase = (this.phrase + ' ' + fin).trim();
    this.interim = interim;
    if (!this.notice) this.captions.setTranscript(this.phrase, this.interim);

    const text = (this.phrase + ' ' + this.interim).trim();
    this.emit<TranscriptDetail>('sls-transcript', { text, final: fin, interim, isFinal: !interim });

    clearTimeout(this.holdTimer);
    const hold = this.interim ? Math.max(6000, this.captionHold * 2) : this.captionHold;
    this.holdTimer = window.setTimeout(() => {
      this.phrase = '';
      this.interim = '';
      this.swapCaption();
    }, hold);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  connectedCallback(): void {
    this.applyColors();
    this.applyLayout();
    this.setupRenderer();
    this.button.setAttribute('aria-label', message(this.speechLang, 'start'));

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === this.stage) this.resizeCanvas();
        else this.onHostResize(entry.contentRect.width);
      }
    });
    this.resizeObserver.observe(this.stage);
    this.resizeObserver.observe(this);
    this.intersectionObserver = new IntersectionObserver((entries) => {
      this.onScreen = entries.some((e) => e.isIntersecting);
      this.updateLoop();
    });
    this.intersectionObserver.observe(this);
    document.addEventListener('visibilitychange', this.updateLoop);

    if (this.flag('simulate')) this.simulate(true);
    this.refreshCaption();
    this.updateLoop();
  }

  disconnectedCallback(): void {
    this.transcriber?.stop();
    // Suspend rather than close: an <audio> element captured by this context can never move to another one.
    this.analyser.detach();
    this.analyser.suspend();
    this.simulator = null;
    this.src = 'none';
    this.removeAttribute('listening');
    this.stopLoop();
    this.resizeObserver?.disconnect();
    this.hostWidth = -1;
    cancelAnimationFrame(this.refitRaf);
    this.intersectionObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.updateLoop);
    this.renderer?.dispose();
    this.renderer = null;
    clearTimeout(this.holdTimer);
    clearTimeout(this.noticeTimer);
    clearTimeout(this.fadeTimer);
  }

  attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
    if (oldValue === value || !this.isConnected) return;
    if (name === 'preset' || name in COLOR_ATTRS) this.applyColors();
    else if (name === 'size' || name === 'caption-lines') this.applyLayout();
    else if (name === 'quality') {
      this.quality = this.pickQuality();
      this.resizeCanvas();
    } else if (name === 'sensitivity') this.analyser.sensitivity = this.sensitivity;
    else if (name === 'text' || name === 'listening-text') {
      if (!this.phrase && !this.interim && this.override === null) this.swapCaption();
    } else if (name === 'lang') {
      this.button.setAttribute('aria-label', message(this.speechLang, this.listening ? 'stop' : 'start'));
      if (this.transcriber?.active) {
        this.transcriber.stop();
        this.startTranscriber();
      }
    } else if (name === 'captions') {
      if (!this.captionsEnabled) this.transcriber?.stop();
      else if (this.listening) this.startTranscriber();
    } else if (name === 'simulate') {
      this.simulate(this.flag('simulate'));
    }
  }

  // ---------------------------------------------------------------------------
  // Attributes
  // ---------------------------------------------------------------------------

  /** Recognition language: own `lang`, then the nearest ancestor's, then the browser's. */
  private get speechLang(): string {
    return (
      this.getAttribute('lang') ||
      this.parentElement?.closest('[lang]')?.getAttribute('lang') ||
      navigator.language ||
      'ru-RU'
    );
  }

  private get interactive(): boolean {
    return this.getAttribute('interactive') !== 'false';
  }

  private get captionsEnabled(): boolean {
    const v = this.getAttribute('captions');
    return v !== 'false' && v !== 'off';
  }

  private get sensitivity(): number {
    return this.num('sensitivity', 1, 0.1, 5);
  }

  private get speed(): number {
    return this.num('speed', 1, 0, 5);
  }

  private get captionHold(): number {
    return this.num('caption-hold', 2600, 300, 60000);
  }

  private num(name: string, fallback: number, min: number, max: number): number {
    const raw = this.getAttribute(name);
    const v = raw === null || raw.trim() === '' ? NaN : Number(raw);
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  }

  private flag(name: string): boolean {
    const v = this.getAttribute(name);
    return v !== null && v !== 'false' && v !== 'off';
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private applyColors(): void {
    const fromAttrs: Partial<SphereColors> = {};
    for (const [attr, role] of Object.entries(COLOR_ATTRS)) {
      const v = this.getAttribute(attr);
      if (v) fromAttrs[role] = v;
    }
    this.rgb = resolveColors(this.getAttribute('preset'), fromAttrs, this.colorOverrides);
    this.renderer?.setColors(this.rgb);
    for (const role of COLOR_ROLES) this.rootEl.style.setProperty(`--_${role}`, toHex(this.rgb[role]));
    const rgba = ([r, g, b]: RGB, a: number) => `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
    const { glow, body } = this.rgb;
    const mixed: RGB = [0, 1, 2].map((i) => body[i] * 0.6 + glow[i] * 0.4) as RGB;
    this.rootEl.style.setProperty('--_glow-in', rgba(glow, 0.5));
    this.rootEl.style.setProperty('--_glow-out', rgba(mixed, 0.32));
  }

  private applyLayout(): void {
    const size = this.getAttribute('size');
    if (size) this.rootEl.style.setProperty('--_size', /^\d+(\.\d+)?$/.test(size.trim()) ? `${size.trim()}px` : size);
    else this.rootEl.style.removeProperty('--_size');
    const lines = Math.round(this.num('caption-lines', 2, 1, 10));
    this.captions.maxLines = lines;
    this.rootEl.style.setProperty('--_lines', String(lines));
  }

  private pickQuality(): Exclude<SphereQuality, 'auto'> {
    const q = this.getAttribute('quality');
    return q === 'low' || q === 'medium' ? q : 'high';
  }

  private setupRenderer(): void {
    if (this.renderer) return;
    if (this.canvasUsed) {
      // A disposed canvas keeps its lost context, so start with a fresh one.
      const fresh = document.createElement('canvas');
      fresh.setAttribute('part', 'canvas');
      fresh.setAttribute('aria-hidden', 'true');
      this.canvas.replaceWith(fresh);
      this.canvas = fresh;
    }
    this.canvasUsed = true;
    this.quality = this.pickQuality();
    this.renderer = SphereRenderer.create(this.canvas);
    this.canvas.hidden = !this.renderer;
    this.fallback.hidden = !!this.renderer;
    this.renderer?.setColors(this.rgb);
    this.resizeCanvas();
  }

  private resizeCanvas(): void {
    if (!this.renderer) return;
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP[this.quality]);
    const px = this.stage.clientWidth * dpr;
    this.renderer.resize(px, px);
  }

  /** The available width changed: let a long transcript show more or fewer words. */
  private onHostResize(width: number): void {
    if (Math.abs(width - this.hostWidth) < 1) return;
    this.hostWidth = width;
    cancelAnimationFrame(this.refitRaf);
    this.refitRaf = requestAnimationFrame(() => this.captions.refit());
  }

  private setSource(next: SphereSource): void {
    if (this.src === next) return;
    const wasListening = this.src === 'microphone';
    this.src = next;
    const listening = next === 'microphone';
    this.toggleAttribute('listening', listening);
    this.button.setAttribute('aria-pressed', String(listening));
    this.button.setAttribute('aria-label', message(this.speechLang, listening ? 'stop' : 'start'));
    if (listening !== wasListening) {
      this.emit(listening ? 'sls-start' : 'sls-stop', { source: next });
      if (!this.phrase && !this.interim && this.override === null) this.swapCaption();
    }
    this.emit('sls-sourcechange', { source: next });
  }

  private startTranscriber(): void {
    if (!this.captionsEnabled) return;
    if (!SpeechTranscriber.supported) {
      this.report('speech-unsupported', 'noSpeech', 'hint');
      return;
    }
    const t = (this.transcriber ??= new SpeechTranscriber());
    t.lang = this.speechLang;
    t.onupdate = (u) => this.pushTranscript(u);
    t.onerror = (code) => {
      const key: MessageKey =
        code === 'not-allowed' || code === 'service-not-allowed'
          ? 'denied'
          : code === 'language-not-supported'
            ? 'langUnsupported'
            : code === 'audio-capture'
              ? 'noMic'
              : 'network';
      this.report(`speech-${code}`, key, 'error');
    };
    t.start();
  }

  private onMicError(err: unknown): void {
    const name = (err as { name?: string } | null)?.name ?? '';
    const key: MessageKey =
      name === 'NotAllowedError' || name === 'SecurityError'
        ? 'denied'
        : name === 'InsecureContextError'
          ? 'insecure'
          : 'noMic';
    this.report(`mic-${name || 'error'}`, key, 'error', err);
  }

  /**
   * Problems go to the console and an `sls-error` event (and to screen readers).
   * They appear under the sphere only with the `show-errors` attribute.
   */
  private report(code: string, key: MessageKey, kind: 'hint' | 'error', error?: unknown): void {
    const text = message(this.speechLang, key);
    const log = kind === 'error' ? console.warn : console.info;
    if (error) log(`[speak-louder-sphere] ${code}: ${text}`, error);
    else log(`[speak-louder-sphere] ${code}: ${text}`);
    this.status.textContent = text;
    this.emit('sls-error', { code, message: text, error });
    if (this.flag('show-errors')) this.showNotice(text, kind, kind === 'error' ? 4500 : 5000);
  }

  private showNotice(text: string, kind: 'hint' | 'error', ms: number): void {
    this.notice = { text, kind };
    clearTimeout(this.noticeTimer);
    this.swapCaption();
    this.noticeTimer = window.setTimeout(() => {
      this.notice = null;
      this.swapCaption();
    }, ms);
  }

  /** Fade the caption out, update it, fade back in. */
  private swapCaption(): void {
    clearTimeout(this.fadeTimer);
    const hasContent = this.captions.text.length > 0;
    if (!hasContent) {
      this.captionBox.classList.remove('fading');
      this.refreshCaption();
      return;
    }
    this.captionBox.classList.add('fading');
    this.fadeTimer = window.setTimeout(() => {
      this.refreshCaption();
      this.captionBox.classList.remove('fading');
    }, 420);
  }

  private refreshCaption(): void {
    if (this.notice) return this.captions.setMessage(this.notice.text, this.notice.kind);
    if (this.phrase || this.interim) return this.captions.setTranscript(this.phrase, this.interim);
    if (this.override !== null) return this.captions.setMessage(this.override, 'text');
    const text = this.listening ? this.getAttribute('listening-text') : this.getAttribute('text');
    if (text) this.captions.setMessage(text, this.listening ? 'hint' : 'text');
    else this.captions.clear();
  }

  private emit<T>(type: string, detail: T): void {
    this.dispatchEvent(new CustomEvent<T>(type, { detail, bubbles: true, composed: true }));
  }

  // ---------------------------------------------------------------------------
  // Animation loop
  // ---------------------------------------------------------------------------

  private updateLoop = (): void => {
    const run = this.isConnected && this.onScreen && document.visibilityState !== 'hidden';
    if (run && !this.raf) {
      this.last = 0;
      this.raf = requestAnimationFrame(this.tick);
    } else if (!run) this.stopLoop();
  };

  private stopLoop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private tick = (now: number): void => {
    this.raf = requestAnimationFrame(this.tick);
    // Cap at ~60 fps: high refresh screens would only burn battery.
    if (this.lastDraw && now - this.lastDraw < 9.5) return;
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    this.lastDraw = now;
    this.step(dt, now / 1000);
    this.watchPerformance(dt);
  };

  private step(dt: number, wall: number): void {
    const f = this.readFeatures(dt);
    const k = (tau: number) => 1 - Math.exp(-dt / tau);
    this.listen += ((this.src !== 'none' ? 1 : 0) - this.listen) * k(0.5);
    this.hover += ((this.hovering && this.interactive ? 1 : 0) - this.hover) * k(0.18);

    // Springy size pulse driven by the voice (and a little press feedback).
    const target = f.level + this.hover * 0.22 - (this.pressed ? 0.55 : 0);
    this.pulseV += (170 * (target - this.pulse) - 14 * this.pulseV) * dt;
    this.pulse += this.pulseV * dt;

    const reduce = this.reducedMotion?.matches ? 0.35 : 1;
    this.time += dt * this.speed * reduce * (0.42 + 0.18 * this.listen + 0.95 * f.level);

    const T = this.time;
    const pulseScale = 1 + 0.045 * this.pulse * reduce;

    // Soft outer light: faint while listening, blooming with the voice.
    const glowTarget = Math.min(1, 0.3 * this.listen + 0.12 * this.hover + 0.85 * f.level);
    this.glowLevel += (glowTarget - this.glowLevel) * k(0.12);
    if (Math.abs(this.glowLevel - this.glowShown) > 0.003) {
      this.glowShown = this.glowLevel;
      this.glow.style.opacity = this.glowLevel.toFixed(3);
      this.glow.style.transform = `translate(-50%, -50%) scale(${pulseScale.toFixed(4)})`;
    }

    if (!this.renderer) {
      this.fallback.style.setProperty('--_pulse', pulseScale.toFixed(4));
      return;
    }
    rotationMatrix(0.42 * T, 0.3 + 0.3 * Math.sin(0.21 * T + 0.7), 0.25 * Math.sin(0.17 * T + 1.9), this.matrix);
    this.renderer.render({
      time: T,
      frame: this.matrix,
      amp: 0.3 + 0.05 * Math.sin(0.37 * T) + 0.12 * f.level + 0.06 * f.low,
      offset: -0.05 + 0.1 * Math.sin(0.29 * T + 0.4),
      ripple: 0.045 * f.high + 0.012 * f.level,
      energy: (0.94 + 0.06 * Math.sin(wall * 1.3)) * (1 + 0.3 * f.level + 0.1 * f.mid) * (1 + 0.08 * this.listen + 0.08 * this.hover),
      radius: pulseScale / CANVAS_SCALE,
    });
  }

  private readFeatures(dt: number): VoiceFeatures {
    const f = this.features;
    let src: VoiceFeatures;
    if (this.src === 'simulation' && this.simulator) src = this.simulator.read(dt);
    else if (this.src === 'manual') {
      const v = this.manualLevel;
      src = { level: v, low: v * 0.8, mid: v * 0.7, high: v * 0.4 };
    } else src = this.analyser.read(dt);
    const k = 1 - Math.exp(-dt / 0.05);
    f.level += (src.level - f.level) * k;
    f.low += (src.low - f.low) * k;
    f.mid += (src.mid - f.mid) * k;
    f.high += (src.high - f.high) * k;
    return f;
  }

  /** In `quality="auto"` step down when the device cannot keep up. */
  private watchPerformance(dt: number): void {
    const q = this.getAttribute('quality');
    if ((q && q !== 'auto') || this.quality === 'low') return;
    this.perfTime += dt;
    if (dt > 1 / 38) this.perfSlow += dt;
    if (this.perfTime < 4) return;
    if (this.perfSlow / this.perfTime > 0.5) {
      this.quality = DOWNGRADE[this.quality];
      this.resizeCanvas();
    }
    this.perfTime = 0;
    this.perfSlow = 0;
  }
}
