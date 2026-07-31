import { describe, it, expect } from 'vitest';
import { getGame, GAMES } from './Registry';

describe('mastery goals', () => {
  it('gives mapped games a mechanic-specific gold goal', () => {
    const snake = getGame('snake');
    const gold = snake?.masteryGoals?.[2];
    expect(gold?.metric).toBe('custom');
    expect(gold?.customKey).toBe('length');
    expect(gold?.target).toBe(30);
  });

  it('keeps score-tier goals for games without a mapped stat', () => {
    const pinball = getGame('pinball');
    expect(pinball?.masteryGoals?.every((g) => g.metric === 'score')).toBe(true);
  });

  it('always defines exactly three ascending goals for every game', () => {
    for (const g of GAMES.filter((x) => x.available)) {
      const goals = g.masteryGoals ?? [];
      expect(goals.length).toBe(3);
      // bronze + silver are score tiers and must be ascending
      expect(goals[0]!.target).toBeLessThanOrEqual(goals[1]!.target);
    }
  });

  it('every custom gold goal targets a positive value', () => {
    for (const g of GAMES.filter((x) => x.available)) {
      const gold = g.masteryGoals?.[2];
      if (gold?.metric === 'custom') {
        expect(gold.customKey).toBeTruthy();
        expect(gold.target).toBeGreaterThan(0);
      }
    }
  });
});
