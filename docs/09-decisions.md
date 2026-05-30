# 09 — Architecture Decision Records (ADRs)

Short, dated records of *why* we chose what we chose. Append new ADRs; don't rewrite history —
supersede instead.

> Format: **ADR-NNN — Title** · *Status* · Context → Decision → Consequences.

---

## ADR-001 — No UI framework (Vanilla TypeScript)
**Status:** Accepted (2026-05)
**Context:** We want minimal bundle size, maximum control over rendering/perf, and a
portfolio-grade "from scratch" feel. The UI surface (nav, home, modals) is modest.
**Decision:** Build the UI in vanilla TS with small component functions / Web Components, no
React/Vue/Svelte.
**Consequences:** + Tiny bundle, no framework runtime, full control. − We hand-roll reactivity
(small `store.ts` signal primitive) and templating. Acceptable given scope.

## ADR-002 — Vite as the build tool
**Status:** Accepted (2026-05)
**Context:** Need fast HMR, first-class TS, easy code-splitting and a good PWA story.
**Decision:** Use Vite + `vite-plugin-pwa` (Workbox) over Webpack/Parcel.
**Consequences:** + Fast DX, native ESM, simple dynamic-import code-splitting, easy
`base` for GitHub Pages. − Slightly different prod (Rollup) vs dev engines; rarely an issue.

## ADR-003 — PixiJS v8 as the renderer
**Status:** Accepted (2026-05)
**Context:** 20 games need a performant 2D GPU renderer with sprites, particles, filters.
**Decision:** PixiJS v8 (WebGL/WebGPU). Use the modern API: `const app = new Application();
await app.init(...)`. Entities `extends Container` with a uniform `update(dt)` method. Use
`ParticleContainer` for particle-heavy scenes; atlases; cap DPR.
**Consequences:** + Mature, fast, great mobile story. − v8 API differs from v7 (async init,
import paths); contributors must use v8 patterns, not legacy `Pixi.Application` style.

## ADR-004 — Logic / render separation per game
**Status:** Accepted (2026-05)
**Context:** We want testable, deterministic games (for unit tests, the daily challenge and
future replays).
**Decision:** Each game splits into pure `core/` (no Pixi/DOM, injected RNG + dt) and `view/`
(Pixi). `(seed, inputStream)` fully determines a run.
**Consequences:** + Headless unit tests, deterministic daily, replay-ready. − A little extra
indirection per game; worth it.

## ADR-005 — Engine-kits over per-game engines
**Status:** Accepted (2026-05)
**Context:** Many of the 20 games share mechanics (grids, shooters, paddles…).
**Decision:** Six reusable kits (Grid/Shooter/Paddle/Vector/SideScroll/Standalone). GridKit
alone backs 9 games.
**Consequences:** + Big reuse, consistent feel, faster delivery. − Kits must stay general
enough; risk of over-abstraction — mitigated by building a kit only when ≥ 2 games need it.

## ADR-006 — IndexedDB via idb-keyval + zod
**Status:** Accepted (2026-05)
**Context:** Need async, larger-than-`localStorage`, structured local persistence with safe
schema evolution.
**Decision:** `idb-keyval` for a simple async KV over IndexedDB; **zod** to validate every read
and to power versioned migrations.
**Consequences:** + Robust, typed, future-proof saves; export/import is trivial. − zod adds a
small dep; validation cost is negligible at our volumes.

## ADR-007 — Custom Web Audio ChiptuneSynth (Howler optional)
**Status:** Accepted (2026-05)
**Context:** Want authentic 8-bit SFX with zero audio-asset weight and per-game flavor.
**Decision:** Hand-rolled Web Audio synth (oscillators + envelopes + tiny sequencer). Reserve
Howler.js only if/when we add streamed music tracks.
**Consequences:** + No audio downloads, infinite SFX variety, tiny. − We implement envelopes
ourselves; fine for chiptune.

## ADR-008 — Custom reactive store (no Redux/MobX)
**Status:** Accepted (2026-05)
**Context:** State needs are small (settings, profile, scores, HUD bindings).
**Decision:** A ~50-line `signal/computed/effect` primitive in `store.ts`.
**Consequences:** + Zero deps, tiny, ergonomic. − Fewer devtools than Redux; acceptable.

## ADR-009 — Render 2048 & Minesweeper in Pixi (not DOM)
**Status:** Accepted (2026-05)
**Context:** These two are grid/DOM-friendly, but mixing renderers complicates the shell,
ScreenFX (CRT), theming and the scene FSM.
**Decision:** Render them in Pixi like every other game (still using GridKit logic).
**Consequences:** + One renderer, uniform CRT/pause/transition behavior. − Slightly more work
than HTML tables; worth the consistency.

## ADR-010 — Hash-based routing
**Status:** Accepted (2026-05)
**Context:** Hosting is static (GitHub Pages); no server to rewrite deep links.
**Decision:** Hash router (`#/play/:id`).
**Consequences:** + Works on Pages with zero config, back-button friendly. − URLs contain `#`;
acceptable for an app.

## ADR-011 — Static hosting on GitHub Pages via Actions
**Status:** Accepted (2026-05)
**Context:** The app is 100% static and we want free, simple hosting tied to the repo.
**Decision:** Build in CI and deploy `dist/` to GitHub Pages (Actions). `vite base` =
`/retro-pocket-games/`.
**Consequences:** + Free, automatic, versioned with the repo. − Project-subpath base must be
respected by all asset URLs (handled by Vite + manifest relative paths).

## ADR-012 — Skins as a runtime mode (Console + Clean Launcher)
**Status:** Accepted (2026-05)
**Context:** User wants both the immersive handheld shell *and* a clean launcher.
**Decision:** Ship both as a toggleable skin in Settings; skins change only frame/chrome, never
game logic/controls.
**Consequences:** + Flexibility for all device sizes and tastes. − Two chrome layouts to
maintain; isolated from game code so cost is contained.
