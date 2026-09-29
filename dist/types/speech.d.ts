export interface TranscriptUpdate {
    /** Newly finalised text (append it to what you already have). */
    final: string;
    /** Current not-yet-final hypothesis (replace the previous one). */
    interim: string;
}
/**
 * Live speech-to-text on top of the browser's Web Speech API
 * (Chrome, Edge, Safari; not Firefox). Keeps recognising until stop() —
 * browsers end sessions on silence, so they are restarted transparently.
 */
export declare class SpeechTranscriber {
    static get supported(): boolean;
    lang: string;
    onupdate: ((u: TranscriptUpdate) => void) | null;
    onerror: ((code: string) => void) | null;
    private rec;
    private running;
    private emitted;
    private interim;
    private failures;
    private restartTimer;
    private sessionStart;
    get active(): boolean;
    start(): boolean;
    stop(): void;
    private launch;
    private handleResult;
    private handleError;
    private handleEnd;
}
