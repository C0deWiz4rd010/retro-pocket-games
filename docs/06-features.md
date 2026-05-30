# 06 — Features (Meta layer & polish)

These cross-cutting features turn 20 separate games into one cohesive, sticky product.

## 1. Player profile & progression

- **XP & Levels:** every game grants XP (scaled by score/achievements). XP → level; levels are
  purely cosmetic prestige + unlock gates for skins.
- **Arcade Tokens 🪙:** a soft currency earned by playing/achievements, spent on cosmetic
  unlocks (themes, shell skins, cover art, BIOS messages). Never pay-to-win, never real money.
- **Profile screen:** level + XP bar, total tokens, lifetime stats (games played, total score,
  favorite game, current streak), achievement showcase.
- All local, no account. Stored in `store/profile` → IndexedDB.

## 2. Achievements (20+ badges)

- A declarative registry: `{ id, title, desc, icon, gameId?, predicate, secret? }`.
- Games emit events (`score`, `lineClear`, `ghostEaten`, …); an achievement engine evaluates
  predicates and unlocks badges with a toast + token reward.
- Mix of per-game (e.g. *Snake: length 50*, *Pac-Man: 4 ghosts on one pellet*, *Tetris: a
  Tetris*) and meta (*play all 20 games*, *7-day daily streak*, *unlock every theme*).
- Showcased on profile + a dedicated Achievements screen (locked = silhouette; secret = hidden).

## 3. Daily Challenge

- One game per day chosen by a **date-seeded** PRNG, with a **modifier** (e.g. *Tetris ×2
  speed*, *Snake: wrap walls off + double food*, *Asteroids: one life*).
- Because game logic is **deterministic** with a seeded RNG (see [03 §3](03-architecture.md)),
  every player gets the *same* daily board → fair local leaderboard + shareable result.
- **Streaks:** consecutive days played; streak shown on Home with 🔥; milestone token rewards.
- Result is a shareable score-card (see §5).

## 4. Save-states (resume anywhere)

- Pause → **Save & Quit** serializes the game's `core` state (plus seed + elapsed) via a zod
  schema and stores it per game.
- Home shows a **Continue** row for games with a save; opening resumes exactly.
- Essential for mobile (interruptions). One slot per game (auto-overwrite) for v1.

## 5. Leaderboards & shareable score-cards

- **Local leaderboards** per game (top 10 with date). No server in v1.
- **Score-cards:** render a themed PNG (game cover + score + rank + date + neon frame) on an
  offscreen canvas, then **Web Share API** (`navigator.share`) on mobile, or download/copy as
  fallback. Great for social proof; entirely client-side.

## 6. Replays / Ghosts *(stretch)*

- Because runs are deterministic, we can record the **input stream + seed** and replay it.
- Enables ghost runs (race your best) and shareable replay codes. Marked stretch — ships after
  the core 20 are solid.

## 7. BIOS boot sequence

- A short, skippable retro boot screen on first launch (and optionally each launch, in
  Settings): typing-FX "POST" lines, cartridge count, blinking cursor (see
  [02 wireframe](02-ux-flows.md)). Unlockable alternate BIOS messages via tokens.

## 8. Sound design

- **`ChiptuneSynth`** (Web Audio): square/triangle/noise oscillators + envelopes for authentic
  8-bit SFX, defined per game (no audio asset weight). A tiny note/pattern sequencer drives
  short jingles (level-up, game-over) and an optional menu chiptune loop.
- Global controls: master volume, SFX/music toggles, mute on blur. Howler.js is an *optional*
  add-on only if we later want streamed music tracks.

## 9. Settings (single source of player preference)

- **Appearance:** theme (4), **skin (Console / Clean Launcher)**, ScreenFX (Off/CSS/Full +
  intensity), font size.
- **Audio:** master / SFX / music, mute-on-blur.
- **Controls:** remap keys, reposition touch controls, left/right-hand layout, tilt on/off,
  haptics on/off.
- **Accessibility:** reduced motion, high contrast, colorblind palette, larger tap targets.
- **Data:** language (EN/DE), export/import save data (JSON), reset progress.

## 10. Internationalization (i18n)

- Lightweight `t(key, vars)` with `en` + `de` dictionaries (user is German). Language in
  Settings, auto-detected from `navigator.language` on first run. Game *names* stay canonical;
  UI/help strings are translated.

## Feature → store/data mapping

| Feature | Store | Persisted shape (see [07](07-data-model.md)) |
|---------|-------|-----------|
| Profile/XP/tokens | `store/profile` | `profile` |
| Achievements | `store/achievements` | `achievements` |
| High scores/leaderboards | `store/scores` | `scores`, `leaderboards` |
| Save-states | (per-game) | `saves` |
| Daily challenge/streak | `store/daily` | `daily` |
| Settings/i18n | `store/settings` | `settings` |
