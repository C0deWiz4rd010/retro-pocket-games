# Retro Pocket — Documentation

This folder is the complete design and engineering plan for **Retro Pocket**, a mobile-first
PWA that bundles **20 retro arcade classics** into one installable app.

> Status: **Planning + active implementation.** These documents are the source of truth for
> what we are building and why. They are kept up to date as the code evolves.

## Index

| # | Document | What's inside |
|---|----------|---------------|
| 00 | [Vision & Branding](00-vision.md) | The product vision, the "Retro Pocket" brand, goals, target users, success criteria |
| 01 | [Design System](01-design-system.md) | Themes & palettes, typography, components, the handheld shell, CRT/screen FX, accessibility |
| 02 | [UX Flows](02-ux-flows.md) | Navigation, screen-flow diagram, ASCII wireframes, per-genre touch controls |
| 03 | [Architecture](03-architecture.md) | Tech stack rationale, folder structure, logic/render split, engine-kits, scene FSM, input abstraction |
| 04 | [Games](04-games.md) | All 20 game specifications (mechanics, controls, scope, assets) |
| 05 | [PWA & Mobile](05-pwa-mobile.md) | Manifest, service worker/offline, viewport/safe-area, orientation, haptics, performance budget |
| 06 | [Features](06-features.md) | Meta-progression, achievements, daily challenge, leaderboards, save-states, BIOS, i18n, sound |
| 07 | [Data Model](07-data-model.md) | IndexedDB stores, zod schemas, versioning & migrations |
| 08 | [Roadmap](08-roadmap.md) | Phases 0–8, backlog (Kanban-style), milestones, quality gates |
| 09 | [Decisions](09-decisions.md) | Architecture Decision Records (ADRs) |
| 10 | [Testing & Quality](10-testing-quality.md) | Test strategy, Lighthouse targets, performance, CI, accessibility audit |

## How to read this

- New to the project? Start with **00 → 01 → 02** to understand *what* and *how it feels*.
- Implementing? Read **03 → 04 → 07** for *how it's built*.
- Shipping/QA? See **05 → 08 → 10**.

## The 20 classics at a glance

Snake · Tetris · Pong · Breakout · Asteroids · Space Invaders · Pac-Man · Flappy Bird ·
2048 · Minesweeper · Frogger · Galaga · Centipede · Missile Command · Bomberman · Q\*bert ·
Doodle Jump · Simon · Lunar Lander · Tron Light Cycles
