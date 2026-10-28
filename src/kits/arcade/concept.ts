import { Container, Graphics } from 'pixi.js';
import type { GameContext } from '@core/types';
import { backdropLayers, type Spark } from './juice';

export const CYAN = 0x00f7ff;
export const PINK = 0xff2e97;
export const GOLD = 0xffd200;
export const GREEN = 0x3ddc84;
export const BLUE = 0x38bdf8;
export const VIOLET = 0xb388ff;
export const WHITE = 0xf6f7ff;

export function makeLayer(ctx: GameContext): { layer: Container; g: Graphics; sparks: Spark[] } {
  const layer = new Container();
  const g = new Graphics();
  const sparks: Spark[] = [];
  layer.addChild(g);
  ctx.stage.addChild(layer);
  return { layer, g, sparks };
}

/**
 * Synthwave backdrop. The perspective grid never changes, so it lives in a static layer drawn
 * once; the scanlines, stars (and the city) animate in a second layer redrawn ~15x/s. Both sit
 * beneath `g`, so the per-frame game graphic only contains game objects.
 */
export function backdrop(g: Graphics, w: number, h: number, t: number, horizon = h * 0.56): void {
  const layers = backdropLayers(g, t);
  const still = layers?.still ?? g;
  const anim = layers?.anim ?? g;
  const key = `${w}|${h}|${horizon}`;
  if (!layers || layers.stillKey !== key) {
    if (layers) {
      layers.stillKey = key;
      still.clear();
    }
    still.rect(0, 0, w, h).fill({ color: 0x050511 });
    for (let x = 0; x <= w; x += 28) {
      still
        .moveTo(x, horizon)
        .lineTo(w / 2 + (x - w / 2) * 2.8, h)
        .stroke({ width: 1, color: CYAN, alpha: 0.12 });
    }
    for (let y = horizon; y < h; y += 24) {
      still.moveTo(0, y).lineTo(w, y).stroke({ width: 1, color: PINK, alpha: 0.1 });
    }
  }
  if (!layers || layers.animFresh) {
    for (let y = -8; y < h; y += 8) {
      anim.rect(0, y + ((t * 10) % 8), w, 1).fill({ color: 0xffffff, alpha: 0.025 });
    }
    for (let i = 0; i < 30; i++) {
      const x = (i * 73 + Math.sin(t * 0.6 + i) * 14) % w;
      const y = 18 + ((i * 41 + t * 16) % (h * 0.5));
      anim
        .rect(x, y, 2, 2)
        .fill({ color: i % 3 === 0 ? PINK : CYAN, alpha: 0.25 + (i % 5) * 0.08 });
    }
  }
}

export function city(g: Graphics, w: number, h: number, t: number): void {
  // Drawn into the animated backdrop layer, in step with it (skipped on frames it isn't redrawn).
  const layers = backdropLayers(g, t);
  if (layers && !layers.animFresh) return;
  const target = layers?.anim ?? g;
  const base = h * 0.5;
  for (let i = 0; i < 12; i++) {
    const bw = 22 + (i % 4) * 8;
    const bh = 38 + ((i * 29) % 72);
    const x = ((i * 53 - t * 18) % (w + 80)) - 40;
    target.rect(x, base - bh, bw, bh).fill({ color: 0x0b1530, alpha: 0.95 });
    for (let yy = base - bh + 8; yy < base - 6; yy += 14) {
      for (let xx = x + 5; xx < x + bw - 3; xx += 10) {
        if (((xx + yy + i) | 0) % 3 === 0)
          target.rect(xx, yy, 3, 4).fill({ color: i % 2 ? CYAN : PINK, alpha: 0.55 });
      }
    }
  }
}

export function boxHit(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
