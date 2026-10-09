# Performance baseline (before the perfection plan)

Measured 2026-10-09 on branch `develop` @ `db390f2` (plus Phase 0 tooling only). Compare against
this after Phase 2 and at release.

## Bundle (`npm run build`, `dist/`)

| Chunk                | Raw    | Gzip     | Note                                          |
| -------------------- | ------ | -------- | --------------------------------------------- |
| `pixi-*.js`          | 509 KB | 146.5 KB | Loaded before the home screen (modulepreload) |
| `index-*.js` (main)  | 239 KB | 72.6 KB  | Registry, both locales, zod, UI               |
| `index-*.css`        | 55 KB  | 10.9 KB  | Single stylesheet                             |
| `conceptArcade-*.js` | 38 KB  | 13.7 KB  | 12 games share it                             |

`dist/` total: 1.6 MB, 95 files in `dist/assets`. Initial critical path = main + pixi + css ≈ 230 KB gzip.

## Runtime (Playwright, system Chrome, SwiftShader GL)

- Boot at 320×568, 375×812, 768×1024, 1440×900 and 812×375: no console errors, no horizontal scroll.
- All 85 games start, run 3 s and tear down without console errors (8.3 min total).
- JS heap across 85 mount/unmount cycles (after a 3-game warm-up): 5.4 MB → 13.0 MB (+7.6 MB).

## Not yet measured

Lighthouse mobile scores and in-game FPS on real devices are collected in Phase 10 (needs hardware;
SwiftShader FPS is not representative).

## How to reproduce

```bash
npm run build && npx playwright test
```

---

## After Phase 2 (engine performance)

| Metric                                    | Before                                               | After                                                                    |
| ----------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| Entry chunk (main, gzip)                  | 72.6 KB                                              | 54.5 KB                                                                  |
| Pixi + GameHost on the home critical path | 146.5 KB gzip, `modulepreload`ed                     | off the path; fetched when idle (skipped on Data Saver) or on first play |
| Render loop in menus                      | ticker running at display refresh, CRT filter active | stopped; filter removed                                                  |
| `dist/` precache                          | 1.6 MB, plus a duplicate `/assets/` runtime cache    | 1.7 MB (198 entries), single cache                                       |

Behaviour changes worth knowing:

- HUD writes happen only on real changes; pulses no longer force a reflow.
- `GameHost` stops/starts the Pixi ticker per game; ScreenFX only runs while a game is on screen.
- PerfMonitor is relative to the display's refresh rate and steps down CRT shader → DPR 1.5 → DPR 1;
  the CRT downgrade is sticky for the session.
- Backdrops (`juice.drawBackdrop`, `conceptArcade.backdrop/city`) draw their static part once and
  animate at ~15 Hz in sibling layers; Pac-Man's dots live in their own on-demand layer.
- Jingles and menu music are scheduled on the Web Audio clock; the context suspends when muted in
  the background.
- Gamepads are only polled while one is connected.

Deliberately not done:

- **Fixed-step accumulator (2.7):** games draw inside `update()`, so sub-stepping would re-tessellate
  several times per frame on exactly the slow devices that need relief. Frame time is clamped
  instead (50 ms, 75 ms with a turbo modifier).
- **Lazy locale (2.4):** both dictionaries are ~8 KB gzip combined; async `t()` is not worth it.
