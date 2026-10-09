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
