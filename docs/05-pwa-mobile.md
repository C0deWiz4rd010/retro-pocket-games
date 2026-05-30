# 05 — PWA & Mobile

The app must feel native: installable, fullscreen, offline, safe-area aware, with haptics and
sensible orientation handling.

## 1. Web App Manifest

```jsonc
{
  "name": "Retro Pocket",
  "short_name": "RetroPocket",
  "description": "A pocket arcade — 20 retro classics in one installable PWA.",
  "start_url": "./?source=pwa",
  "scope": "./",
  "display": "standalone",          // fullscreen-feel; "fullscreen" attempted on Android
  "display_override": ["fullscreen", "standalone", "minimal-ui"],
  "orientation": "any",              // per-game lock handled at runtime
  "background_color": "#0a0a12",
  "theme_color": "#0a0a12",
  "categories": ["games", "entertainment"],
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    { "name": "Daily Challenge", "url": "./#/daily" },
    { "name": "Continue", "url": "./#/" }
  ]
}
```

- Generated/served via `vite-plugin-pwa` with `base: '/retro-pocket-games/'` so paths resolve on
  GitHub Pages.
- iOS extras in `index.html`: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-
  style=black-translucent`, apple-touch-icon, and apple splash images per device.

## 2. Viewport & safe areas

```html
<meta name="viewport"
      content="width=device-width, initial-scale=1, viewport-fit=cover,
               user-scalable=no, maximum-scale=1" />
```

- **`viewport-fit=cover`** is mandatory — without it `env(safe-area-inset-*)` resolves to 0 and
  Safari letterboxes in landscape.
- **Full-bleed canvas, offset HUD:** the game world fills the screen (even behind notch/Dynamic
  Island/home indicator); all *interactive* UI (HUD, buttons, pause) stays inside
  `env(safe-area-inset-*)`.
- Kill native annoyances: `overscroll-behavior: none` (no rubber-band), `touch-action:
  manipulation` / `none` on the canvas (no double-tap zoom), `user-select: none`, disable the
  iOS callout. No `300ms` tap delay.

## 3. Orientation

- Each game declares a preferred orientation (`portrait`/`landscape`/`any`) in its `meta.ts`.
- **Android (installed):** use the **Screen Orientation API** (`screen.orientation.lock()`),
  which requires fullscreen — request fullscreen on game start where allowed.
- **iOS Safari:** no lock API and no Fullscreen API → detect wrong orientation via media query
  and show a **"rotate your device"** overlay (never silently CSS-rotate gameplay).
- Re-letterbox on every `resize`/`orientationchange` without reloading the game.

## 4. Offline / Service Worker (Workbox via vite-plugin-pwa)

- **Strategy:** `injectManifest`/`generateSW` precaches the **app shell** (HTML/CSS/JS/fonts/UI
  icons). Per-game chunks + atlases use **runtime caching** (cache-first, versioned) so they're
  cached on first play and then available offline.
- **Goal:** after the first visit, the launcher works fully offline; any game played once is
  playable offline forever (until cache eviction).
- **Updates:** `autoUpdate` with a non-intrusive "New version available — reload" toast.
- An "offline-ready" toast confirms first-time caching. A small **OFFLINE** chip appears when
  `navigator.onLine === false` (nothing breaks — it's local-first).

## 5. Device capabilities

| Capability | API | Use | Fallback |
|------------|-----|-----|----------|
| Haptics | `navigator.vibrate` | button tick, collision, game-over | silent no-op; user toggle |
| Keep awake | **Screen Wake Lock API** | hold lock during active play | none (degrade gracefully) |
| Install | `beforeinstallprompt` | custom install banner after 2nd session | browser default |
| Tilt | DeviceOrientation (opt-in, permission on iOS) | Lunar Lander/Doodle steering | button controls |
| Share | Web Share API | share score-cards (PNG) | copy link / download PNG |
| Fullscreen | Fullscreen API (where supported) | immersive play, enables orientation lock | standalone display |

All capabilities are **progressive** — detected at runtime, never assumed.

## 6. Performance budget

| Metric | Target |
|--------|--------|
| Home first contentful paint (4G, mid Android) | < 1.0 s |
| Home JS (initial, gzip) | < 120 KB (PixiJS lazy-loaded with first game) |
| Per-game chunk (gzip) | < 80 KB logic+view (excl. atlas) |
| Frame rate (Pixi 6a) | sustained 60 FPS; never < 50 in normal play |
| Input latency | < 50 ms tap-to-action |
| Lighthouse (mobile) | > 90 Performance / A11y / Best Practices / PWA |
| TTI on repeat (cached) | < 0.5 s |

**Tactics:** code-split per game; cap DPR at 2; `antialias:false`; texture atlases;
`ParticleContainer` for particle-heavy games; object pooling; `interactiveChildren=false` on
static layers; preconnect/preload self-hosted fonts; auto-downgrade ScreenFX under load (see
[03 §10](03-architecture.md)).

## 7. Manual "feels native" checklist

- [ ] Installs to home screen with proper icon + name + splash.
- [ ] Launches fullscreen/standalone (no browser chrome).
- [ ] No rubber-band scroll, no pinch/double-tap zoom, no text selection.
- [ ] HUD/buttons never hidden by notch or home indicator (any orientation).
- [ ] Works in airplane mode after first load.
- [ ] Haptics + wake-lock behave during play; orientation prompt works on iOS.
