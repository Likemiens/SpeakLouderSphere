import { type SphereColors } from './colors';
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
/**
 * `<speak-louder-sphere>` — a glowing glass sphere that reacts to the voice
 * and shows live captions of what is being said.
 */
export declare class SpeakLouderSphereElement extends HTMLElement {
    static get observedAttributes(): string[];
    private readonly rootEl;
    private readonly stage;
    private canvas;
    private readonly fallback;
    private readonly glow;
    private readonly button;
    private readonly captionBox;
    private readonly status;
    private readonly captions;
    private renderer;
    private canvasUsed;
    private quality;
    private readonly analyser;
    private transcriber;
    private simulator;
    private src;
    private manualLevel;
    private starting;
    private colorOverrides;
    private rgb;
    private raf;
    private last;
    private lastDraw;
    private time;
    private onScreen;
    private features;
    private listen;
    private hover;
    private hovering;
    private pressed;
    private pulse;
    private pulseV;
    private glowLevel;
    private glowShown;
    private perfTime;
    private perfSlow;
    private readonly matrix;
    private readonly reducedMotion;
    private resizeObserver;
    private intersectionObserver;
    private hostWidth;
    private refitRaf;
    private phrase;
    private interim;
    private override;
    private notice;
    private holdTimer;
    private noticeTimer;
    private fadeTimer;
    constructor();
    /** True while the microphone is on. */
    get listening(): boolean;
    /** What drives the sphere right now. */
    get source(): SphereSource;
    /** Current smoothed loudness 0..1. */
    get level(): number;
    /** Resolved colours as hex strings. */
    get colors(): SphereColors;
    set colors(value: Partial<SphereColors>);
    /** Overrides some colours; pass `null` to go back to the preset/attributes. */
    setColors(colors: Partial<SphereColors> | null): void;
    /** Turns the microphone (and live captions) on. Resolves to false if it failed. */
    start(): Promise<boolean>;
    /** Turns the microphone / any audio source off. */
    stop(): void;
    toggle(): Promise<boolean>;
    /** Drive the sphere from any MediaStream (e.g. a remote WebRTC voice). */
    connectStream(stream: MediaStream): void;
    /** Drive the sphere from an <audio>/<video> element (e.g. text-to-speech playback). */
    connectMediaElement(el: HTMLMediaElement): void;
    /** Fake speech for previews. */
    simulate(on?: boolean): void;
    /** Drive the sphere manually with your own loudness value 0..1. */
    setLevel(level: number): void;
    /** Show your own text under the sphere (e.g. the assistant's reply). `null` clears it. */
    setCaption(text: string | null): void;
    clearCaption(): void;
    /**
     * Feed a transcript into the captions — used internally for the Web Speech API,
     * and handy for plugging in your own speech-to-text (Whisper, Deepgram, …).
     */
    pushTranscript(update: {
        final?: string;
        interim?: string;
    }): void;
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void;
    /** Recognition language: own `lang`, then the nearest ancestor's, then the browser's. */
    private get speechLang();
    private get interactive();
    private get captionsEnabled();
    private get sensitivity();
    private get speed();
    private get captionHold();
    private num;
    private flag;
    private applyColors;
    private applyLayout;
    private pickQuality;
    private setupRenderer;
    private resizeCanvas;
    /** The available width changed: let a long transcript show more or fewer words. */
    private onHostResize;
    private setSource;
    private startTranscriber;
    private onMicError;
    /**
     * Problems go to the console and an `sls-error` event (and to screen readers).
     * They appear under the sphere only with the `show-errors` attribute.
     */
    private report;
    private showNotice;
    /** Fade the caption out, update it, fade back in. */
    private swapCaption;
    private refreshCaption;
    private emit;
    private updateLoop;
    private stopLoop;
    private tick;
    private step;
    private readFeatures;
    /** In `quality="auto"` step down when the device cannot keep up. */
    private watchPerformance;
}
