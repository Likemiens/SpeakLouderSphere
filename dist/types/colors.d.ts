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
export declare const COLOR_ROLES: readonly ColorRole[];
export declare const PRESETS: {
    nova: {
        deep: string;
        body: string;
        glow: string;
        accent: string;
        rim: string;
    };
    aurora: {
        deep: string;
        body: string;
        glow: string;
        accent: string;
        rim: string;
    };
    amethyst: {
        deep: string;
        body: string;
        glow: string;
        accent: string;
        rim: string;
    };
    sunset: {
        deep: string;
        body: string;
        glow: string;
        accent: string;
        rim: string;
    };
    ember: {
        deep: string;
        body: string;
        glow: string;
        accent: string;
        rim: string;
    };
    ocean: {
        deep: string;
        body: string;
        glow: string;
        accent: string;
        rim: string;
    };
    mono: {
        deep: string;
        body: string;
        glow: string;
        accent: string;
        rim: string;
    };
};
export type PresetName = keyof typeof PRESETS;
export declare const DEFAULT_PRESET: PresetName;
export declare function isPreset(name: string | null | undefined): name is PresetName;
export type RGB = [number, number, number];
/** Parses any CSS colour into sRGB 0..1 components. Returns null for invalid input. */
export declare function parseColor(input: string | null | undefined): RGB | null;
export declare function srgbToLinear([r, g, b]: RGB): RGB;
export declare function toHex([r, g, b]: RGB): string;
/** Merges preset + overrides, dropping anything that is not a valid colour. */
export declare function resolveColors(preset: string | null | undefined, ...overrides: Array<Partial<SphereColors> | undefined>): Record<ColorRole, RGB>;
