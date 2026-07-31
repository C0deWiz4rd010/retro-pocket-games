import { signal } from './store';
import { read, write } from '@data/db';
import { ProfileSchema, type Profile } from '@data/schemas';
import type { RewardProfile } from '@core/Registry';

const defaults = ProfileSchema.parse({});

export const profile = signal<Profile>(defaults);

/** XP needed to reach the next level (gentle curve). */
export const xpForLevel = (level: number): number => 100 + (level - 1) * 75;

export async function loadProfile(): Promise<void> {
  profile.set(await read('profile', '_', ProfileSchema, defaults));
}

async function persist(): Promise<void> {
  await write('profile', '_', profile());
}

export interface RunReward {
  leveledUp: boolean;
  newLevel: number;
  xpGain: number;
  tokenGain: number;
  breakdown: {
    base: number;
    score: number;
    improvement: number;
    daily: number;
    mastery: number;
  };
}

export interface RewardInput {
  reward?: RewardProfile;
  previousBest?: number;
  daily?: boolean;
  masteryRank?: number;
}

/**
 * Pure XP/token computation for a finished run (unit-tested). Normalizes raw score against the
 * game's `reward.targetScore` so titles with wildly different score scales award comparable XP,
 * then adds base + improvement + daily + mastery bonuses. See docs/11 §10.
 */
export function computeReward(score: number, opts: RewardInput = {}): Omit<RunReward, 'leveledUp' | 'newLevel'> {
  const target = Math.max(1, opts.reward?.targetScore ?? 1000);
  const normalized = Math.min(2.5, score / target);
  const base = opts.reward?.sessionMin === 1 ? 8 : opts.reward?.sessionMin && opts.reward.sessionMin >= 4 ? 18 : 12;
  const scoreXp = Math.round(38 * normalized * (opts.reward?.difficulty ?? 1));
  const improvement = score > (opts.previousBest ?? 0) ? Math.min(28, Math.max(6, Math.round((score - (opts.previousBest ?? 0)) / target * 30))) : 0;
  const daily = opts.daily ? 15 : 0;
  const mastery = (opts.masteryRank ?? 0) * 10;
  const breakdown = { base, score: scoreXp, improvement, daily, mastery };
  const xpGain = Math.max(5, Object.values(breakdown).reduce((sum, n) => sum + n, 0));
  const tokenGain = Math.max(1, Math.floor(xpGain / 20) + (opts.daily ? 1 : 0) + (improvement > 0 ? 1 : 0));
  return { xpGain, tokenGain, breakdown };
}

/** Award XP + tokens after a run, level up as needed, and persist. */
export function awardRun(
  gameId: string,
  score: number,
  opts: RewardInput = {},
): RunReward {
  const p = structuredClone(profile());
  const { xpGain, tokenGain, breakdown } = computeReward(score, opts);

  p.xp += xpGain;
  p.tokens += tokenGain;
  p.stats.gamesPlayed += 1;
  p.stats.totalScore += score;
  p.stats.perGamePlays[gameId] = (p.stats.perGamePlays[gameId] ?? 0) + 1;

  let leveledUp = false;
  while (p.xp >= xpForLevel(p.level)) {
    p.xp -= xpForLevel(p.level);
    p.level += 1;
    leveledUp = true;
  }

  profile.set(p);
  void persist();
  return { leveledUp, newLevel: p.level, xpGain, tokenGain, breakdown };
}

export function addTokens(n: number): void {
  profile.update((p) => ({ ...p, tokens: p.tokens + n }));
  void persist();
}

/** Accumulate active play time (ms). Debounced persistence handled by callers. */
export function addPlayTime(ms: number): void {
  if (ms <= 0) return;
  profile.update((p) => ({ ...p, stats: { ...p.stats, playTimeMs: p.stats.playTimeMs + ms } }));
  void persist();
}

export function unlock(id: string): void {
  if (profile().unlocks.includes(id)) return;
  profile.update((p) => ({ ...p, unlocks: [...p.unlocks, id] }));
  void persist();
}
