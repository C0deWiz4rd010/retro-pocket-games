# 05 - PWA & Mobile

The app should feel native: installable, fullscreen, offline, safe-area aware, with haptics and
sensible orientation handling.

## 1. Web App Manifest

```jsonc
{
  "name": "Retro Pocket",
  "short_name": "RetroPocket",
  "description": "A pocket arcade - 70 retro games in one installable PWA.",
  "start_url": "./?source=pwa",
  "scope": "./",
  "display": "standalone",
  "display_override": ["fullscreen", "standalone", "minimal-ui"],
  "orientation": "any",
  "background_color": "#0a0a12",
  "theme_color": "#0a0a12",
  "categories": ["games", "entertainment"]
}
```

- Generated via `vite-plugin-pwa` with `base: '/retro-pocket-games/'`.
- iOS-specific meta tags live in `index.html`.
- Runtime orientation handling stays per-game rather than globally locked.

## 2. Viewport & safe areas

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no, maximum-scale=1"
/>
```

- `viewport-fit=cover` is mandatory so safe-area insets resolve correctly.
- The game world can fill the screen, but all interactive HUD and control surfaces stay inside safe areas.
- Native annoyances stay disabled: overscroll, double-tap zoom, text selection, and iOS callouts.

## 3. Orientation

- Each game declares a preferred orientation in the registry.
- Android can use the Screen Orientation API when fullscreen is available.
- iOS gets a rotate prompt rather than a fake CSS rotation.
- Resizes and orientation changes must reflow without a full reload.

## 4. Offline / Service Worker

- The launcher shell is precached.
- Per-game chunks are runtime cached on first play and remain available offline.
- The experience should be local-first: offline never breaks the core app.
- Update prompts stay non-intrusive.

## 5. Device capabilities

| Capability | API | Use | Fallback |
|------------|-----|-----|----------|
| Haptics | `navigator.vibrate` | button tick, collision, game-over | silent no-op |
| Keep awake | Screen Wake Lock API | hold lock during active play | graceful degrade |
| Install | `beforeinstallprompt` | custom install banner | browser default |
| Tilt | DeviceOrientation | steering for select games | buttons |
| Share | Web Share API | score cards and links | copy/download |
| Fullscreen | Fullscreen API | immersive play | standalone display |

## 6. Performance budget

| Metric | Target |
|--------|--------|
| Home first contentful paint | < 1.0 s |
| Initial JS (gzip) | < 120 KB before game load |
| Per-game chunk (gzip) | < 80 KB logic + render target |
| Frame rate | sustained 60 FPS on mid-range mobile |
| Input latency | < 50 ms tap-to-action |
| Lighthouse (mobile) | > 90 across core categories |

## 7. Native-feel checklist

- Installs to home screen with proper icon and splash behavior.
- Launches without browser chrome in supported contexts.
- Avoids rubber-band scroll, accidental zoom, and text selection.
- Keeps HUD and controls clear of notches and home indicators.
- Works in airplane mode after first load.
- Degrades gracefully when haptics, fullscreen, or wake lock are unavailable.
