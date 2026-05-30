# 07 — Data Model

All persistence is **local** (IndexedDB via `idb-keyval`), namespaced, validated with **zod**,
and **versioned** so we can migrate old saves safely. No server, no accounts.

## 1. Storage layer

- `data/db.ts` wraps `idb-keyval` with a namespaced key helper: `rp:<store>:<key>`.
- Every read runs the value through its zod schema; invalid/missing → typed default (and a
  console warning). Writes are debounced where high-frequency (e.g. live score during play is
  in-memory; only the *final* high score persists).
- A top-level `meta` record stores the schema `version` for migrations.

```ts
// shape of the layer
get<T>(store, key, schema, fallback): Promise<T>
set<T>(store, key, value): Promise<void>
del(store, key): Promise<void>
keys(store): Promise<string[]>
```

## 2. Stores & schemas (zod)

```ts
// meta
RpMeta = { version: number; createdAt: number; updatedAt: number }

// settings  (single record)
Settings = {
  theme: 'cyberpunk'|'gameboy'|'c64'|'amber';
  skin: 'console'|'launcher';
  screenFx: { mode: 'off'|'css'|'full'; intensity: number /*0..1*/ };
  audio: { master: number; sfx: boolean; music: boolean; muteOnBlur: boolean };
  controls: {
    keymap: Record<Action, string[]>;
    touchLayout: 'right'|'left';      // handedness
    touchPositions?: Record<string, {x:number;y:number}>;
    tilt: boolean; haptics: boolean;
  };
  a11y: { reducedMotion: boolean; highContrast: boolean;
          colorblind: 'off'|'protan'|'deutan'|'tritan'; largeTargets: boolean };
  locale: 'en'|'de';
  bios: { showEachLaunch: boolean; message: string };
}

// profile  (single record)
Profile = {
  xp: number; level: number; tokens: number;
  unlocks: string[];                 // unlocked theme/skin/cosmetic ids
  stats: { gamesPlayed: number; totalScore: number;
           perGamePlays: Record<GameId, number>; favorite?: GameId };
}

// scores  (key = gameId)
GameScores = {
  best: number;
  lastPlayed: number;
  history: { score: number; at: number }[];   // capped (e.g. 50)
  custom?: Record<string, number>;            // game-specific bests (e.g. maxLevel)
}

// leaderboards  (key = gameId) — local top 10
Leaderboard = { entries: { name: string; score: number; at: number }[] }  // len ≤ 10

// saves  (key = gameId) — one resume slot per game
SaveState = {
  gameId: GameId; version: number;
  seed: number; elapsedMs: number;
  state: unknown;                    // game-specific, validated by the game's own schema
  savedAt: number;
}

// achievements  (single record)
Achievements = {
  unlocked: Record<string, number>;  // achievementId → unlockedAt
  progress: Record<string, number>;  // for incremental achievements
}

// daily  (single record)
Daily = {
  lastPlayedDate: string;            // YYYY-MM-DD
  streak: number; bestStreak: number;
  results: Record<string /*date*/, { gameId: GameId; score: number; modifier: string }>;
}
```

`GameId` is the union of the 20 ids from [04 — Games](04-games.md). `Action` is the input
action union from [03 — Architecture](03-architecture.md).

## 3. Determinism contract (for daily & replays)

- Game `core` never calls `Math.random()` or reads the clock directly. It receives a **seeded
  RNG** (`utils/rng`, e.g. mulberry32/xorshift) and a **dt** each step.
- Therefore `(seed, inputStream)` fully determines a run → daily fairness + replays
  (see [06 §3/§6](06-features.md)).

## 4. Versioning & migrations

- `data/migrations.ts` holds an ordered list of `(from→to)` transforms applied on load when
  `meta.version` is behind `CURRENT_VERSION`.
- Save-states carry their own `version`; an incompatible save is discarded gracefully (Continue
  hidden) rather than crashing.
- **Export/Import:** Settings → export all stores as a single JSON blob; import validates with
  zod + runs migrations. Enables backup and device transfer without a server.

## 5. Privacy

- 100% on-device. No analytics, no network calls except loading the app's own static assets.
- "Reset progress" wipes all `rp:*` keys; "Export" lets the player keep their data.
