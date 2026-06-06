import { read, write } from '@data/db';
import { GameScoresSchema, type GameScores } from '@data/schemas';

const cache = new Map<string, GameScores>();
const defaults = (): GameScores => GameScoresSchema.parse({});

export async function loadScores(gameId: string): Promise<GameScores> {
  if (cache.has(gameId)) return cache.get(gameId) as GameScores;
  const s = await read('scores', gameId, GameScoresSchema, defaults());
  cache.set(gameId, s);
  return s;
}

export function getBest(gameId: string): number {
  return cache.get(gameId)?.best ?? 0;
}

export function getLastPlayed(gameId: string): number {
  return cache.get(gameId)?.lastPlayed ?? 0;
}

/** Best value for a game-specific custom stat (e.g. 'level', 'length'), if recorded. */
export function getCustomBest(gameId: string, key: string): number {
  return cache.get(gameId)?.custom?.[key] ?? 0;
}

/**
 * Clear the "recently played" markers (lastPlayed) for all games without touching best
 * scores or history — drives the home "clear" action.
 */
export function clearAllLastPlayed(): void {
  for (const [id, s] of cache) {
    if (s.lastPlayed > 0) {
      const next: GameScores = { ...s, lastPlayed: 0 };
      cache.set(id, next);
      void write('scores', id, next);
    }
  }
}

/**
 * Record a finished run. Returns whether it's a new personal best.
 * Live in-game score is NOT persisted — only the final result, per docs/07.
 */
export async function submitScore(
  gameId: string,
  score: number,
  custom?: Record<string, number>,
): Promise<boolean> {
  const current = await loadScores(gameId);
  const isBest = score > current.best;
  const next: GameScores = {
    best: Math.max(current.best, score),
    lastPlayed: Date.now(),
    history: [...current.history, { score, at: Date.now() }].slice(-50),
    custom: mergeCustom(current.custom, custom),
  };
  cache.set(gameId, next);
  await write('scores', gameId, next);
  return isBest;
}

function mergeCustom(
  a: Record<string, number> | undefined,
  b: Record<string, number> | undefined,
): Record<string, number> | undefined {
  if (!a && !b) return undefined;
  const out: Record<string, number> = { ...(a ?? {}) };
  for (const [k, v] of Object.entries(b ?? {})) out[k] = Math.max(out[k] ?? 0, v);
  return out;
}

/** Preload high scores for a list of games (home tiles). */
export async function preloadScores(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => loadScores(id)));
}
