import { GAMES, type GameMeta } from '@core/Registry';
import { RNG, seedFromString } from '@utils/rng';

/** Today's date as YYYY-MM-DD (local). */
export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Deterministic numeric seed for today (same for everyone → fair daily). */
export function dailySeed(): number {
  return seedFromString(todayKey());
}

/** Pick today's daily game deterministically from the available catalog. */
export function pickDailyGame(): GameMeta {
  const pool = GAMES.filter((g) => g.available);
  const rng = new RNG(dailySeed());
  return rng.pick(pool);
}
