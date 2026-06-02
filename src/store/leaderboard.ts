import { read, write } from '@data/db';
import { LeaderboardSchema, type Leaderboard } from '@data/schemas';
import { normalizeName, qualifies as qualifiesPure, insertEntry } from './leaderboardMath';

const cache = new Map<string, Leaderboard>();
const defaults = (): Leaderboard => LeaderboardSchema.parse({});

export async function loadLeaderboard(gameId: string): Promise<Leaderboard> {
  if (cache.has(gameId)) return cache.get(gameId) as Leaderboard;
  const lb = await read('leaderboard', gameId, LeaderboardSchema, defaults());
  cache.set(gameId, lb);
  return lb;
}

export function getEntries(gameId: string): Leaderboard['entries'] {
  return cache.get(gameId)?.entries ?? [];
}

/** Would this score make the local top 10? */
export function qualifies(gameId: string, score: number): boolean {
  return qualifiesPure(getEntries(gameId), score);
}

export async function addEntry(gameId: string, name: string, score: number): Promise<number> {
  const lb = await loadLeaderboard(gameId);
  const { entries, rank } = insertEntry(lb.entries, {
    name: normalizeName(name),
    score,
    at: Date.now(),
  });
  cache.set(gameId, { entries });
  await write('leaderboard', gameId, { entries });
  return rank;
}
