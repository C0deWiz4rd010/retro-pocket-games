<div align="center">

# RETRO POCKET

### A pocket arcade in your browser - 70 retro games, one installable PWA.

[![Play Now](https://img.shields.io/badge/PLAY_NOW-GitHub_Pages-00f7ff?style=for-the-badge)](https://c0dewiz4rd010.github.io/retro-pocket-games/)
[![PWA](https://img.shields.io/badge/PWA-installable-7b2ff7?style=for-the-badge)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](#)
[![PixiJS](https://img.shields.io/badge/PixiJS-v8-e91e63?style=for-the-badge)](#)

</div>

---

**Retro Pocket** is a mobile-first, offline-capable web platform that bundles **70 classic and original retro games** into a single installable Progressive Web App. It is designed to feel like a native handheld console with switchable device shells, CRT screen effects, chiptune sound, touch controls, achievements, and a daily challenge, while still running entirely in the browser.

## Highlights

- **70 games across 8 categories** - the arcade canon plus a growing library of puzzle, memory, reaction, shooter, and neon-style original games in one installable app.
- **Two skins, four shells** - switch between a *Clean Launcher* and a *Handheld Console* shell with selectable **Brick / Slim / Wide / TV** housings.
- **Mobile-first & installable** - fullscreen PWA, safe-area aware, touch controls, haptics, orientation handling, and fully playable **offline**.
- **Retro feel** - toggleable CRT/scanline screen effects, neon themes, pixel fonts, and 8-bit chiptune SFX.
- **Meta-progression** - XP, levels, arcade tokens, 20+ achievements, daily challenge streaks, local leaderboards, and shareable score cards.
- **Built for performance** - Vanilla TypeScript (strict), PixiJS v8, code-split per game, targeting 60 FPS on mid-range mobile and Lighthouse > 90.

## Tech Stack

| Area | Choice |
|------|--------|
| Language | Vanilla **TypeScript** (ES2022, strict) |
| Renderer | **PixiJS v8** (WebGL + WebGPU) |
| Build | **Vite** + `vite-plugin-pwa` (Workbox) |
| State | Custom lightweight reactive store + event bus |
| Storage | **IndexedDB** (`idb-keyval`) + `zod` schemas |
| Audio | Web Audio API (custom ChiptuneSynth) |
| Testing | Vitest (logic) + Playwright (E2E smoke) |

## Getting Started

```bash
npm install
npm run dev
npm run build
npm run preview
npm run test
npm run lint
```

## Verification

A dependency-free CDP smoke test (`node scripts/smoke.mjs <url>`) launches headless Chrome against the built app, asserts the shell and game tiles mount, and reports any console errors.

## Documentation

The full design and engineering plan lives in [`docs/`](docs/):

| Doc | Topic |
|-----|-------|
| [00 - Vision](docs/00-vision.md) | Vision, branding, goals, personas |
| [01 - Design System](docs/01-design-system.md) | Themes, typography, shell, CRT, a11y |
| [02 - UX Flows](docs/02-ux-flows.md) | Navigation, wireframes, touch controls |
| [03 - Architecture](docs/03-architecture.md) | Stack, folder layout, engine-kits |
| [04 - Games](docs/04-games.md) | Catalog overview + flagship game specs |
| [05 - PWA & Mobile](docs/05-pwa-mobile.md) | Manifest, offline, performance budget |
| [06 - Features](docs/06-features.md) | Progression, achievements, daily challenge |
| [07 - Data Model](docs/07-data-model.md) | IndexedDB stores & schemas |
| [08 - Roadmap](docs/08-roadmap.md) | Phases, backlog, quality gates |
| [09 - Decisions](docs/09-decisions.md) | Architecture Decision Records |
| [10 - Testing & Quality](docs/10-testing-quality.md) | Test strategy, Lighthouse targets |

## Project Conventions

- Active development happens on the **`develop`** branch; **`main`** is the released branch.
- Work is pushed to `develop` after every completed feature.
- Releases are deployed to **GitHub Pages** via GitHub Actions.

## License

MIT © C0deWiz4rd010

---

<div align="center"><sub>Built with care and far too much nostalgia.</sub></div>
