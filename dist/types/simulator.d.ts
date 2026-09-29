import type { VoiceFeatures } from './audio';
/**
 * A synthetic "someone is talking" signal: phrases of syllables separated by
 * pauses. Used by `simulate` to preview the sphere without a microphone.
 */
export declare class SpeechSimulator {
    private talking;
    private left;
    private syl;
    private rate;
    private amp;
    private hiss;
    private out;
    read(dt: number): VoiceFeatures;
}
