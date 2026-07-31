import { describe, it, expect } from 'vitest';
import { computeReward, xpForLevel } from './profile';

describe('computeReward', () => {
  it('awards a base amount even for a zero score', () => {
    const r = computeReward(0);
    expect(r.breakdown.score).toBe(0);
    expect(r.xpGain).toBeGreaterThanOrEqual(5);
    expect(r.tokenGain).toBeGreaterThanOrEqual(1);
  });

  it('normalizes score against targetScore so different scales award equal XP', () => {
    const small = computeReward(100, { reward: { targetScore: 100, sessionMin: 2, sessionMax: 4, difficulty: 1 } });
    const large = computeReward(5000, { reward: { targetScore: 5000, sessionMin: 2, sessionMax: 4, difficulty: 1 } });
    expect(small.breakdown.score).toBe(large.breakdown.score);
    expect(small.breakdown.score).toBe(38);
  });

  it('caps the normalized score bonus at 2.5x target', () => {
    const r = computeReward(100000, { reward: { targetScore: 1000, sessionMin: 2, sessionMax: 4, difficulty: 1 } });
    expect(r.breakdown.score).toBe(Math.round(38 * 2.5));
  });

  it('applies the difficulty multiplier to the score bonus', () => {
    const r = computeReward(100, { reward: { targetScore: 100, sessionMin: 2, sessionMax: 4, difficulty: 1.25 } });
    expect(r.breakdown.score).toBe(Math.round(38 * 1.25));
  });

  it('rewards improvement over the previous best and grants a bonus token', () => {
    const r = computeReward(600, { reward: { targetScore: 1000, sessionMin: 2, sessionMax: 4, difficulty: 1 }, previousBest: 300 });
    expect(r.breakdown.improvement).toBeGreaterThan(0);
    // improvement bonus should push at least one extra token over the base minimum
    const noImprove = computeReward(600, { reward: { targetScore: 1000, sessionMin: 2, sessionMax: 4, difficulty: 1 }, previousBest: 600 });
    expect(noImprove.breakdown.improvement).toBe(0);
    expect(r.tokenGain).toBeGreaterThan(noImprove.tokenGain);
  });

  it('adds daily and mastery bonuses', () => {
    const r = computeReward(500, { reward: { targetScore: 1000, sessionMin: 2, sessionMax: 4, difficulty: 1 }, daily: true, masteryRank: 2 });
    expect(r.breakdown.daily).toBe(15);
    expect(r.breakdown.mastery).toBe(20);
  });

  it('scales the base amount by session length', () => {
    const quick = computeReward(0, { reward: { targetScore: 100, sessionMin: 1, sessionMax: 2, difficulty: 1 } });
    const deep = computeReward(0, { reward: { targetScore: 100, sessionMin: 4, sessionMax: 8, difficulty: 1 } });
    expect(quick.breakdown.base).toBe(8);
    expect(deep.breakdown.base).toBe(18);
  });
});

describe('xpForLevel', () => {
  it('follows a gentle linear curve', () => {
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(2)).toBe(175);
    expect(xpForLevel(5)).toBe(400);
  });
});
