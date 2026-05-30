import { signal } from './store';
import { read, write } from '@data/db';
import { ProfileSchema, type Profile } from '@data/schemas';

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

/** Award XP + tokens after a run, level up as needed, and persist. */
export function awardRun(gameId: string, score: number): { leveledUp: boolean; newLevel: number } {
  const p = structuredClone(profile());
  const xpGain = Math.max(5, Math.floor(score / 10));
  const tokenGain = Math.max(1, Math.floor(score / 100));

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
  return { leveledUp, newLevel: p.level };
}

export function addTokens(n: number): void {
  profile.update((p) => ({ ...p, tokens: p.tokens + n }));
  void persist();
}

export function unlock(id: string): void {
  if (profile().unlocks.includes(id)) return;
  profile.update((p) => ({ ...p, unlocks: [...p.unlocks, id] }));
  void persist();
}
