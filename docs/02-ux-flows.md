# 02 — UX Flows & Wireframes

## 1. Navigation model

- **Router:** a tiny hash-based router (`#/`, `#/play/snake`, `#/settings`, `#/achievements`,
  `#/daily`). Hash routing keeps GitHub Pages static hosting trivial (no server rewrites) and
  makes deep links / back-button behave natively.
- **SideNav:**
  - *Mobile (default):* hidden; opened by a hamburger or **edge-swipe from the left**; shows as
    an overlay drawer with a scrim; closes on select, scrim tap, or swipe-back.
  - *Tablet/desktop:* **fixed** rail, always visible; collapsible to icon-only.
  - Contents: Home, the 20 games (grouped by genre), Daily Challenge, Achievements, Settings.
- **Skin note:** in *Console* skin the nav opens as a drawer over the device screen; in *Clean
  Launcher* skin it's the standard rail/drawer.

## 2. Screen-flow diagram

```
            ┌─────────────┐
            │  BIOS BOOT   │  (first launch / optional each launch, skippable)
            │  typing FX   │
            └──────┬───────┘
                   ▼
            ┌─────────────┐        ┌──────────────┐
            │    HOME      │◄──────►│   SIDE NAV    │
            │  dashboard   │        │ (drawer/rail) │
            └──────┬───────┘        └──────────────┘
       ┌───────────┼───────────┬─────────────┬───────────┐
       ▼           ▼           ▼             ▼           ▼
  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
  │  DAILY   │ │ SETTINGS │ │ACHIEVE-  │ │ PROFILE  │ │  GAME    │
  │CHALLENGE │ │          │ │ MENTS    │ │ (XP/lvl) │ │ LAUNCH   │
  └────┬─────┘ └──────────┘ └──────────┘ └──────────┘ └────┬─────┘
       │                                                    ▼
       │                                          ┌──────────────────┐
       └─────────────────────────────────────────►│   GAME SESSION    │
                                                   │  Boot→Tutorial→   │
                                                   │  Play↔Pause→Over  │
                                                   └─────────┬─────────┘
                                  ┌──────────────────────────┼───────────────┐
                                  ▼                          ▼               ▼
                            ┌──────────┐              ┌────────────┐   ┌──────────┐
                            │  PAUSE    │              │ GAME OVER  │   │ SAVE &   │
                            │ resume/   │              │ score entry│   │  QUIT    │
                            │ restart/  │              │ retry/home │   │ → HOME   │
                            │ save/quit │              └────────────┘   └──────────┘
                            └──────────┘
```

Per-game session is a finite-state machine: `BOOT → TUTORIAL? → PLAY ⇄ PAUSE → GAMEOVER`
(see [03 — Architecture](03-architecture.md) §SceneManager).

## 3. Wireframes (ASCII)

### Home — mobile portrait (Clean Launcher skin)
```
┌──────────────────────────┐
│ ☰  RETRO POCKET      ⚙   │  header: nav toggle, title, settings
├──────────────────────────┤
│ ▓ DAILY CHALLENGE     ▶  │  hero banner: today's game + modifier + streak 🔥7
│  "Tetris ×2 speed"       │
├──────────────────────────┤
│ Lv.12 ▮▮▮▮▮▮▯▯ 1,240 XP  │  profile strip: level + XP bar + 🪙 tokens
├──────────────────────────┤
│ CONTINUE                 │
│ ┌────────┐ ┌────────┐    │  resume cards (has save-state)
│ │ SNAKE  │ │ PAC-MAN│    │
│ │ ⮐ 1240 │ │ ⮐ lvl3 │    │
│ └────────┘ └────────┘    │
├──────────────────────────┤
│ ALL GAMES                │
│ ┌────┐┌────┐┌────┐┌────┐ │  grid of game tiles (cover, best score,
│ │SNK ││TET ││PNG ││BRK │ │  progress ring, NEW badge)
│ └────┘└────┘└────┘└────┘ │
│ ┌────┐┌────┐┌────┐┌────┐ │
│ │AST ││INV ││PAC ││FLP │ │
│ └────┘└────┘└────┘└────┘ │
│           ...            │
└──────────────────────────┘
```

