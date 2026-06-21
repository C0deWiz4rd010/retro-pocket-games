# 00 - Vision & Branding

## Elevator pitch

> **Retro Pocket** is a pocket arcade that lives in your browser. One installable app, dozens of hand-crafted retro and original games, zero downloads from a store, and full offline play. It looks and feels like a native handheld console, but it is built on the open web.

## The problem we're solving

Classic arcade games are scattered across ad-heavy sites, abandoned Flash ports, or native
apps that demand installs and permissions. There is no single, beautiful, fast, offline-first
place to play the canon of retro games on a phone. Retro Pocket is that place.

## Product principles

1. **Mobile-first, not mobile-also.** Every screen is designed for a thumb first and a mouse second.
2. **Feels native.** Installable, fullscreen, offline, haptic, no rubber-band scroll, no accidental zoom.
3. **Fast or it does not ship.** Home loads quickly, games hold 60 FPS, and every game is lazy-loaded.
4. **Authentic, not kitsch.** Retro aesthetics are flavorful but never allowed to hurt readability.
5. **Respect the player.** No ads, no dark patterns, no accounts required. Data stays local.

## Brand: "RETRO POCKET"

- **Name:** Retro Pocket. Internal device codename: **RP**.
- **Tagline:** *"Eighty-five games. One pocket."*
- **Personality:** nostalgic, playful, crafted, and a little neon.
- **Logo concept:** a stylized handheld silhouette with a glowing screen; the "O" in POCKET can double as a D-pad or power button.

### Two faces, one app

Retro Pocket ships with **two interchangeable skins**, switchable in Settings:

- **Handheld Console** - immersive device shell with bezel, speaker grille, branding, power LED, and tactile controls.
- **Clean Arcade Launcher** - chromeless launcher and dashboard with more space for browsing and progression.

The skin changes the frame and chrome, not the gameplay itself.

## Target users

| Persona | Context | What they want |
|---------|---------|----------------|
| **Commuter Casey** | 25, plays on the train, spotty signal | Quick sessions, offline, resume-where-I-left-off |
| **Nostalgic Nina** | 38, grew up on arcades | Authentic feel, recognizable classics, satisfying SFX |
| **Completionist Cole** | 19, leaderboard chaser | High scores, achievements, daily challenge, streaks |
| **Tinkerer Tom** | 30, dev, reads the source | Clean code, strict TS, solid docs, hackable systems |

## Goals & non-goals

**Goals**

- 70 polished retro and original games in a single installable PWA.
- Native-grade mobile feel with offline play, fullscreen behavior, haptics, and save-state friendly UX.
- A cohesive meta layer with XP, achievements, daily challenge, and leaderboards.
- A codebase clean enough to serve as a portfolio and reference project.

**Non-goals (for v1/vcurrent architecture)**

- Online multiplayer, accounts, or cloud sync.
- A backend server; the app remains static and GitHub Pages friendly.
- ROM-accurate emulation; these are faithful re-implementations, not emulators.
- Monetization, ads, or telemetry.

## Success criteria

- **Performance:** Lighthouse mobile > 90 across Performance, Accessibility, Best Practices, and PWA.
- **Quality:** TypeScript strict, no `any` creep, tested core logic, and green smoke coverage.
- **Feel:** Installs to home screen, launches cleanly, works in airplane mode, and feels native on mobile browsers.
- **Completeness:** the shipped catalog includes pause, tutorial, game-over flow, and persisted scoring.

## One-line for the README

*A pocket arcade in your browser - 70 retro games, one installable PWA.*
