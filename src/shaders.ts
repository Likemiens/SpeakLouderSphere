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
 * A frosted glass rim finishes it off; the outer glow is a soft CSS shadow (see styles.ts).
 * It is a handful of sin() calls per pixel, so it runs fine on phones too.
 */

export const VERTEX_SHADER: string = /* glsl */ `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER: string = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uRes;       // drawing buffer size, px
uniform float uRadius;   // sphere radius as a fraction of half the shorter side
uniform float uTime;     // animation time (runs faster while speaking)
uniform mat3 uFrame;     // world -> sheet space rotation
uniform float uAmp;      // sheet wave amplitude
uniform float uOffset;   // sheet height
uniform float uRipple;   // fine ripples (high frequencies of the voice)
uniform float uEnergy;   // overall brightness of the light inside
uniform vec3 uDeep;      // colours, linear RGB
uniform vec3 uBody;
uniform vec3 uGlow;
uniform vec3 uAccent;
uniform vec3 uRim;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// The sheet as an implicit surface f(p) = 0 (f > 0 above it); also returns the world-space gradient.
float sheet(vec3 p, out vec3 grad) {
  vec3 q = uFrame * p;
  float t = uTime;
  float a1 = 2.6 * q.x + 0.80 * t;
  float a2 = 2.1 * q.z - 0.63 * t + 1.3;
  float a3 = 2.19 * (q.x - q.z) + 1.07 * t + 2.0;
  float b1 = 6.3 * q.x + 4.1 * t;
  float b2 = 5.7 * q.z - 3.3 * t;
  float h  = uAmp * (0.60 * sin(a1) + 0.45 * sin(a2) + 0.22 * sin(a3)) + uRipple * sin(b1) * sin(b2);
  float hx = uAmp * (1.56 * cos(a1) + 0.482 * cos(a3)) + uRipple * 6.3 * cos(b1) * sin(b2);
  float hz = uAmp * (0.945 * cos(a2) - 0.482 * cos(a3)) + uRipple * 5.7 * sin(b1) * cos(b2);
  grad = vec3(-hx, 1.0, -hz) * uFrame;   // v * M == transpose(M) * v: back to world space
  return q.y - uOffset - h;
}

vec3 toSRGB(vec3 c) {
  return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
}

// Hue-preserving tone mapping: keeps blues blue instead of washing them out;
// only the hottest spots burn towards white.
vec3 tonemap(vec3 c) {
  c *= 1.25;
  float m = max(c.r, max(c.g, c.b));
  return c * ((1.0 - exp(-m)) / max(m, 1e-5)) + max(m - 1.2, 0.0) * 0.15;
}

void main() {
  float minRes = min(uRes.x, uRes.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * minRes * uRadius);
  float r = length(p);
  float px = 2.0 / (minRes * uRadius);   // one pixel in sphere units
  float dither = hash12(gl_FragCoord.xy);

  // ---- the ball -------------------------------------------------------------
  float cov = 1.0 - smoothstep(1.0 - px, 1.0 + px, r);
  vec3 ball = vec3(0.0);

  if (cov > 0.0) {
    float rc = min(r, 0.9995);
    float z = sqrt(1.0 - rc * rc);

    // Ball-lens look: the middle is magnified, the edge compressed.
    vec3 P = vec3(p * (0.85 + 0.25 * rc * rc), 0.5 * z);

    vec3 g;
    float f = sheet(P, g);
    float gl = length(g);
    float d = f / gl;                  // signed distance to the sheet
    float nz = g.z / gl;               // > 0: top side faces us, < 0: underside faces us
    float underFacing = smoothstep(-0.15, 0.55, -nz);
    float topFacing = smoothstep(-0.15, 0.55, nz);
    float vio = smoothstep(0.0, 1.0, P.x * 0.8 + P.y * 0.5);

    float below = d < 0.0 ? exp(-d * d / 0.1444) : 0.0;               // width 0.38
    vec3 cBelow = mix(uBody, uGlow, exp(-d * d / 0.0576));             // width 0.24
    float above = d > 0.0 ? exp(-d * d / 0.1024) : 0.0;               // width 0.32
    vec3 cAbove = mix(mix(uBody, uAccent, vio), uGlow, 0.45 * exp(-d * 12.0));
    float crease = exp(-d * d / 0.0004);                               // width 0.02
    vec3 cCrease = mix(uGlow, uAccent, vio * 0.7) + 0.08;

    vec3 acc = cBelow * below * 3.2 * (0.3 + 0.7 * underFacing)
             + cAbove * above * 2.2 * (0.3 + 0.7 * topFacing)
             + cCrease * crease * 0.45;
    acc *= uEnergy * mix(1.0, smoothstep(1.02, 0.55, rc), 0.5);        // frosted, dimmer edge

    // Glass: dark body, darker towards the bottom, and a soft rim (a bit stronger bottom-left).
    vec3 base = 0.6 * uDeep * (0.55 + 0.45 * z) * (0.3 + 0.9 * (0.5 + 0.5 * p.y));
    float side = 0.8 + 0.2 * dot(p / max(r, 1e-5), vec2(-0.7071, -0.7071));
    float rim = exp(-(1.0 - min(r, 1.0)) * 22.0) * 0.45 * side;

    ball = toSRGB(tonemap(acc + uRim * rim) + base);
  }

  // Premultiplied alpha: the ball is opaque, everything around it transparent.
  vec3 rgb = clamp(ball + (dither - 0.5) / 255.0, 0.0, 1.0);
  gl_FragColor = vec4(rgb * cov, cov);
}
`;
