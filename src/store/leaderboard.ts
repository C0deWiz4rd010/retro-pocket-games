import { read, write } from '@data/db';
import { LeaderboardSchema, type Leaderboard } from '@data/schemas';

const cache = new Map<string, Leaderboard>();
const MAX = 10;
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
  if (score <= 0) return false;
  const entries = getEntries(gameId);
  return entries.length < MAX || score > (entries[entries.length - 1]?.score ?? 0);
}

export async function addEntry(gameId: string, name: string, score: number): Promise<number> {
  const lb = await loadLeaderboard(gameId);
  const entries = [...lb.entries, { name: name.slice(0, 8).toUpperCase() || 'YOU', score, at: Date.now() }]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX);
  const next: Leaderboard = { entries };
  cache.set(gameId, next);
  await write('leaderboard', gameId, next);
  return entries.findIndex((e) => e.score === score && e.at > Date.now() - 5000);
}
