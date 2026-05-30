# 01 — Design System

The design system makes Retro Pocket feel like one cohesive device across 20 very different
games. Everything is driven by **CSS custom properties** so themes and skins can be swapped at
runtime with zero rebuilds.

## 1. Themes & palettes

Four built-in themes, each a full token set. The active theme sets `data-theme` on `<html>`;
games read accent colors from CSS variables (bridged into Pixi via a small token reader).

| Theme | Mood | BG | Surface | Primary / Neon | Accent | Text |
|-------|------|----|---------|----------------|--------|------|
| **Cyberpunk** *(default)* | electric night | `#0a0a12` | `#14141f` | `#00f7ff` (cyan) | `#ff2e97` (magenta) | `#e6e6f0` |
| **GameBoy DMG** | mossy LCD | `#0f380f` | `#306230` | `#8bac0f` | `#9bbc0f` | `#cadc9f` |
| **C64 Blue** | 1982 boot screen | `#3e31a2` | `#4a3fb0` | `#7c70da` | `#a8a0ff` | `#cfc8ff` |
| **Amber Terminal** | CRT phosphor | `#0d0a02` | `#1a1308` | `#ffb000` | `#ff7b00` | `#ffd27f` |

Each theme also defines: `--ok` (success/green), `--warn` (amber), `--danger` (red),
`--muted`, and a `--glow` color used by neon shadows.

### Accessibility palettes
- **High-contrast** variant per theme (boost text/background contrast to ≥ 7:1).
- **Colorblind-safe** game palettes (Okabe–Ito set) selectable in Settings; games must never
  rely on color alone — pair with shape/iconography.

### Token shape (excerpt)
```css
:root[data-theme="cyberpunk"] {
  --bg: #0a0a12;        --surface: #14141f;   --surface-2: #1d1d2b;
  --primary: #00f7ff;   --accent: #ff2e97;    --glow: #00f7ff;
  --text: #e6e6f0;      --text-muted: #8a8aa3;
  --ok: #3ddc84;        --warn: #ffb000;      --danger: #ff4d4d;
  --radius: 12px;       --tap: 48px;          /* min touch target */
  --safe-t: env(safe-area-inset-top, 0px);    /* + r/b/l */
}
```

## 2. Typography

| Role | Font | Notes |
|------|------|-------|
| Display / titles / scores | **Press Start 2P** | The arcade voice. Use sparingly, large sizes only. |
| HUD / terminal / BIOS | **VT323** or **Silkscreen** | Dense, readable pixel font for in-game stats. |
| UI body / menus / docs | **Inter** | Clean sans for everything the player *reads* (settings, descriptions). |

Rules: pixel fonts never go below their legible size; body copy is always the sans. Fonts are
**self-hosted** (no Google Fonts runtime dependency) and `font-display: swap`. A type scale of
`12 / 14 / 16 / 20 / 28 / 40` (rem-based) keeps rhythm.

## 3. Component library (UI, not game canvas)

Reusable, framework-free web components / functions:

- **Buttons:** primary (neon glow), ghost, icon, danger. Pressed state + haptic tick.
- **Cards:** game tiles (cover art, title, best score, progress ring, "NEW"/"DAILY" badges).
- **Modals / sheets:** pause overlay, game-over, tutorial, confirm. Bottom-sheet on mobile.
- **Toggle / segmented control:** theme picker, skin switch, on/off settings.
- **Toast / snackbar:** achievement unlocked, "saved", offline-ready.
- **Progress ring & XP bar:** used on tiles and the profile.
- **Virtual controls:** D-pad, A/B buttons, action button, paddle drag-zone (see §6).

All components: keyboard-focusable, `aria` labelled, ≥ `--tap` size, respect
`prefers-reduced-motion`.

## 4. The handheld shell (Console skin)

```
        ┌───────────────────────────────┐
        │  ● RETRO POCKET        ▮ 87%   │  ← brand label + power LED + battery-ish flourish
        │ ┌───────────────────────────┐ │
        │ │                           │ │
        │ │      GAME SCREEN          │ │  ← Pixi canvas + CRT layer, letterboxed to device res
        │ │   (CRT curvature/glow)    │ │
        │ │                           │ │
        │ └───────────────────────────┘ │
        │   ▲                           │
        │ ◄ + ►        ( A )   ( B )     │  ← D-pad (left) + action buttons (right)
        │   ▼      [SELECT] [START]      │
        │  ▦▦▦ speaker grille ▦▦▦        │
        └───────────────────────────────┘
```

- The shell is **pure HTML/CSS** layered around the game canvas; it never affects game logic.
- On small screens the shell collapses to maximize the screen; on large screens the full
  device is shown centered.
- **Clean Launcher skin** removes the bezel/buttons entirely and renders the canvas full-bleed
  with on-canvas/overlay touch controls only.

## 5. Screen FX (CRT) layer

Toggleable, layered, and cheap-by-default:

- **CSS layer (always available, low cost):** scanlines via repeating linear-gradient,
  vignette, subtle flicker (respecting reduced-motion), neon text-shadow.
- **WebGL shader (optional, higher fidelity):** a Pixi filter pass over the stage for barrel
  curvature, phosphor glow/halation, chromatic aberration and bloom.
- Settings expose: **Off / CSS only / Full shader**, plus an intensity slider. Default = CSS on
  mobile, Full on desktop. Auto-downgrade to CSS if FPS drops below budget.

## 6. Touch-control vocabulary (visual)

Semi-transparent, theme-tinted, only shown for games that need them (see
[02 — UX Flows](02-ux-flows.md) for per-genre mapping):

- **D-pad** (4/8-way) — bottom-left, thumb zone.
- **A / B / Action** buttons — bottom-right.
- **Drag zone** — full-width invisible strip for paddles (Pong/Breakout).
- **Tap-to-flap / tap-to-fire** — whole screen or a large button.
- **Swipe** — for 2048 and menu gestures.
- Controls are **repositionable** and support **left-handed** mirroring.

## 7. Motion & feedback

- Micro-interactions on every actionable element (≤ 150 ms), all gated by
  `prefers-reduced-motion`.
- **Haptics:** short tick on button press, stronger pulse on collision/game-over
  (`navigator.vibrate`, user-toggleable).
- Page/scene transitions: quick CRT "power-on" wipe between Home → Game.

## 8. Iconography & art

- **UI icons:** a single inline SVG sprite sheet (crisp, themeable via `currentColor`).
- **Game art:** per-game texture atlases (TexturePacker-style) loaded lazily; pixel art uses
  `scaleMode: nearest` to stay crunchy.
- **Game cover tiles:** simple, generated-or-pixel covers with consistent framing.

## Design references (2026 research)

- Thumb-zone & 44 px tap targets — Nielsen Norman / Parachute Design thumb-zone guidance.
- Cleaner, in-world HUDs and micro-interactions — 2026 mobile UI trend reports.
- CRT via CSS scanline gradients + neon `text-shadow`; cyan `#00f7ff` as the canonical
  cyberpunk hue.
