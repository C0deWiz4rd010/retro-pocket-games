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

export interface DailyDay {
  key: string; // YYYY-MM-DD
  weekday: number; // 0=Sun
  played: boolean;
}

/** The last 7 calendar days (oldest → today) with whether the daily was completed. */
export function last7Days(): DailyDay[] {
  const results = daily().results;
  const out: DailyDay[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.push({ key, weekday: d.getDay(), played: Boolean(results[key]) });
  }
  return out;
}

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
