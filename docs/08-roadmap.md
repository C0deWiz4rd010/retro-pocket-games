# 08 — Roadmap

Incremental delivery. **Every completed feature is committed and pushed to `develop`.**
Releases are deployed to GitHub Pages from CI. Each phase has a quality gate that must be green
before moving on.

## Phases

### Phase 0 — Tooling & foundation
- Vite + TypeScript (strict, no `any`), path aliases.
- ESLint + Prettier (incl. `@typescript-eslint/no-explicit-any: error`).
- Vitest (unit) + Playwright (E2E smoke) scaffolding.
- GitHub Actions: lint + test + build on push; **Pages deploy** workflow.
- Folder structure from [03 §2](03-architecture.md); `index.html` app shell.
- **Gate:** `npm run lint && npm test && npm run build` green in CI; empty app boots.

### Phase 1 — Design system & shell
- CSS tokens + 4 themes; self-hosted fonts; ScreenFX (CSS layer); base UI components.
- Shell (Console skin) + Clean Launcher skin + skin toggle; SideNav; Home dashboard; hash
  Router; Settings (theme/skin/FX); BIOS boot.
- **Gate:** themes/skins switch live; nav + routing work; Lighthouse a11y ≥ 90 on shell.

### Phase 2 — Core engine
- PixiManager (virtual resolution, DPR cap, letterbox, resize); GameLoop (fixed timestep);
  Scene + SceneManager (FSM); InputManager (keyboard+touch+gamepad); AudioManager +
  ChiptuneSynth; reactive store; data layer (idb + zod + migrations); Haptics; Registry.
- **Gate:** a throwaway "hello scene" runs at 60 FPS with input + sound + pause overlay.

### Phase 3 — Kits + first games
- Build **GridKit** + **PaddleKit**.
- Ship **Snake, Tetris, 2048** (GridKit) and **Pong, Breakout** (PaddleKit) — each with
  tutorial/pause/game-over/score persistence + unit-tested core.
- **Gate:** 5 games fully playable on mobile + desktop; core logic unit tests pass.

### Phase 4 — More kits + games
- Build **ShooterKit, VectorKit, SideScrollKit**.
- Ship **Space Invaders, Asteroids, Flappy Bird, Minesweeper, Pac-Man**.
- **Gate:** 10 games done (the original MVP list); offline play works for played games.

### Phase 5 — Complete the catalog (games 11–20)
- **Frogger, Galaga, Centipede, Missile Command, Bomberman, Q\*bert, Doodle Jump, Simon,
  Lunar Lander, Tron.**
- **Gate:** all **20** games shipped, each passing the [04 definition-of-done](04-games.md).

### Phase 6 — PWA, offline & performance
- Manifest + icons/splash; Workbox SW (precache shell + runtime cache games); install banner;
  orientation handling; wake-lock; full offline; perf pass to budget.
- **Gate:** installable; airplane-mode playable; Lighthouse PWA + Perf > 90; 60 FPS on 6a.

### Phase 7 — Meta features & polish
- Profile/XP/tokens; achievements (20+); daily challenge + streaks; save-states; local
  leaderboards + share-cards; cosmetics/unlocks; i18n (EN/DE); CRT full shader; transitions.
- **Gate:** daily challenge deterministic & shareable; achievements fire; saves resume.

### Phase 8 — QA, accessibility & release
- Cross-device testing (iOS Safari, Android Chrome, desktop); a11y audit; Lighthouse;
  Playwright E2E green; docs updated.
- **Release:** merge `develop → main`; tag; GitHub Pages live.

## Backlog (Kanban-style)

> Single source of task truth. Move items Backlog → In-Progress → Done; sync to GitHub Issues
> when convenient.

**Now / In-Progress**
- [ ] Phase 0 tooling + CI + Pages workflow
- [ ] Phase 1 design system & shell

**Next**
- [ ] Core engine (Phase 2)
- [ ] GridKit + PaddleKit + first 5 games (Phase 3)

**Later**
- [ ] Remaining kits + games (Phases 4–5)
- [ ] PWA/offline/perf (Phase 6)
- [ ] Meta features (Phase 7)
- [ ] QA + release to Pages (Phase 8)

**Icebox (post-v1)**
- [ ] Replays/ghosts; online leaderboards/cloud sync; 2P online; level editors; more themes.

## Milestones

| Milestone | Definition |
|-----------|------------|
| **M1 Foundation** | Phases 0–1 done; shell live on Pages |
| **M2 Playable** | Phase 3; first 5 games shippable |
| **M3 MVP-10** | Phase 4; original 10 games + offline |
| **M4 Full-20** | Phase 5; all 20 games |
| **M5 App-grade** | Phases 6–7; PWA + meta features |
| **M6 Release** | Phase 8; main + Pages release, docs current |

## Quality gates (apply every phase)
- TypeScript strict, **no `any`**; ESLint clean.
- Unit tests for any new `core/` logic; Playwright smoke still green.
- No regression below the [performance budget](05-pwa-mobile.md#6-performance-budget).
- Docs updated when behavior/architecture changes.
