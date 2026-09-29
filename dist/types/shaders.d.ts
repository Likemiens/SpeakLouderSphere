/**
 * GLSL for the sphere (WebGL 1 / GLSL ES 1.00 for maximum compatibility).
 *
 * The look: a dark glass ball with a luminous, slowly twisting sheet inside.
 * The sheet is an implicit wavy surface that rotates in 3D. For every pixel we
 * take a point inside the ball, measure its signed distance to the sheet and
 * paint soft light around the fold line:
 *   - under the sheet: a hot `glow` colour right at the fold, cooling to `body` blue;
 *   - over the sheet:  `body` blue drifting into the `accent` colour;
 *   - whichever side faces the viewer shines brighter.
 * A frosted glass rim and an optional voice-driven halo finish it off.
 * It is a handful of sin() calls per pixel, so it runs fine on phones too.
 */
export declare const VERTEX_SHADER: string;
export declare const FRAGMENT_SHADER: string;
