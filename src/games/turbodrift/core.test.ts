import { describe, expect, it } from 'vitest';
import { boostFromCharge, cruiseSpeed, driftGain, roadCenter, roadWidth } from './core';

describe('turbo drift core', () => {
  it('keeps the road centre on screen', () => {
    for (const d of [0, 500, 2500, 10000, 80000]) {
      const c = roadCenter(d, 360);
      const w = roadWidth(d, 360);
      expect(c - w / 2).toBeGreaterThan(-60);
      expect(c + w / 2).toBeLessThan(420);
    }
  });

  it('narrows the road but never below a drivable width', () => {
    expect(roadWidth(1e9, 360)).toBeCloseTo(360 * 0.42, 6);
    expect(roadWidth(0, 360)).toBeGreaterThan(roadWidth(20000, 360));
  });

  it('caps the cruising speed', () => {
    expect(cruiseSpeed(0)).toBe(190);
    expect(cruiseSpeed(1e9)).toBe(420);
  });

  it('only charges a drift when sliding sideways', () => {
    expect(driftGain(60, 1)).toBe(0);
    expect(driftGain(300, 0.5)).toBeGreaterThan(driftGain(150, 0.5));
  });

  it('pays out mini-turbos only for a worthwhile drift', () => {
    expect(boostFromCharge(0.1)).toEqual({ seconds: 0, points: 0 });
    const full = boostFromCharge(1);
    expect(full.seconds).toBeCloseTo(1.6, 6);
    expect(full.points).toBe(600);
  });
});
