import { describe, it, expect, beforeEach } from 'vitest';
import { daily, last7Days, playedToday } from './dailyStore';
import { todayKey } from '@app/daily';

const today = todayKey();

beforeEach(() => {
  daily.set({
    lastPlayedDate: today,
    streak: 1,
    bestStreak: 1,
    results: { [today]: { gameId: 'snake', score: 100, modifier: 'classic' } },
  });
});

describe('last7Days', () => {
  it('returns 7 days ending today, in ascending date order', () => {
    const days = last7Days();
    expect(days.length).toBe(7);
    expect(days[6]!.key).toBe(today);
    for (let i = 1; i < 7; i++) {
      expect(days[i]!.key > days[i - 1]!.key).toBe(true);
    }
  });

  it('marks a day played only when a result exists', () => {
    const days = last7Days();
    expect(days[6]!.played).toBe(true); // today has a result
    expect(days[0]!.played).toBe(false); // six days ago has none
  });

  it('uses the real weekday for the final day', () => {
    const days = last7Days();
    expect(days[6]!.weekday).toBe(new Date().getDay());
  });
});

describe('playedToday', () => {
  it('is true when the last played date is today', () => {
    expect(playedToday()).toBe(true);
  });

  it('is false after a gap', () => {
    daily.set({ lastPlayedDate: '2000-01-01', streak: 0, bestStreak: 0, results: {} });
    expect(playedToday()).toBe(false);
  });
});
