import { type ColorRole, type RGB } from './colors';
export interface FrameParams {
    time: number;
    /** World -> membrane rotation, column-major 3x3. */
    frame: Float32Array;
    amp: number;
    offset: number;
    ripple: number;
    energy: number;
    halo: number;
    /** Sphere radius relative to half of the canvas. */
    radius: number;
}
/** Thin WebGL 1 wrapper that draws the sphere into a canvas. */
export declare class SphereRenderer {
    readonly canvas: HTMLCanvasElement;
    private gl;
    private program;
    private buffer;
    private loc;
    private colors;
    private lost;
    static create(canvas: HTMLCanvasElement): SphereRenderer | null;
    private constructor();
    get ready(): boolean;
    /** Colours in sRGB 0..1; converted to linear light for the shader. */
    setColors(colors: Record<ColorRole, RGB>): void;
    resize(width: number, height: number): void;
    render(p: FrameParams): void;
    dispose(): void;
    private init;
    private onLost;
    private onRestored;
}
/** Column-major rotation: Rz(roll) * Rx(pitch) * Ry(yaw). */
export declare function rotationMatrix(yaw: number, pitch: number, roll: number, out?: Float32Array<ArrayBuffer>): Float32Array;