### SideNav — open (overlay drawer)
```
┌───────────────┐············
│ ● RETRO POCKET│  scrim →   ·
│ Lv.12  🪙 320 │            ·
├───────────────┤            ·
│ ⌂ Home        │            ·
│ ★ Daily       │            ·
│ 🏆 Achievements│            ·
│ ⚙ Settings    │            ·
├───────────────┤            ·
│ ARCADE        │            ·
│ • Snake       │            ·
│ • Tetris      │            ·
│ • Pong  ...   │            ·
│ PUZZLE        │            ·
│ • 2048  ...   │            ·
└───────────────┘············
```

### Game screen — portrait, D-pad genre (Console skin)
```
┌──────────────────────────┐
│ ‖ 1240   ♥♥♥      ⏸  ⚙   │  in-game HUD (score, lives, pause) — inside safe area
├──────────────────────────┤
│                          │
│        GAME CANVAS        │  full-bleed; CRT overlay; world may extend
│      (virtual 360×640)    │  behind notch, HUD stays in safe area
│                          │
│                          │
├──────────────────────────┤
│    ▲                     │
│  ◄   ►            ( A )   │  D-pad bottom-left, action bottom-right
│    ▼              ( B )   │  (thumb zone; semi-transparent)
└──────────────────────────┘
```

### Game screen — landscape (Pong/Asteroids/Lunar Lander)
```
┌────────────────────────────────────────────┐
│ ‖12  ⏸                              ‖ 09    │  scores top corners (safe area)
│  ▌                                      ▐   │
│  ▌            GAME CANVAS (640×360)      ▐   │  drag zones / D-pad on edges
│  ▌                                      ▐   │
│      ◄ left drag-paddle ►   ◄ right ►       │
└────────────────────────────────────────────┘
```

### Pause overlay (bottom sheet on mobile)
```
        ┌──────────────────────┐
        │        PAUSED         │
        │  ──────────────────   │
        │   ▶  Resume           │
        │   ↻  Restart          │
        │   💾 Save & Quit      │
        │   ⚙  Settings         │
        │   ⌂  Home             │
        └──────────────────────┘
```

### BIOS boot (first launch)
```
┌──────────────────────────┐
│ RETRO POCKET BIOS v1.0    │
│ (c) 2026 C0deWiz4rd010    │
│                          │
│ > Detecting display..OK   │
│ > Loading audio.......OK  │
│ > Mounting save data..OK  │
│ > 20 cartridges found     │
│ > READY_                  │  blinking cursor, typing FX, [tap to skip]
└──────────────────────────┘
```

## 4. Touch-control layouts per genre

| Genre | Games | Primary controls | Orientation |
|-------|-------|------------------|-------------|
| Grid / direction | Snake, Pac-Man, Frogger, Q\*bert, Bomberman, Tron | **D-pad** (+swipe alt), A = action/bomb | Portrait |
| Falling-block | Tetris | D-pad L/R/down, A = rotate, swipe-down = hard drop | Portrait |
| Slide-merge | 2048 | **Swipe** (4-way), no buttons | Portrait |
| Logic | Minesweeper | Tap = reveal, long-press = flag, flag-mode toggle | Portrait |
| Paddle | Pong, Breakout | **Drag zone** (paddle follows thumb), A = launch | Landscape (Pong) / Portrait (Breakout) |
| Shooter (fixed) | Space Invaders, Galaga, Centipede | Move = D-pad/drag, A = fire (auto-fire option) | Portrait |
| Aim/defense | Missile Command | **Tap target** to fire at point | Portrait |
| Vector/physics | Asteroids | D-pad rotate + A = thrust + B = fire | Landscape |
| Lander | Lunar Lander | Tilt OR D-pad thrusters | Portrait/Landscape |
| Side-scroller | Flappy Bird, Doodle Jump | **Tap to flap** / tilt-or-buttons to steer | Portrait |
| Memory | Simon | Tap the 4 colored pads | Portrait |

Notes: every scheme has a **keyboard mapping** too (arrows/WASD + Z/X/Space), and a **Gamepad
API** mapping, via the unified InputManager. Controls are repositionable and left-hand
mirrorable. Where a game supports tilt, it is opt-in with a button fallback.

## 5. Empty / edge states

- **Offline:** a subtle "OFFLINE — all games available" chip; nothing breaks.
- **First visit:** BIOS boot → Home with a gentle "Pick a cartridge" hint.
- **No save / no scores yet:** tiles show "—"; Continue row is hidden.
- **Install prompt:** a dismissible "Install Retro Pocket" banner (custom, using
  `beforeinstallprompt`), shown after the second session.
- **Rotate prompt:** for orientation-locked games on iOS (no lock API), show a "rotate your
  device" overlay.
