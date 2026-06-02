/** Pure daily-streak math — no storage, fully unit-testable. */

/** Days difference between two YYYY-MM-DD keys (b - a). */
export function dayDiff(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

/** The streak that results from completing `today`, given the previous state. */
export function nextStreak(lastPlayedDate: string, prevStreak: number, today: string): number {
  if (!lastPlayedDate) return 1;
  if (lastPlayedDate === today) return prevStreak; // already counted today
  const gap = dayDiff(lastPlayedDate, today);
  if (gap === 1) return prevStreak + 1; // consecutive day
  return 1; // gap (or backwards) → reset
}

/** What the streak would display as right now (without recording). */
export function displayStreak(lastPlayedDate: string, prevStreak: number, today: string): number {
  if (lastPlayedDate === today) return prevStreak;
  return nextStreak(lastPlayedDate, prevStreak, today);
}
