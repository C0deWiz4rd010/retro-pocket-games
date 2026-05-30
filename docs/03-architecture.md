# 03 — Architecture

## 1. Tech stack & rationale

| Concern | Choice | Why (short — full ADRs in [09](09-decisions.md)) |
|---------|--------|-----|
| Language | TypeScript (ES2022, **strict**, no `any`) | Safety + DX; the whole point of the project's quality bar |
| UI | Vanilla TS + Web Components/functions | No framework tax; tiny bundle; max control & perf |
| Renderer | **PixiJS v8** | Mature WebGL/WebGPU 2D renderer; `Application.init()` async API |
| Build | **Vite** + `vite-plugin-pwa` | Fast HMR, native ESM, easy code-splitting, Workbox PWA |
| State | Custom reactive store + event bus | Zero deps; signals-like; enough for our needs |
| Persistence | **IndexedDB** via `idb-keyval` + **zod** | Simple async KV + validated, versioned schemas |
| Audio | Web Audio API (custom `ChiptuneSynth`) | Authentic 8-bit SFX with no asset weight; Howler optional for music |
| Tests | **Vitest** + **Playwright** | Unit-test pure logic; E2E smoke the shell |
| Lint/format | ESLint + Prettier | Consistency; strict rules incl. `no-explicit-any` |

## 2. Folder structure

```
retro-pocket-games/
├─ docs/                      # this documentation
├─ public/                    # static assets copied as-is (icons, manifest extras)
├─ index.html                 # app shell entry
└─ src/
   ├─ main.ts                 # bootstrap: store → boot → router → render
   ├─ app/
   │  ├─ router.ts            # hash router
   │  ├─ Shell.ts             # device shell + clean-launcher skins
   │  ├─ SideNav.ts
   │  ├─ HomeScreen.ts        # dashboard (daily, profile, continue, grid)
   │  ├─ Settings.ts
   │  ├─ Achievements.ts
   │  └─ BiosBoot.ts
   ├─ core/                   # engine-agnostic-ish runtime services
   │  ├─ PixiManager.ts       # Application init, resize, virtual resolution, DPR cap
   │  ├─ SceneManager.ts      # per-game FSM (Boot/Tutorial/Play/Pause/Over)
   │  ├─ Scene.ts             # base Scene (extends Container) with update(dt)
   │  ├─ GameLoop.ts          # rAF + fixed/variable timestep, delta clamp
   │  ├─ InputManager.ts      # keyboard + touch + gamepad → semantic actions
   │  ├─ AudioManager.ts      # routing, master volume, mute
   │  ├─ ChiptuneSynth.ts     # 8-bit oscillator SFX + tiny tracker
   │  ├─ ScreenFX.ts          # CRT CSS + optional Pixi shader pipeline
   │  ├─ Haptics.ts           # navigator.vibrate wrapper (toggle-aware)
   │  └─ Registry.ts          # game catalog: id, title, kit, loader(), meta
   ├─ kits/                   # reusable game engines (see §5)
   │  ├─ grid/                # GridKit
   │  ├─ shooter/             # ShooterKit
   │  ├─ paddle/              # PaddleKit
   │  ├─ vector/              # VectorKit
   │  ├─ sidescroll/          # SideScrollKit
   │  └─ standalone/          # StandaloneKit helpers
   ├─ games/                  # one folder per game
   │  └─ snake/
   │     ├─ core/             # PURE logic (no Pixi/DOM) — unit tested
   │     ├─ view/             # Pixi rendering for the core state
   │     ├─ controls.ts       # control profile (maps actions → core inputs)
   │     ├─ meta.ts           # title, cover, achievements, default orientation
   │     └─ index.ts          # wires core+view+controls into a Scene
   ├─ store/                  # reactive stores
   │  ├─ store.ts             # tiny reactive primitive (signal/computed/effect)
   │  ├─ profile.ts           # XP, level, tokens
   │  ├─ settings.ts          # theme, skin, FX, audio, haptics, controls, a11y
   │  ├─ scores.ts            # per-game high scores & stats
   │  └─ achievements.ts
   ├─ data/                   # persistence layer
   │  ├─ db.ts                # idb-keyval wrapper + namespacing
   │  ├─ schemas.ts           # zod schemas for every persisted shape
   │  └─ migrations.ts        # versioned save migrations
   ├─ ui/                     # shared UI components (buttons, modals, controls)
   ├─ styles/                 # CSS: tokens.css, themes.css, shell.css, crt.css
   ├─ i18n/                   # en.ts, de.ts + t()
   └─ utils/                  # rng (seeded), math, collision, pool, color tokens
```

## 3. The logic / render split (key decision)

Every game separates **pure logic** from **rendering**:

- `games/<g>/core/` — a deterministic model: state + `step(input, dt)` reducer-style updates,
  **no PixiJS, no DOM, no `Date.now()`/`Math.random()` directly** (RNG and clock are injected).
- `games/<g>/view/` — subscribes to core state and draws it with Pixi.
- Benefits: **unit-testable** logic (Vitest, headless), **deterministic** runs for the daily
  challenge (seeded RNG → reproducible), and the option of **replays/ghosts** (record the input
  stream, replay against the same seed).

