import { describe, expect, it } from 'vitest';
import { shooters, waveParams } from './core';

describe('invaders core', () => {
  it('lets only the lowest living alien per column shoot', () => {
    const aliens = [
      { alive: true, row: 0, col: 0 },
      { alive: true, row: 1, col: 0 },
      { alive: false, row: 2, col: 0 },
      { alive: true, row: 0, col: 1 },
    ];
    const s = shooters(aliens);
    expect(s).toHaveLength(2);
    expect(s).toContain(aliens[1]);
    expect(s).toContain(aliens[3]);
  });

  it('ramps difficulty with the wave but stays within caps', () => {
    const w1 = waveParams(1);
    const w10 = waveParams(10);
    expect(w10.fireInterval).toBeLessThan(w1.fireInterval);
    expect(w10.fireInterval).toBeGreaterThanOrEqual(0.35);
    expect(waveParams(99).bulletSpeed).toBe(400);
    expect(w10.stepInterval(0.1)).toBeGreaterThanOrEqual(0.07);
    expect(w1.stepInterval(1)).toBeLessThanOrEqual(0.6);
    expect(w10.startOffset).toBe(48);
  });
});
