import { Container, Graphics } from 'pixi.js';
import { fxRandom } from '@utils/rng';

interface Star {
  x: number;
  y: number;
  s: number;
  speed: number;
}

/**
 * Parallax starfield on two cached Graphics layers (far / near). The stars are tessellated once
 * and scrolled by moving the layer — no per-frame clear/redraw like the old inline backdrops.
 * Each layer is drawn twice (stacked vertically) so wrapping is seamless.
 */
export class Starfield {
  readonly view = new Container();
  private layers: { g: Graphics; speed: number }[] = [];
  private h: number;

  constructor(w: number, h: number, opts: { bg?: number; count?: number; tint?: number } = {}) {
    this.h = h;
    if (opts.bg !== undefined) {
      const bg = new Graphics();
      bg.rect(0, 0, w, h).fill({ color: opts.bg });
      this.view.addChild(bg);
    }
    const count = opts.count ?? 48;
    const tint = opts.tint ?? 0xffffff;
    for (const [speed, share, size, alpha] of [
      [6, 0.65, 0.9, 0.35],
      [16, 0.35, 1.6, 0.7],
    ] as const) {
      const stars: Star[] = [];
      for (let i = 0; i < Math.round(count * share); i++)
        stars.push({
          x: fxRandom() * w,
          y: fxRandom() * h,
          s: size * (0.7 + fxRandom() * 0.6),
          speed,
        });
      const g = new Graphics();
      for (const copy of [0, -h]) {
        for (const s of stars) g.circle(s.x, s.y + copy, s.s).fill({ color: tint, alpha });
      }
      this.view.addChild(g);
      this.layers.push({ g, speed });
    }
  }

  /** Parallax scroll driven by a camera position (e.g. a vertical scroller). */
  setScroll(y: number): void {
    this.layers.forEach((l, i) => {
      const k = i === 0 ? 0.15 : 0.35;
      l.g.y = (((y * k) % this.h) + this.h) % this.h;
    });
  }

  update(dt: number): void {
    for (const l of this.layers) l.g.y = (l.g.y + l.speed * dt) % this.h;
  }
}
