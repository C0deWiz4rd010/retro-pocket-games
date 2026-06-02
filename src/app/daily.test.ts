import { describe, it, expect } from 'vitest';
import { dailyModifier } from './daily';

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
});
