import { describe, it, expect } from 'vitest';
import { computeLayout, mapToVirtual } from './PixiManager';

/** Forward transform mirrored from the world container (screenX = offsetX ± scale·coord). */
function virtualToScreen(
  x: number,
  y: number,
  l: ReturnType<typeof computeLayout>,
): { x: number; y: number } {
  if (l.rotated) return { x: l.offsetX - l.scale * y, y: l.offsetY + l.scale * x };
  return { x: l.offsetX + l.scale * x, y: l.offsetY + l.scale * y };
}

describe('computeLayout insets', () => {
  it('letterboxes into the area left after HUD (top) and controls (bottom)', () => {
    const l = computeLayout(360, 640, 360, 800, { top: 60, right: 0, bottom: 140, left: 0 });
    // Available 360x600 → height-limited scale 600/640.
    expect(l.scale).toBeCloseTo(600 / 640, 5);
    expect(l.offsetY).toBeCloseTo(60, 5);
    expect(l.offsetX).toBeCloseTo((360 - 360 * (600 / 640)) / 2, 5);
  });

  it('shifts the game away from side controls in landscape', () => {
    const l = computeLayout(640, 360, 812, 375, { top: 50, right: 90, bottom: 0, left: 90 });
    expect(l.rotated).toBe(false);
    const availW = 812 - 180;
    const availH = 375 - 50;
    expect(l.scale).toBeCloseTo(Math.min(availW / 640, availH / 360), 5);
    expect(l.offsetX).toBeGreaterThanOrEqual(90);
    expect(l.offsetY).toBeGreaterThanOrEqual(50);
  });

  it('keeps a rotated landscape game inside the inset area', () => {
    const l = computeLayout(640, 360, 390, 844, { top: 60, right: 0, bottom: 150, left: 0 });
    expect(l.rotated).toBe(true);
    const p = virtualToScreen(0, 0, l);
    const q = virtualToScreen(640, 360, l);
    for (const pt of [p, q]) {
      expect(pt.y).toBeGreaterThanOrEqual(60 - 1e-6);
      expect(pt.y).toBeLessThanOrEqual(844 - 150 + 1e-6);
      expect(pt.x).toBeGreaterThanOrEqual(-1e-6);
      expect(pt.x).toBeLessThanOrEqual(390 + 1e-6);
    }
  });

  it('never collapses to zero when insets exceed the screen', () => {
    const l = computeLayout(360, 640, 200, 200, { top: 150, right: 0, bottom: 150, left: 0 });
    expect(l.scale).toBeGreaterThan(0);
  });
});

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
    const pts: [number, number][] = [
      [0, 0],
      [640, 360],
      [320, 180],
      [100, 300],
    ];
    for (const [x, y] of pts) {
      const s = virtualToScreen(x, y, l);
      const v = mapToVirtual(s.x, s.y, l);
      expect(v.x).toBeCloseTo(x, 4);
      expect(v.y).toBeCloseTo(y, 4);
    }
  });

  it('round-trips virtual → screen → virtual (letterboxed)', () => {
    const l = computeLayout(360, 600, 390, 844);
    const pts: [number, number][] = [
      [0, 0],
      [360, 600],
      [180, 300],
    ];
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
