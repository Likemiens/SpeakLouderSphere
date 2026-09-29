import type { VoiceFeatures } from './audio';

/**
 * A synthetic "someone is talking" signal: phrases of syllables separated by
 * pauses. Used by `simulate` to preview the sphere without a microphone.
 */
export class SpeechSimulator {
  private talking = false;
  private left = 0.4;
  private syl = 0;
  private rate = 4.5;
  private amp = 0.7;
  private hiss = 0;
  private out: VoiceFeatures = { level: 0, low: 0, mid: 0, high: 0 };

  read(dt: number): VoiceFeatures {
    this.left -= dt;
    if (this.left <= 0) {
      this.talking = !this.talking;
      this.left = this.talking ? 1.4 + Math.random() * 2.8 : 0.35 + Math.random() * 1.1;
    }

    let target = 0;
    if (this.talking) {
      this.syl += dt * this.rate;
      if (this.syl >= 1) {
        this.syl %= 1;
        this.rate = 3.2 + Math.random() * 3.4;
        this.amp = 0.4 + Math.random() * 0.6;
        this.hiss = Math.random() < 0.3 ? 0.5 + Math.random() * 0.5 : Math.random() * 0.3;
      }
      target = this.amp * (0.3 + 0.7 * Math.sin(Math.PI * this.syl));
    }

    const o = this.out;
    const k = (tau: number) => 1 - Math.exp(-dt / tau);
    o.level += (target - o.level) * k(target > o.level ? 0.04 : 0.16);
    o.low += (target * (0.8 - 0.4 * this.hiss) - o.low) * k(0.08);
    o.mid += (target * 0.9 - o.mid) * k(0.08);
    o.high += (target * this.hiss - o.high) * k(0.06);
    return o;
  }
}
