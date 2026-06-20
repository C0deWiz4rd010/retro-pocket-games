---
name: enhance-all-games-task
description: Ongoing task to enhance every game (UI + gameplay + 3 features) in retro-pocket-games
metadata:
  type: project
---

User wants **every one of the 82 games** in `src/games/` improved on UI and gameplay, each extended with **at least 3 new features**. Started 2026-06-20. Multi-session effort.

**How to apply:** Features live in each game's `index.ts` (the Pixi view/controller); keep `core.ts` pure so its vitest tests stay green (extend core only with backward-compatible optional params + new tests, as done for snake). Established pattern per game: particle/`burst` system, screen shake via `layer.position`, power-ups, combos, and a dynamic `ctx.hud.setLabel`. Verify each batch with `npx tsc --noEmit`, `npx vitest run`, and `npx eslint <dirs>` (watch `prefer-const`).

**Done & verified (20 — all classics):** snake, pong, breakout, flappy, invaders, g2048, asteroids, frogger, tron, pacman (fruit/ghost-combo/levels), minesweeper (live-score/hint/level-progression), galaga (drops dual+rapid+shield/multishot/starfield), centipede (spider/double-shot/juice), missile (MIRV/multi-kill-combo/ammo-crate), bomberman (exit portal/pierce+shield/juice), qbert (enemy balls/multi-flip/freeze-orb), doodle (coins/jetpack/shootable monsters), simon (input timer/speed ramp/length bonus), lander (mission progression/fuel cans/lives), tetris (combo/T-spin/clear particles+shake).

**Batch 5 done (5 neon originals, in `_shared/conceptArcade.ts`):** pixeldash (shield+magnet pickups/zone multiplier), neonrider (shield/gear multiplier/near-miss slow-mo), blockcollapse (level progression/move refunds/color-bomb chain), spaceblaster (enemy fire/rapid+bomb drops/kill-streak), jumpquest (jetpack+shield pickups/crumbling platforms). NOTE: many neon originals live as functions inside `_shared/conceptArcade.ts` (createX) — edit there, not the thin wrapper `index.ts`. The partial-read of that 1500-line file does NOT register for editing; re-read the specific function's line range before editing.

**Git workflow (user-directed):** work on `develop`, one commit+push per game/feature (`git push origin develop`). Final release = merge `develop`→`main` (triggers `.github/workflows/deploy.yml` → GitHub Pages). Do NOT release until the user confirms the work is complete. `memory/` and `.claude/` are kept untracked.

**Doc tasks:** `docs/neuerVorgang.md` points 9-35 planned in `docs/12-umsetzungsplan.md` (effort tags + Top-20). Not yet implemented — start with Settings-store → Pause-menu (#9) → touch quick-wins per the Top-20.

**Covers fixed (user request):** game tiles now show the glyph emoji as the hero of the cover (`tile__cover-art` in App.ts `tileCover()`), motif shapes dimmed to backdrop; 37 letter-code glyphs upgraded to emoji in Registry. Pushed.

**Batch 6 (conceptArcade rest) — in progress, push per game:** DONE retrosnake (portals/shield orb/combo), dotcollector (bonus fruit/power chain/speed pellet), memorymatch (countdown timer/time bonus-penalty/start preview), brickbreaker (multiball+slow+wide capsules/level progression/combo). REMAINING in conceptArcade.ts: turbodrift, colorswitch, galacticinvaders. Find offsets via `grep -n "export function create" conceptArcade.ts`; re-read each function's range before editing (partial reads don't register).

**Order now:** user said do ALL doc features first (DONE — see [[doc-features-status]]) then the games. Currently working through remaining ~55 games. After conceptArcade rest: standalone dirs neonrush, crystalvault, lasermaze, starforge, driftracer, runereactor, cometsweep, prismdash, gearlock, echorunner + the brain/puzzle/skill volumes (memory, lightsout, sliding, sokoban, mastermind, flood, connectfour, tictactoe, reversi, match3, columns, dodger, helicopter, runner, whackamole, stacker, pinball, maze, reflex, tunnel, battleship, sudoku, checkers, bubble, blackjack, hangman, yahtzee, rps, targettap, chainreaction, quickmath, higherlower, colorclash, orbit, lockpick, numberhunt, wordmix, pulsecatch, memorypath, hotcold). Release (develop→main→Pages) only at the very end when user confirms. Related: [[retro-pocket-games-stack]].
