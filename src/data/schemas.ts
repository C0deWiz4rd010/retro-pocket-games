import { z } from 'zod';

/** Bump when any persisted shape changes; drives migrations in migrations.ts. */
export const SCHEMA_VERSION = 1;

export const ThemeId = z.enum(['cyberpunk', 'gameboy', 'c64', 'amber']);
export type ThemeId = z.infer<typeof ThemeId>;

export const SkinId = z.enum(['console', 'launcher']);
export type SkinId = z.infer<typeof SkinId>;

/** Console housing shapes (gamepad mode). See docs/01 §4. */
export const ShellId = z.enum(['brick', 'slim', 'wide', 'tv']);
export type ShellId = z.infer<typeof ShellId>;

export const SettingsSchema = z.object({
  theme: ThemeId.default('cyberpunk'),
  skin: SkinId.default('console'),
  shell: ShellId.default('brick'),
  screenFx: z
    .object({
      mode: z.enum(['off', 'css', 'full']).default('css'),
      intensity: z.number().min(0).max(1).default(0.6),
    })
    .default({ mode: 'css', intensity: 0.6 }),
  audio: z
    .object({
      master: z.number().min(0).max(1).default(0.7),
      sfx: z.boolean().default(true),
      music: z.boolean().default(true),
      muteOnBlur: z.boolean().default(true),
    })
    .default({ master: 0.7, sfx: true, music: true, muteOnBlur: true }),
  controls: z
    .object({
      touchLayout: z.enum(['right', 'left']).default('right'),
      tilt: z.boolean().default(false),
      haptics: z.boolean().default(true),
    })
    .default({ touchLayout: 'right', tilt: false, haptics: true }),
  a11y: z
    .object({
      reducedMotion: z.boolean().default(false),
      highContrast: z.boolean().default(false),
      colorblind: z.enum(['off', 'protan', 'deutan', 'tritan']).default('off'),
      largeTargets: z.boolean().default(false),
    })
    .default({ reducedMotion: false, highContrast: false, colorblind: 'off', largeTargets: false }),
  locale: z.enum(['en', 'de']).default('en'),
  bios: z
    .object({ showEachLaunch: z.boolean().default(false) })
    .default({ showEachLaunch: false }),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const ProfileSchema = z.object({
  xp: z.number().int().nonnegative().default(0),
  level: z.number().int().positive().default(1),
  tokens: z.number().int().nonnegative().default(0),
  unlocks: z.array(z.string()).default([]),
  stats: z
    .object({
      gamesPlayed: z.number().int().nonnegative().default(0),
      totalScore: z.number().int().nonnegative().default(0),
      playTimeMs: z.number().nonnegative().default(0),
      perGamePlays: z.record(z.string(), z.number()).default({}),
    })
    .default({ gamesPlayed: 0, totalScore: 0, playTimeMs: 0, perGamePlays: {} }),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const GameScoresSchema = z.object({
  best: z.number().default(0),
  lastPlayed: z.number().default(0),
  history: z
    .array(z.object({ score: z.number(), at: z.number() }))
    .default([]),
  custom: z.record(z.string(), z.number()).optional(),
});
export type GameScores = z.infer<typeof GameScoresSchema>;

export const AchievementsSchema = z.object({
  unlocked: z.record(z.string(), z.number()).default({}),
  progress: z.record(z.string(), z.number()).default({}),
});
export type Achievements = z.infer<typeof AchievementsSchema>;

/** Local leaderboard per game — top entries with a player-entered name. */
export const LeaderboardSchema = z.object({
  entries: z
    .array(z.object({ name: z.string(), score: z.number(), at: z.number() }))
    .default([]),
});
export type Leaderboard = z.infer<typeof LeaderboardSchema>;

/** Lightweight player prefs: favorite games + which tutorials have been seen. */
export const PrefsSchema = z.object({
  favorites: z.array(z.string()).default([]),
  tutorialsSeen: z.array(z.string()).default([]),
});
export type Prefs = z.infer<typeof PrefsSchema>;

export const DailySchema = z.object({
  lastPlayedDate: z.string().default(''),
  streak: z.number().int().nonnegative().default(0),
  bestStreak: z.number().int().nonnegative().default(0),
  results: z
    .record(
      z.string(),
      z.object({ gameId: z.string(), score: z.number(), modifier: z.string() }),
    )
    .default({}),
});
export type Daily = z.infer<typeof DailySchema>;
