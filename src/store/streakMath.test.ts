import { describe, it, expect } from 'vitest';
import { dayDiff, nextStreak, displayStreak } from './streakMath';

describe('streak math', () => {
  it('dayDiff counts calendar days', () => {
    expect(dayDiff('2026-06-01', '2026-06-02')).toBe(1);
    expect(dayDiff('2026-06-01', '2026-06-01')).toBe(0);
    expect(dayDiff('2026-06-01', '2026-06-08')).toBe(7);
    expect(dayDiff('2026-06-30', '2026-07-01')).toBe(1); // month boundary
  });

  it('first ever play starts a streak of 1', () => {
    expect(nextStreak('', 0, '2026-06-02')).toBe(1);
  });

  it('a consecutive day increments the streak', () => {
    expect(nextStreak('2026-06-01', 3, '2026-06-02')).toBe(4);
  });

  it('replaying the same day keeps the streak', () => {
    expect(nextStreak('2026-06-02', 4, '2026-06-02')).toBe(4);
  });

  it('a missed day resets the streak to 1', () => {
    expect(nextStreak('2026-06-01', 9, '2026-06-03')).toBe(1);
  });

  it('displayStreak previews today without double counting', () => {
    // not played today yet, last was yesterday → would become prev+1
    expect(displayStreak('2026-06-01', 3, '2026-06-02')).toBe(4);
    // already played today → shows current
    expect(displayStreak('2026-06-02', 4, '2026-06-02')).toBe(4);
    // broken → 1
    expect(displayStreak('2026-05-20', 7, '2026-06-02')).toBe(1);
  });
});
