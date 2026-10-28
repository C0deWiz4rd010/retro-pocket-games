import { describe, expect, it } from 'vitest';
import { brickReflect, levelSpeed, paddleBounce } from './core';

describe('breakout core', () => {
  it('keeps the ball speed constant across a paddle bounce', () => {
    for (const hit of [-1, -0.4, 0, 0.7, 1]) {
      const v = paddleBounce(hit, 400);
      expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(400, 6);
      expect(v.vy).toBeLessThan(0);
    }
  });

  it('steers by contact point', () => {
    expect(paddleBounce(0, 300).vx).toBeCloseTo(0, 6);
    expect(paddleBounce(1, 300).vx).toBeGreaterThan(0);
    expect(paddleBounce(-1, 300).vx).toBeLessThan(0);
  });

  it('caps the level speed', () => {
    expect(levelSpeed(1)).toBe(298);
    expect(levelSpeed(99)).toBe(520);
  });

  it('reflects on the axis of least penetration', () => {
    const brick = { x: 100, y: 100, w: 50, h: 18 };
    // coming from the left into the side of the brick
    const side = brickReflect({ x: 96, y: 109, vx: 200, vy: -50 }, 6, brick);
    expect(side).toEqual({ vx: -200, vy: -50 });
    // coming from below into the underside
    const under = brickReflect({ x: 125, y: 122, vx: 30, vy: -300 }, 6, brick);
    expect(under).toEqual({ vx: 30, vy: 300 });
    // no overlap
    expect(brickReflect({ x: 10, y: 10, vx: 1, vy: 1 }, 6, brick)).toBeNull();
  });
});
