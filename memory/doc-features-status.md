---
name: doc-features-status
description: Status of neuerVorgang.md doc-feature work (points 9-35) and what already exists in the repo
metadata:
  type: project
---

User asked (after games) to implement **all doc features in `docs/neuerVorgang.md` (points 9-35) first, then the remaining games**, pushing per feature to `develop`. Plan is in `docs/12-umsetzungsplan.md`.

**KEY FINDING:** the repo is far more mature than the wishlist implies. Already implemented: `@store/settings` (theme/skin/shell/screenFx/audio{master,sfx,music,muteOnBlur}/controls{touchLayout,tilt,haptics}/a11y{reducedMotion,highContrast,colorblind,largeTargets}/locale), pause menu (`GameHost.pause()`), `@core/Haptics`, `@core/AudioManager`, `src/styles/tokens.css` (neon palette + safe-area vars `--safe-*`), `base.css` touch-action, achievements/daily/leaderboard/profile(XP/tokens/level via `awardRun`)/scores stores, shareScoreCard, confetti, per-game tutorial, i18n (`@i18n` en/de, `t()` falls back to key), vite PWA + `VITE_APP_VERSION`. Settings view exposes most toggles + master-volume slider + export. Focus-pause already wired in `App.ts` (visibilitychange).

**Done by me on develop (per-feature commits):** #9 pause sub-panels (controls/rules/accessibility) + haptics toggle; #27 pause on window blur; #10/#22 in-game fullscreen button; #14 music toggle + version display; #22 data Import (`importAll` in `db.ts` + Settings button).

**Genuine remaining gaps:** #11 desktop key-rebinding UI (InputManager.configure({keyMap}) exists but no persistence/UI; Settings schema lacks `keyMap`); #21 app-level onboarding (only per-game `tutorial.ts` exists); #16 audit count of achievements vs target 30; #17 count of daily challenges vs 20; #19 share-card QR; #22 PWA update-toast + install-prompt (check); #28 monetization + #30 20-new-games = doc deliverables (write as docs). Most others are already substantially present — enhance, don't rebuild. Related: [[enhance-all-games-task]].
