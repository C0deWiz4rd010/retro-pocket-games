import { signal } from './store';
import { read, write } from '@data/db';
import { DailySchema, type Daily } from '@data/schemas';
import { todayKey } from '@app/daily';
import { nextStreak, displayStreak } from './streakMath';

const defaults = (): Daily => DailySchema.parse({});
export const daily = signal<Daily>(defaults());

export async function loadDaily(): Promise<void> {
  daily.set(await read('daily', '_', DailySchema, defaults()));
}

export const playedToday = (): boolean => daily().lastPlayedDate === todayKey();
export const currentStreak = (): number => {
  const d = daily();
  return displayStreak(d.lastPlayedDate, d.streak, todayKey());
};

/**
 * Record completion of today's daily challenge. Extends the streak when consecutive,
 * resets to 1 after a gap. Returns the resulting streak.
 */
export function recordDailyResult(gameId: string, score: number, modifier: string): number {
  const d = daily();
  const today = todayKey();
  const streak = nextStreak(d.lastPlayedDate, d.streak, today);
  const next: Daily = {
    lastPlayedDate: today,
    streak,
    bestStreak: Math.max(d.bestStreak, streak),
    results: { ...d.results, [today]: { gameId, score, modifier } },
  };
  daily.set(next);
  void write('daily', '_', next);
  return streak;
}
