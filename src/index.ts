import { SpeakLouderSphereElement, type SphereQuality } from './element';
import type { PresetName, SphereColors } from './colors';

export { SpeakLouderSphereElement } from './element';
export type { SphereQuality, SphereSource, TranscriptDetail } from './element';
export { PRESETS, COLOR_ROLES, parseColor } from './colors';
export type { SphereColors, PresetName, ColorRole } from './colors';
export { SpeechTranscriber } from './speech';
export type { TranscriptUpdate } from './speech';

export const TAG_NAME = 'speak-louder-sphere';

/** Registers the custom element (done automatically on import). */
export function define(tagName: string = TAG_NAME): void {
  if (typeof customElements === 'undefined' || customElements.get(tagName)) return;
  customElements.define(
    tagName,
    tagName === TAG_NAME ? SpeakLouderSphereElement : class extends SpeakLouderSphereElement {},
  );
}

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
export function createSphere(target: Element | string, options: SphereOptions = {}): SpeakLouderSphereElement {
  define();
  const host = typeof target === 'string' ? document.querySelector(target) : target;
  if (!host) throw new Error(`speak-louder-sphere: target "${String(target)}" not found`);
  const el = document.createElement(TAG_NAME) as SpeakLouderSphereElement;
  const attrs: Record<string, unknown> = {
    preset: options.preset,
    size: options.size,
    lang: options.lang,
    text: options.text,
    'listening-text': options.listeningText,
    captions: options.captions === false ? 'false' : undefined,
    'caption-lines': options.captionLines,
    'caption-hold': options.captionHold,
    sensitivity: options.sensitivity,
    speed: options.speed,
    quality: options.quality,
    interactive: options.interactive === false ? 'false' : undefined,
    simulate: options.simulate ? '' : undefined,
  };
  for (const [name, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) el.setAttribute(name, String(value));
  }
  for (const [role, value] of Object.entries(options.colors ?? {})) {
    if (value) el.setAttribute(`color-${role}`, value);
  }
  host.appendChild(el);
  return el;
}

define();

declare global {
  interface HTMLElementTagNameMap {
    'speak-louder-sphere': SpeakLouderSphereElement;
  }
}
