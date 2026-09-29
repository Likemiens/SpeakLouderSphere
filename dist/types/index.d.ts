import { SpeakLouderSphereElement, type SphereQuality } from './element';
import type { PresetName, SphereColors } from './colors';
export { SpeakLouderSphereElement } from './element';
export type { SphereQuality, SphereSource, TranscriptDetail } from './element';
export { PRESETS, COLOR_ROLES, parseColor } from './colors';
export type { SphereColors, PresetName, ColorRole } from './colors';
export { SpeechTranscriber } from './speech';
export type { TranscriptUpdate } from './speech';
export declare const TAG_NAME = "speak-louder-sphere";
/** Registers the custom element (done automatically on import). */
export declare function define(tagName?: string): void;
export interface SphereOptions {
    preset?: PresetName;
    colors?: Partial<SphereColors>;
    /** Sphere diameter: number (px) or any CSS length. */
    size?: number | string;
    /** Speech recognition language, e.g. "ru-RU", "en-US". */
    lang?: string;
    /** Text shown while the microphone is off. */
    text?: string;
    /** Text shown while listening, before anything is recognised. */
    listeningText?: string;
    captions?: boolean;
    captionLines?: number;
    /** How long a finished phrase stays on screen, ms. */
    captionHold?: number;
    sensitivity?: number;
    speed?: number;
    quality?: SphereQuality;
    /** Click toggles the microphone (default true). */
    interactive?: boolean;
    /** Fake speech when idle, for previews. */
    simulate?: boolean;
}
/** Creates a sphere inside `target` (element or CSS selector) and returns it. */
export declare function createSphere(target: Element | string, options?: SphereOptions): SpeakLouderSphereElement;
declare global {
    interface HTMLElementTagNameMap {
        'speak-louder-sphere': SpeakLouderSphereElement;
    }
}
