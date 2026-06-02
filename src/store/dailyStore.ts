import { signal } from './store';
import { read, write } from '@data/db';
import { DailySchema, type Daily } from '@data/schemas';
import { todayKey } from '@app/daily';

const defaults = (): Daily => DailySchema.parse({});
export const daily = signal<Daily>(defaults());

export async function loadDaily(): Promise<void> {
  daily.set(await read('daily', '_', DailySchema, defaults()));
}

/** Days difference between two YYYY-MM-DD keys (b - a). */
function dayDiff(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

export const playedToday = (): boolean => daily().lastPlayedDate === todayKey();
export const currentStreak = (): number => (playedToday() ? daily().streak : streakIfPlayedNow());

/** What the streak would become if the player completes today's daily right now. */
function streakIfPlayedNow(): number {
  const d = daily();
  if (!d.lastPlayedDate) return 1;
  const gap = dayDiff(d.lastPlayedDate, todayKey());
  if (gap === 0) return d.streak;
  if (gap === 1) return d.streak + 1;
  return 1; // streak broken
}

/**
 * Record completion of today's daily challenge. Extends the streak when consecutive,
 * resets to 1 after a gap. Returns the resulting streak.
 */
export function recordDailyResult(gameId: string, score: number, modifier: string): number {
  const d = daily();
  const today = todayKey();
  let streak = d.streak;
  if (d.lastPlayedDate !== today) {
    const gap = d.lastPlayedDate ? dayDiff(d.lastPlayedDate, today) : 999;
    streak = gap === 1 ? d.streak + 1 : 1;
  }
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
