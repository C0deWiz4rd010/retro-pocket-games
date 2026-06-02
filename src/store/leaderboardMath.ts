/** Pure leaderboard logic — no storage, fully unit-testable. */

export interface LbEntry {
  name: string;
  score: number;
  at: number;
}

export const LB_MAX = 10;

/** Normalize a player-entered name to a short uppercase tag. */
export function normalizeName(raw: string): string {
  return raw.trim().slice(0, 8).toUpperCase() || 'YOU';
}

/** Would this score make the local top 10? */
export function qualifies(entries: readonly LbEntry[], score: number): boolean {
  if (score <= 0) return false;
  return entries.length < LB_MAX || score > (entries[entries.length - 1]?.score ?? 0);
}

/** Insert a new entry, keep sorted desc, cap at LB_MAX. Returns {entries, rank}. */
export function insertEntry(
  entries: readonly LbEntry[],
  entry: LbEntry,
): { entries: LbEntry[]; rank: number } {
  const merged = [...entries, entry].sort((a, b) => b.score - a.score).slice(0, LB_MAX);
  const rank = merged.indexOf(entry);
  return { entries: merged, rank };
}
