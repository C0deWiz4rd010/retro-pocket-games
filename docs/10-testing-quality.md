# 10 — Testing & Quality

Quality is a feature. The logic/render split exists largely to make testing cheap.

## 1. Test strategy (the pyramid)

```
        ▲  E2E (Playwright)        — few: boots, navigates, launches a game, scores persist
       ▲▲  Integration             — some: kit + view wiring, store ↔ db round-trips
      ▲▲▲  Unit (Vitest)           — many: pure game core logic, utils, reducers
```

### Unit (Vitest) — the bulk
- Test every game's **`core/`** logic headless (no Pixi): movement, collisions, scoring, line
  clears, ghost AI transitions, merge rules, win/lose conditions.
- Leverage **determinism**: feed a fixed `seed` + scripted `inputStream`, assert exact end
  state/score. Snapshot deterministic sequences.
- Test `utils/` (rng distribution/repeatability, collision, pool) and `store`/`data` (zod
  validation, migrations, export/import round-trip).

### Integration
- Kit + minimal view: a kit drives a fake view, assert render calls/state sync.
- Store ↔ IndexedDB (fake-indexeddb) round-trip incl. migration from an old version blob.

### E2E (Playwright) — smoke, on real built app
- App boots (BIOS skippable) → Home renders.
- Open SideNav → launch a game → pause → resume → game-over → score shows on tile.
- Theme + skin toggle persists across reload.
- PWA: manifest served, service worker registers, offline reload still loads the shell.

## 2. Quality gates (CI on every push to `develop`)

1. `npm run lint` — ESLint clean; **`no-explicit-any` is an error**; no unused, no floating
   promises.
2. `tsc --noEmit` — strict type-check passes.
3. `npm test` — Vitest unit/integration green; coverage tracked (target ≥ 80% on `core/` +
   `utils/`).
4. `npm run build` — production build succeeds within bundle budget.
5. `npm run e2e` — Playwright smoke green (against the built preview).

A push that fails any gate does not get deployed.

## 3. Performance verification

- **Lighthouse CI** (mobile profile) in the pipeline; assert > 90 on Performance,
  Accessibility, Best Practices, PWA (budgets fail the build).
- **In-app FPS meter** (dev only) + a manual pass on a real **Pixel 6a**: sustained 60 FPS, no
  drops < 50 in normal play; input latency < 50 ms.
- **Bundle analysis** (`rollup-plugin-visualizer`) to guard the home/per-game budgets in
  [05 §6](05-pwa-mobile.md#6-performance-budget).

## 4. Accessibility audit

- Automated: axe (via Playwright) on shell, home, settings, pause, game-over.
- Manual: keyboard-only navigation of all menus; visible focus; screen-reader labels on
  controls; contrast ≥ 4.5:1 (7:1 in high-contrast mode); `prefers-reduced-motion` disables
  non-essential animation; colorblind palettes never rely on color alone.
- Touch: all targets ≥ 44 px; left-hand layout verified.

## 5. Cross-device matrix (manual, pre-release)

| Platform | Browser | Checks |
|----------|---------|--------|
| iPhone (notch) | Safari | safe-area, no bounce/zoom, rotate-prompt, install to home |
| Android mid (Pixel 6a) | Chrome | 60 FPS, fullscreen, orientation lock, haptics, offline |
| iPad / tablet | Safari | fixed side-nav rail, landscape games |
| Desktop | Chrome/Firefox | keyboard + gamepad, full CRT shader, large layout |

## 6. Definition of Done (per feature/PR)

- [ ] Lint + types + unit + (relevant) E2E pass locally and in CI.
- [ ] New `core/` logic has unit tests; deterministic.
- [ ] No regression below performance/a11y budgets.
- [ ] Works on mobile (touch) and desktop (keyboard); offline-safe if applicable.
- [ ] Docs updated if architecture/behavior changed.
- [ ] Committed and **pushed to `develop`**.

## 7. Tooling summary

| Purpose | Tool |
|---------|------|
| Unit/integration | Vitest (+ `fake-indexeddb`, `@vitest/coverage-v8`) |
| E2E / a11y | Playwright (+ axe) |
| Lint/format | ESLint (`@typescript-eslint`) + Prettier |
| Types | `tsc --noEmit` (strict) |
| Perf | Lighthouse CI, rollup-plugin-visualizer |
| CI/CD | GitHub Actions → GitHub Pages |
