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

/**
 * A daily modifier applied generically by the host (no per-game code):
 *  - `timeScale` multiplies the simulation dt (fast/slow runs)
 *  - `scoreMult` rewards harder modifiers with a score multiplier
 *  - `label` is an i18n key for the hero + HUD banner
 */
export interface DailyModifier {
  id: string;
  label: string;
  timeScale: number;
  scoreMult: number;
}

const MODIFIERS: DailyModifier[] = [
  { id: 'classic', label: 'mod.classic', timeScale: 1.0, scoreMult: 1.0 },
  { id: 'turbo', label: 'mod.turbo', timeScale: 1.4, scoreMult: 1.5 },
  { id: 'zen', label: 'mod.zen', timeScale: 0.8, scoreMult: 1.0 },
  { id: 'sudden', label: 'mod.sudden', timeScale: 1.15, scoreMult: 2.0 },
];

/** Today's modifier — deterministic from the date (offset so it differs from game pick). */
export function dailyModifier(): DailyModifier {
  const rng = new RNG((dailySeed() ^ 0x5bd1e995) >>> 0);
  return rng.pick(MODIFIERS);
}

/** Milliseconds until local midnight (when the next daily challenge unlocks). */
export function untilNextDaily(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

/** Formatted "Hh Mm" countdown to the next daily. */
export function nextDailyLabel(): string {
  const ms = untilNextDaily();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}
