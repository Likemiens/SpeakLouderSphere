/** Colour roles of the sphere. Any CSS colour string is accepted. */
export interface SphereColors {
  /** Glass body and shadows (keep it dark). */
  deep: string;
  /** Glow on the top side of the membrane. */
  body: string;
  /** Bright light under the membrane and along its folding edge. */
  glow: string;
  /** Tint that the top side and the edge drift into (the violet in "nova"). */
  accent: string;
  /** Glass rim, fresnel and outer halo. */
  rim: string;
}

export type ColorRole = keyof SphereColors;
export const COLOR_ROLES: readonly ColorRole[] = ['deep', 'body', 'glow', 'accent', 'rim'];

export const PRESETS = {
  nova: { deep: '#07154a', body: '#2f6bff', glow: '#3fe6ff', accent: '#9747ff', rim: '#5f9dff' },
  aurora: { deep: '#03262a', body: '#10b3a3', glow: '#7dffc0', accent: '#3ab8ff', rim: '#4fe3c8' },
  amethyst: { deep: '#1a0838', body: '#7c3aed', glow: '#f07cff', accent: '#4f8bff', rim: '#b68cff' },
  sunset: { deep: '#2a0a1c', body: '#ff4d6d', glow: '#ffb45e', accent: '#ffe066', rim: '#ff8a9f' },
  ember: { deep: '#240c02', body: '#e8590c', glow: '#ffd43b', accent: '#ff3b30', rim: '#ff9b50' },
  ocean: { deep: '#021a33', body: '#0077ff', glow: '#00e5ff', accent: '#00ffa3', rim: '#4cb8ff' },
  mono: { deep: '#111318', body: '#7b8190', glow: '#f4f6fb', accent: '#b9bfcc', rim: '#d5d9e2' },
} satisfies Record<string, SphereColors>;

export type PresetName = keyof typeof PRESETS;
export const DEFAULT_PRESET: PresetName = 'nova';

export function isPreset(name: string | null | undefined): name is PresetName {
  return !!name && Object.prototype.hasOwnProperty.call(PRESETS, name);
}

export type RGB = [number, number, number];

let probe: CanvasRenderingContext2D | null | undefined;

/** Parses any CSS colour into sRGB 0..1 components. Returns null for invalid input. */
export function parseColor(input: string | null | undefined): RGB | null {
  if (!input) return null;
  const s = input.trim();
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) return hexToRgb(hex[1]);

  // Let the browser normalise everything else (rgb(), hsl(), named colours, …).
  if (probe === undefined) probe = document.createElement('canvas').getContext('2d');
  if (!probe) return null;
  probe.fillStyle = '#010203';
  probe.fillStyle = s;
  const out = String(probe.fillStyle);
  if (out === '#010203' && !/^#?010203$/i.test(s)) return null;
  if (out.startsWith('#')) return hexToRgb(out.slice(1));
  const m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(out);
  return m ? [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255] : null;
}

function hexToRgb(h: string): RGB {
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function srgbToLinear([r, g, b]: RGB): RGB {
  const f = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return [f(r), f(g), f(b)];
}

export function toHex([r, g, b]: RGB): string {
  const h = (c: number) =>
    Math.round(Math.min(1, Math.max(0, c)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Merges preset + overrides, dropping anything that is not a valid colour. */
export function resolveColors(
  preset: string | null | undefined,
  ...overrides: Array<Partial<SphereColors> | undefined>
): Record<ColorRole, RGB> {
  const base: SphereColors = PRESETS[isPreset(preset) ? preset : DEFAULT_PRESET];
  const out = {} as Record<ColorRole, RGB>;
  for (const role of COLOR_ROLES) {
    let value = parseColor(base[role]) as RGB;
    for (const o of overrides) {
      const parsed = parseColor(o?.[role]);
      if (parsed) value = parsed;
    }
    out[role] = value;
  }
  return out;
}
