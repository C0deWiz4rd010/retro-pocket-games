import { Graphics } from 'pixi.js';
import type { RNG } from '@utils/rng';

export interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  color: number;
  size: number;
}

export const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));
export const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);

export function burst(sparks: Spark[], rng: RNG, x: number, y: number, color: number, count = 14, power = 120): void {
  for (let i = 0; i < count; i++) {
    const a = rng.next() * Math.PI * 2;
    const speed = power * (0.35 + rng.next() * 0.75);
    const ttl = 0.35 + rng.next() * 0.35;
    sparks.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: ttl,
      ttl,
      color,
      size: 2 + rng.next() * 3,
    });
  }
}

export function updateSparks(sparks: Spark[], dt: number): void {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]!;
    s.life -= dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy += 80 * dt;
    if (s.life <= 0) sparks.splice(i, 1);
  }
}

export function drawSparks(g: Graphics, sparks: readonly Spark[]): void {
  for (const s of sparks) {
    const alpha = clamp(s.life / s.ttl, 0, 1);
    g.circle(s.x, s.y, s.size * alpha).fill({ color: s.color, alpha });
  }
}

export function drawBackdrop(g: Graphics, w: number, h: number, t: number, a = 0x10132a, b = 0x050510): void {
  g.rect(0, 0, w, h).fill({ color: b });
  for (let y = -24; y < h + 48; y += 24) {
    const yy = (y + (t * 18) % 24) | 0;
    g.rect(0, yy, w, 1).fill({ color: a, alpha: 0.35 });
  }
  for (let x = 0; x < w; x += 32) {
    g.rect(x, 0, 1, h).fill({ color: a, alpha: 0.2 });
  }
}

