import { describe, it, expect } from 'vitest';
import { dailyModifier, pickDailyGame } from './daily';
import { GAMES, getGame } from '@core/Registry';

describe('daily modifier', () => {
  it('is deterministic within a day', () => {
    const a = dailyModifier();
    const b = dailyModifier();
    expect(a).toEqual(b);
  });

  it('has sane bounds', () => {
    const m = dailyModifier();
    expect(m.timeScale).toBeGreaterThan(0);
    expect(m.timeScale).toBeLessThanOrEqual(2);
    expect(m.scoreMult).toBeGreaterThanOrEqual(1);
    expect(m.label.startsWith('mod.')).toBe(true);
  });

  it('only picks a modifier allowed by the game rules', () => {
    for (const g of GAMES.filter((x) => x.available)) {
      const allowed = new Set(g.dailyRules?.allowedModifiers ?? []);
      const m = dailyModifier(g);
      expect(allowed.has(m.id)).toBe(true);
    }
  });

  it('is deterministic per game', () => {
    const snake = getGame('snake')!;
    expect(dailyModifier(snake)).toEqual(dailyModifier(snake));
  });
});

describe('pickDailyGame', () => {
  it('returns an available game deterministically', () => {
    const a = pickDailyGame();
    const b = pickDailyGame();
    expect(a.id).toBe(b.id);
    expect(a.available).toBe(true);
  });
});
