import type { Graphics } from 'pixi.js';

/** Soft glow: stacked translucent circles (cheap stand-in for a blur filter). */
export function glowCircle(
  g: Graphics,
  x: number,
  y: number,
  r: number,
  color: number,
  a = 0.35,
): void {
  g.circle(x, y, r * 2.2).fill({ color, alpha: a * 0.25 });
  g.circle(x, y, r * 1.6).fill({ color, alpha: a * 0.5 });
  g.circle(x, y, r).fill({ color, alpha: Math.min(1, a * 2) });
}

/** Rounded-rect glow halo drawn behind a bright shape. */
export function glowRect(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  color: number,
  a = 0.3,
): void {
  g.roundRect(x - 4, y - 4, w + 8, h + 8, radius + 4).fill({ color, alpha: a * 0.3 });
  g.roundRect(x - 2, y - 2, w + 4, h + 4, radius + 2).fill({ color, alpha: a * 0.5 });
}

/** Mix two 0xRRGGBB colours. */
export function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255,
    ag = (a >> 8) & 255,
    ab = a & 255;
  const br = (b >> 16) & 255,
    bg = (b >> 8) & 255,
    bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/** Bevelled tile: lit top-left edge, shaded bottom-right edge (reads as a chunky retro block). */
export function bevelBlock(
  g: Graphics,
  x: number,
  y: number,
  size: number,
  color: number,
  alpha = 1,
): void {
  const r = Math.max(2, size * 0.14);
  g.roundRect(x, y, size, size, r).fill({ color, alpha });
  const edge = Math.max(2, size * 0.14);
  g.roundRect(x + 1, y + 1, size - 2, edge, r).fill({ color: 0xffffff, alpha: 0.28 * alpha });
  g.roundRect(x + 1, y + size - edge - 1, size - 2, edge, r).fill({
    color: 0x000000,
    alpha: 0.28 * alpha,
  });
}
