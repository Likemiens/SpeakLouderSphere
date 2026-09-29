export interface VoiceFeatures {
    /** Overall loudness, 0..1, with a fast attack and a softer release. */
    level: number;
    /** Energy in low / mid / high bands, 0..1. */
    low: number;
    mid: number;
    high: number;
}
/**
 * Turns an audio source (microphone, any MediaStream or <audio>/<video> element)
 * into smooth loudness + band values for the sphere.
 */
export declare class VoiceAnalyser {
    sensitivity: number;
    private ctx;
    private analyser;
    private source;
    private ownedStream;
    private timeData;
    private freqData;
    private noiseFloor;
    private capturedElement;
    private out;
    get connected(): boolean;
    /** Asks for the microphone and starts analysing it. */
    useMicrophone(): Promise<MediaStream>;
    /** Analyse an arbitrary stream (WebRTC, screen capture, etc.). */
    useStream(stream: MediaStream, owned?: boolean): void;
    /** Analyse what an <audio>/<video> element is playing (e.g. TTS). Playback stays audible. */
    useElement(el: HTMLMediaElement): void;
    detach(): void;
    /** Browsers suspend audio until a user gesture; call from any click. */
    resume(): void;
    /** Pause audio processing (resumed automatically on the next use). */
    suspend(): void;
    /** Reads the current features. `dt` in seconds. */
    read(dt: number): VoiceFeatures;
    private context;
    private analyserNode;
}
