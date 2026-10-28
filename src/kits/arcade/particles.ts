import type { Graphics } from 'pixi.js';
import { fxRandom } from '@utils/rng';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Remaining life; the particle dies at 0. */
  life: number;
  color: number;
}

export interface ParticleOptions {
  /** Downward acceleration in px/s². */
  gravity?: number;
  /** Life lost per second (1 = life is in seconds). */
  decay?: number;
  /** Radius at full opacity. */
  size?: number;
  /** alpha = min(1, life * fade). 2 gives a quick fade-out at the end of short lives. */
  fade?: number;
}

/**
 * One pooled particle system for a whole game: a single flat array, recycled objects (no
 * per-burst allocation) and a single pass over a shared Graphics. Replaces the ~18 hand-rolled
 * `Particle[]` + splice loops. Randomness uses fxRandom() so cosmetics never touch the game RNG.
 */
export class Particles {
  private live: Particle[] = [];
  private free: Particle[] = [];
  private readonly gravity: number;
  private readonly decay: number;
  private readonly size: number;
  private readonly fade: number;

  constructor(opts: ParticleOptions = {}) {
    this.gravity = opts.gravity ?? 0;
    this.decay = opts.decay ?? 1;
    this.size = opts.size ?? 3;
    this.fade = opts.fade ?? 2;
  }

  get count(): number {
    return this.live.length;
  }

  emit(p: Particle): void {
    const q = this.free.pop() ?? { x: 0, y: 0, vx: 0, vy: 0, life: 0, color: 0 };
    q.x = p.x;
    q.y = p.y;
    q.vx = p.vx;
    q.vy = p.vy;
    q.life = p.life;
    q.color = p.color;
    this.live.push(q);
  }

  /** Radial burst of `count` particles with random angle/speed. */
  burst(x: number, y: number, color: number, count = 14, speed = 120, life = 0.6): void {
    for (let i = 0; i < count; i++) {
      const a = fxRandom() * Math.PI * 2;
      const s = speed * (0.35 + fxRandom() * 0.75);
      this.emit({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, color });
    }
  }

  update(dt: number): void {
    const live = this.live;
    let w = 0;
    for (let i = 0; i < live.length; i++) {
      const p = live[i]!;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += this.gravity * dt;
      p.life -= dt * this.decay;
      if (p.life <= 0) this.free.push(p);
      else live[w++] = p;
    }
    live.length = w;
  }

  draw(g: Graphics, offsetX = 0, offsetY = 0): void {
    for (const p of this.live) {
      const a = Math.min(1, p.life * this.fade);
      g.circle(p.x + offsetX, p.y + offsetY, this.size * a).fill({ color: p.color, alpha: a });
    }
  }

  clear(): void {
    for (const p of this.live) this.free.push(p);
    this.live.length = 0;
  }
}
