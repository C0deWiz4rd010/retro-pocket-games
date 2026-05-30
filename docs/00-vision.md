# 00 — Vision & Branding

## Elevator pitch

> **Retro Pocket** is a pocket arcade that lives in your browser. One installable app, twenty
> hand-crafted retro classics, zero downloads from a store, fully playable offline. It looks
> and feels like a native handheld console — but it *is* the open web.

## The problem we're solving

Classic arcade games are scattered across ad-riddled sites, abandoned Flash ports, or native
apps that demand installs and permissions. There is no single, beautiful, fast, offline-first
place to play the canon of retro games on a phone. Retro Pocket is that place.

## Product principles

1. **Mobile-first, not mobile-also.** Every screen is designed for a thumb first, a mouse
   second. Touch targets ≥ 44 px, primary actions in the thumb zone.
2. **Feels native.** Installable, fullscreen, offline, haptic, no rubber-band scroll, no
   accidental zoom. On the home screen it's indistinguishable from a store app.
3. **Fast or it doesn't ship.** Home loads in < 1 s; games hold 60 FPS on mid-range Android.
   Each game is code-split and lazy-loaded.
4. **Authentic, not kitsch.** Retro aesthetics (CRT, neon, chiptune) are tasteful and always
   *toggleable* — never at the cost of readability or accessibility.
5. **Respect the player.** No ads, no dark patterns, no accounts required. Everything is
   stored locally and owned by the player.

## Brand: "RETRO POCKET"

- **Name:** Retro Pocket. Internal device codename: **RP-20** (the "20" nods to the catalog).
- **Tagline:** *"Twenty classics. One pocket."*
- **Personality:** nostalgic, playful, crafted, a little neon. Think a boutique handheld
  console reimagined for the web.
- **Logo concept:** a stylized handheld silhouette with a glowing screen; the "O" in POCKET
  doubles as a D-pad or power button.

### Two faces, one app (skin modes)

Retro Pocket ships with **two interchangeable skins**, switchable in Settings (decided with
the user — *"both as a mode"*):

- **Handheld Console** *(default, immersive):* the whole app is framed as a virtual device —
  bezel, speaker grille, brand label, power LED, and a tactile D-pad + A/B + Start/Select.
  Games render on the device "screen".
- **Clean Arcade Launcher** *(focused):* a chromeless, full-bleed launcher with a side nav and
  a home dashboard. Maximizes screen area; ideal for larger phones, tablets and desktop.

The skin only changes the *frame and chrome* — game rendering, controls and logic are
identical underneath.

## Target users (personas)

| Persona | Context | What they want |
|---------|---------|----------------|
| **Commuter Casey** | 25, plays on the train, spotty signal | Quick sessions, offline, resume-where-I-left-off |
| **Nostalgic Nina** | 38, grew up on arcades | Authentic feel, the *real* classics, satisfying SFX |
| **Completionist Cole** | 19, leaderboard chaser | High scores, achievements, daily challenge, streaks |
| **Tinkerer Tom** | 30, dev, reads the source | Clean code, strict TS, good docs, hackable |

## Goals & non-goals

**Goals**
- 20 polished, faithful retro games in a single installable PWA.
- Native-grade mobile feel (offline, fullscreen, haptics, save-states).
- A cohesive meta layer (XP, achievements, daily challenge) that increases retention.
- A codebase clean enough to be a portfolio/reference project.

**Non-goals (for v1)**
- Online multiplayer / accounts / cloud sync (local-only; sync is a future option).
- A backend server (the app is 100% static, deployable to GitHub Pages).
- Exact ROM-accurate emulation — these are faithful *re-implementations*, not emulators.
- Monetization, ads, or telemetry.

## Success criteria

- **Performance:** Lighthouse (mobile) > 90 across Performance, Accessibility, Best Practices,
  PWA; sustained 60 FPS on a Pixel 6a; first home paint < 1 s on 4G.
- **Quality:** 100% TypeScript strict, no `any`; core game logic unit-tested; E2E smoke tests
  green in CI.
- **Feel:** Installs to home screen; launches fullscreen; playable in airplane mode; passes a
  manual "does this feel native on iOS Safari?" check (no bounce, no zoom).
- **Completeness:** all 20 games shipped with pause, game-over, tutorial and persisted high
  scores.

## One-line for the README

*A pocket arcade in your browser — 20 retro classics, one installable PWA.*
