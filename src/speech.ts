// Minimal typings for the Web Speech API (not part of lib.dom).
interface SRAlternative {
  readonly transcript: string;
}
interface SRResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SRAlternative;
}
interface SRResultList {
  readonly length: number;
  [index: number]: SRResult;
}
interface SREvent extends Event {
  readonly results: SRResultList;
}
interface SRErrorEvent extends Event {
  readonly error: string;
}
interface SRInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SRConstructor = new () => SRInstance;

function recognitionCtor(): SRConstructor | null {
  const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export interface TranscriptUpdate {
  /** Newly finalised text (append it to what you already have). */
  final: string;
  /** Current not-yet-final hypothesis (replace the previous one). */
  interim: string;
}

/** Errors after which retrying makes no sense. */
const FATAL = new Set(['not-allowed', 'service-not-allowed', 'language-not-supported', 'audio-capture']);

// Chrome on Android repeats the whole transcript in continuous mode, so there we
// run short sessions and chain them instead.
const IS_ANDROID = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

/**
 * Live speech-to-text on top of the browser's Web Speech API
 * (Chrome, Edge, Safari; not Firefox). Keeps recognising until stop() —
 * browsers end sessions on silence, so they are restarted transparently.
 */
export class SpeechTranscriber {
  static get supported(): boolean {
    return typeof window !== 'undefined' && !!recognitionCtor();
  }

  lang = 'ru-RU';
  onupdate: ((u: TranscriptUpdate) => void) | null = null;
  onerror: ((code: string) => void) | null = null;

  private rec: SRInstance | null = null;
  private running = false;
  private emitted: boolean[] = [];
  private interim = '';
  private failures = 0;
  private restartTimer = 0;
  private sessionStart = 0;

  get active(): boolean {
    return this.running;
  }

  start(): boolean {
    if (!recognitionCtor()) return false;
    if (this.running) return true;
    this.running = true;
    this.failures = 0;
    this.launch();
    return true;
  }

  stop(): void {
    this.running = false;
    clearTimeout(this.restartTimer);
    try {
      this.rec?.stop(); // lets the engine deliver the last final result
    } catch {
      /* not started */
    }
  }

  private launch(): void {
    const Ctor = recognitionCtor();
    if (!Ctor || !this.running) return;
    const rec = new Ctor();
    rec.lang = this.lang;
    rec.continuous = !IS_ANDROID;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => rec === this.rec && this.handleResult(e);
    rec.onerror = (e) => rec === this.rec && this.handleError(e.error);
    rec.onend = () => rec === this.rec && this.handleEnd();
    this.rec = rec;
    this.emitted = [];
    this.interim = '';
    this.sessionStart = performance.now();
    try {
      rec.start();
    } catch {
      this.handleEnd();
    }
  }

  private handleResult(e: SREvent): void {
    let final = '';
    let interim = '';
    for (let i = 0; i < e.results.length; i++) {
      const result = e.results[i];
      const text = result[0]?.transcript ?? '';
      if (result.isFinal) {
        if (!this.emitted[i]) {
          this.emitted[i] = true;
          final += ' ' + text;
        }
      } else {
        interim += ' ' + text;
      }
    }
    this.interim = interim.trim();
    this.failures = 0;
    this.onupdate?.({ final: final.trim(), interim: this.interim });
  }

  private handleError(code: string): void {
    if (code === 'no-speech' || code === 'aborted') return;
    if (FATAL.has(code)) {
      this.running = false;
      this.onerror?.(code);
      return;
    }
    this.failures++;
    if (code === 'network' && this.failures === 1) this.onerror?.(code);
    if (this.failures > 4) {
      this.running = false;
      this.onerror?.(code);
    }
  }

  private handleEnd(): void {
    // Commit a hypothesis that never became final.
    if (this.interim) {
      const text = this.interim;
      this.interim = '';
      this.onupdate?.({ final: text, interim: '' });
    }
    this.rec = null;
    if (!this.running) return;
    const quick = performance.now() - this.sessionStart < 1000;
    const delay = quick ? Math.min(5000, 250 * 2 ** this.failures) : 60;
    this.restartTimer = window.setTimeout(() => this.launch(), delay);
  }
}
