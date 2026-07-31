import { describe, it, expect } from 'vitest';
import { computeLayout, mapToVirtual } from './PixiManager';

/** Forward transform mirrored from the world container (screenX = offsetX ± scale·coord). */
function virtualToScreen(x: number, y: number, l: ReturnType<typeof computeLayout>): { x: number; y: number } {
  if (l.rotated) return { x: l.offsetX - l.scale * y, y: l.offsetY + l.scale * x };
  return { x: l.offsetX + l.scale * x, y: l.offsetY + l.scale * y };
}

describe('computeLayout', () => {
  it('letterboxes a portrait game in a portrait viewport (no rotation)', () => {
    const l = computeLayout(360, 600, 390, 844);
    expect(l.rotated).toBe(false);
    expect(l.scale).toBeCloseTo(390 / 360, 5);
  });

  it('rotates a landscape game inside a portrait viewport', () => {
    const l = computeLayout(640, 360, 390, 844);
    expect(l.rotated).toBe(true);
    // Fills width via the game height: scale = min(sw/vh, sh/vw).
    expect(l.scale).toBeCloseTo(Math.min(390 / 360, 844 / 640), 5);
  });

  it('does not rotate a landscape game in a landscape viewport', () => {
    const l = computeLayout(640, 360, 900, 500);
    expect(l.rotated).toBe(false);
  });

  it('round-trips virtual → screen → virtual (rotated)', () => {
    const l = computeLayout(640, 360, 390, 844);
    const pts: [number, number][] = [[0, 0], [640, 360], [320, 180], [100, 300]];
    for (const [x, y] of pts) {
      const s = virtualToScreen(x, y, l);
      const v = mapToVirtual(s.x, s.y, l);
      expect(v.x).toBeCloseTo(x, 4);
      expect(v.y).toBeCloseTo(y, 4);
    }
  });

  it('round-trips virtual → screen → virtual (letterboxed)', () => {
    const l = computeLayout(360, 600, 390, 844);
    const pts: [number, number][] = [[0, 0], [360, 600], [180, 300]];
    for (const [x, y] of pts) {
      const s = virtualToScreen(x, y, l);
      const v = mapToVirtual(s.x, s.y, l);
      expect(v.x).toBeCloseTo(x, 4);
      expect(v.y).toBeCloseTo(y, 4);
    }
  });

  it('centers the rotated game within the viewport', () => {
    const l = computeLayout(640, 360, 390, 844);
    // Virtual centre maps to viewport centre.
    const s = virtualToScreen(320, 180, l);
    expect(s.x).toBeCloseTo(390 / 2, 4);
    expect(s.y).toBeCloseTo(844 / 2, 4);
  });
});
