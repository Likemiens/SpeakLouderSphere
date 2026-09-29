import { FRAGMENT_SHADER, VERTEX_SHADER } from './shaders';
import { COLOR_ROLES, srgbToLinear, type ColorRole, type RGB } from './colors';

export interface FrameParams {
  time: number;
  /** World -> membrane rotation, column-major 3x3. */
  frame: Float32Array;
  amp: number;
  offset: number;
  ripple: number;
  energy: number;
  /** Sphere radius relative to half of the canvas. */
  radius: number;
}

const UNIFORMS = [
  'uRes', 'uRadius', 'uTime', 'uFrame', 'uAmp', 'uOffset', 'uRipple', 'uEnergy',
  'uDeep', 'uBody', 'uGlow', 'uAccent', 'uRim',
] as const;
type UniformName = (typeof UNIFORMS)[number];

const COLOR_UNIFORM: Record<ColorRole, UniformName> = {
  deep: 'uDeep', body: 'uBody', glow: 'uGlow', accent: 'uAccent', rim: 'uRim',
};

/** Thin WebGL 1 wrapper that draws the sphere into a canvas. */
export class SphereRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private loc = {} as Record<UniformName, WebGLUniformLocation | null>;
  private colors = {} as Record<ColorRole, RGB>;
  private lost = false;

  static create(canvas: HTMLCanvasElement): SphereRenderer | null {
    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) return null;
    const r = new SphereRenderer(canvas, gl);
    return r.program ? r : null;
  }

  private constructor(readonly canvas: HTMLCanvasElement, gl: WebGLRenderingContext) {
    this.gl = gl;
    canvas.addEventListener('webglcontextlost', this.onLost, false);
    canvas.addEventListener('webglcontextrestored', this.onRestored, false);
    this.init();
  }

  get ready(): boolean {
    return !this.lost && !!this.program;
  }

  /** Colours in sRGB 0..1; converted to linear light for the shader. */
  setColors(colors: Record<ColorRole, RGB>): void {
    for (const role of COLOR_ROLES) this.colors[role] = srgbToLinear(colors[role]);
  }

  resize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  render(p: FrameParams): void {
    const gl = this.gl;
    if (!this.ready) return;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);

    const l = this.loc;
    gl.uniform2f(l.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(l.uRadius, p.radius);
    gl.uniform1f(l.uTime, p.time);
    gl.uniformMatrix3fv(l.uFrame, false, p.frame);
    gl.uniform1f(l.uAmp, p.amp);
    gl.uniform1f(l.uOffset, p.offset);
    gl.uniform1f(l.uRipple, p.ripple);
    gl.uniform1f(l.uEnergy, p.energy);
    for (const role of COLOR_ROLES) {
      const c = this.colors[role];
      if (c) gl.uniform3f(l[COLOR_UNIFORM[role]], c[0], c[1], c[2]);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    const gl = this.gl;
    if (this.program) gl.deleteProgram(this.program);
    if (this.buffer) gl.deleteBuffer(this.buffer);
    this.program = null;
    this.buffer = null;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  private init(): void {
    const gl = this.gl;
    if (this.program) gl.deleteProgram(this.program);
    this.program = null;

    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, 0, 'aPos');
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('[speak-louder-sphere] link error:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return;
    }
    this.program = program;
    for (const name of UNIFORMS) this.loc[name] = gl.getUniformLocation(program, name);

    if (!this.buffer) {
      this.buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      // One oversized triangle covering the whole viewport.
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
  }

  private onLost = (e: Event): void => {
    e.preventDefault();
    this.lost = true;
    this.program = null;
    this.buffer = null;
  };

  private onRestored = (): void => {
    this.lost = false;
    this.init();
  };
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('[speak-louder-sphere] shader error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** Column-major rotation: Rz(roll) * Rx(pitch) * Ry(yaw). */
export function rotationMatrix(yaw: number, pitch: number, roll: number, out = new Float32Array(9)): Float32Array {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  // Row-major entries of R = Rz * Rx * Ry
  const m00 = cr * cy - sr * sp * sy;
  const m01 = -sr * cp;
  const m02 = cr * sy + sr * sp * cy;
  const m10 = sr * cy + cr * sp * sy;
  const m11 = cr * cp;
  const m12 = sr * sy - cr * sp * cy;
  const m20 = -cp * sy;
  const m21 = sp;
  const m22 = cp * cy;
  out[0] = m00; out[1] = m10; out[2] = m20;
  out[3] = m01; out[4] = m11; out[5] = m21;
  out[6] = m02; out[7] = m12; out[8] = m22;
  return out;
}
