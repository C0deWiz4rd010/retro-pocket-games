# Arcade kit (`src/kits/arcade/`)

Shared building blocks for the canvas games. Prefer these over hand-rolled copies.

| Module         | What it gives you                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `particles.ts` | `Particles` — pooled particle system (one array, recycled objects, one draw pass). Uses `fxRandom()`.    |
| `starfield.ts` | `Starfield` — two cached parallax layers; `update(dt)` for drift, `setScroll(y)` for vertical scrollers. |
| `glow.ts`      | `glowCircle`, `glowRect` (stacked translucent shapes), `bevelBlock` (chunky tile), `mix` (colour blend). |
| `constants.ts` | `DIRS`, `PIXEL_FONT`, `pixelText()`.                                                                     |
| `combo.ts`     | `Combo` — chain counter with a decay window and capped multiplier.                                       |
| `guard.ts`     | `once(fn)` — run-once guard for game-over style paths.                                                   |
| `grid.ts`      | `cellAt`, `cellOrigin`, `rectsOverlap`.                                                                  |
| `juice.ts`     | Spark helpers + cached backdrop layers used by the neon "concept" games.                                 |
| `concept.ts`   | Palette, `makeLayer`, `backdrop`, `city`, `boxHit` shared by the twelve neon concept games.              |

## Rules of thumb

- **Cosmetic randomness is `fxRandom()`**, never `ctx.rng`. Sparks and star re-seeding that consume the
  seeded RNG make daily-challenge runs diverge between devices (and ESLint bans `Math.random` in games).
- **No per-frame dice rolls** (`rng.next() < dt * x`). They make outcomes depend on the frame rate. Use a
  timer that is re-armed with the RNG when it fires.
- **Screen shake / hit-stop go through `ctx.fx`** (`screenShake`, `hitStop`). Both respect reduced motion.
- **Game time, not wall time**: use an accumulated `clock += dt` instead of `performance.now()` so pause works.
- Pure rules live in `core.ts` next to the game (see `breakout`, `invaders`, `centipede`, `snake`, `sudoku`)
  and get unit tests.

## Decisions

- **Fixed-timestep accumulator (plan 2.7): not adopted.** Games draw inside `update()`, so sub-stepping would
  re-tessellate every frame several times on exactly the devices that can least afford it. Instead the host
  clamps `dt` (50 ms, 75 ms with turbo); pac-man moves cell-to-cell (`travel()`) so it cannot tunnel through walls,
  and breakout resolves ball/brick overlap on the axis of least penetration.
- **`Game.resize` (plan 7.4): dropped.** Games run in a fixed virtual resolution that `PixiManager` scales and
  letterboxes, so a game never sees its canvas size change.

## Emoji sprite

`node scripts/build-emoji-sprite.mjs` (`npm run emoji:sprite`) packs `public/emoji/*.svg` into
`public/emoji/sprite.svg`; `glyphEl()` references symbols with `<use href="…/sprite.svg#e-XXXX">`, so the home
screen makes one request instead of one per glyph. Re-run it after refreshing the emoji set.