## 4. Runtime composition

```
main.ts
  └─ load settings/profile (data/db) ──► stores
  └─ PixiManager.init() ──► Application (WebGL/WebGPU)
  └─ ScreenFX.attach(app)
  └─ AudioManager.init()
  └─ Router.start()
        ├─ "#/"            → Shell + HomeScreen
        ├─ "#/play/:id"    → Registry.get(id).loader() (dynamic import)
        │                     → new SceneManager(game) → GameLoop
        ├─ "#/daily"       → daily wrapper (seed + modifier) → game
        ├─ "#/settings"    → Settings
        └─ "#/achievements"→ Achievements
```

The **Registry** holds lazy loaders so the home screen bundle stays tiny:
```ts
register({ id: 'snake', title: 'Snake', kit: 'grid', orientation: 'portrait',
  loader: () => import('../games/snake') });
```

## 5. Engine-kits (reuse strategy)

20 games share **6 kits** instead of 20 bespoke engines. Building a kit unlocks a cluster of
games quickly.

| Kit | Provides | Games (count) |
|-----|----------|---------------|
| **GridKit** | fixed grid, tick scheduler, cell entities, grid render helper, A\*/BFS for AI | Snake, Tetris, 2048, Minesweeper, Pac-Man, Frogger, Bomberman, Q\*bert, Tron (9) |
| **ShooterKit** | player ship, projectile pool, enemy formations/waves, hit detection | Space Invaders, Galaga, Centipede, Missile Command (4) |
| **PaddleKit** | paddle, ball physics, brick/field collision, reflection | Pong, Breakout (2) |
| **VectorKit** | inertial bodies, rotation/thrust, screen-wrap, vector shapes, particles | Asteroids, Lunar Lander (2) |
| **SideScrollKit** | gravity, parallax scroll, obstacle spawner, scroll-collision | Flappy Bird, Doodle Jump (2) |
| **StandaloneKit** | small shared helpers (sequence/timer/board+AI) | Simon (+ board/AI helpers reused by others) (1) |

Kits live in `src/kits/` and are pure where possible (logic) with thin Pixi view helpers.

## 6. SceneManager (per-game FSM)

```
        ┌────────┐  assets ready   ┌──────────┐ first time  ┌──────────┐
        │  BOOT   │────────────────►│ TUTORIAL │────────────►│   PLAY   │
        └────────┘                 └────┬─────┘  (skippable) └────┬─────┘
                                        │ already seen           ▲ │ pause
                                        └────────────────────────┘ ▼
                                                              ┌──────────┐
                                                              │  PAUSE   │
                                                              └────┬─────┘
                                                    resume ◄───────┘ │ quit/save
                                                                     ▼
                                                              ┌──────────┐
        retry ◄────────────────────────────────────────────►│ GAMEOVER │
                                                              └──────────┘
```

- Scenes extend a base `Scene` (`extends Container`) with `enter()`, `exit()`, `update(dt)`.
- Pause is an **overlay**, never a canvas clear — the play scene is frozen, not destroyed.
- Game-over animates the score entry and persists the high score (`store/scores`).

## 7. Input abstraction

`InputManager` normalizes **keyboard + touch + gamepad** into semantic actions consumed by
game control profiles:

```ts
type Action = 'up'|'down'|'left'|'right'|'a'|'b'|'start'|'select'|'pause'|'pointer';
input.on('a', () => game.fire());
input.axis();          // {x,y} from d-pad / stick / drag
input.pointer();       // {x,y,down} in virtual coords
```

- Touch sources: virtual D-pad/buttons, drag zones, swipe recognizer, tap, tilt
  (DeviceOrientation, opt-in).
- Per-game **control profile** declares which sources are active and maps them to core inputs.
- Bindings are **remappable** and persisted in settings; left-hand mirror is a layout flag.

## 8. Responsive canvas

- Each game declares a **virtual base resolution** (e.g. 360×640 portrait, 640×360 landscape).
- `PixiManager` sizes the renderer to the screen, computes an integer-ish scale, and
  **letterboxes** the virtual stage to fit. Game code always works in virtual coordinates.
- **DPR is capped at 2** for performance; `resolution` set accordingly. `antialias: false` and
  `nearest` scaling for pixel-crisp art.
- Resize/orientation changes re-letterbox without reloading the game.

## 9. State management

`store.ts` is a tiny signals-style primitive:
```ts
const score = signal(0);
const hi = computed(() => Math.max(score(), best()));
effect(() => hud.setScore(score()));   // auto-tracked subscription
```
Stores are plain modules exposing signals + actions; they persist through `data/db` and
validate with zod on read. UI and HUD subscribe via `effect`.

## 10. Performance architecture

- **Code-splitting:** each game is a dynamic import; home bundle excludes all game code.
- **Object pooling:** projectiles/particles/cells reuse instances (`utils/pool`).
- **Texture atlases** per game; `ParticleContainer` for bullet-hell/particle scenes.
- **Culling** for large scenes; `interactiveChildren=false` on static containers.
- **Fixed-timestep** logic with interpolation for smooth 60 FPS; delta clamp to avoid spiral.
- FPS monitor can auto-downgrade ScreenFX (full shader → CSS) to hold the budget.
