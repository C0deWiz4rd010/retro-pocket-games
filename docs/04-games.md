# 04 — The 20 Games

Each game lives in `src/games/<id>/` with the **logic/render split** described in
[03 — Architecture](03-architecture.md). Every game must ship with: a **tutorial** overlay
(first run), a **pause** overlay, an animated **game-over** with persisted high score, at least
**2 achievements**, chiptune SFX, and both touch + keyboard + gamepad controls.

Legend — **Kit**: which engine-kit (GridKit/ShooterKit/PaddleKit/VectorKit/SideScrollKit/
StandaloneKit). **Orient**: default orientation.

## Catalog overview

| # | Game | id | Kit | Orient | Core mechanic |
|---|------|----|----|--------|---------------|
| 1 | Snake | `snake` | Grid | Portrait | Grow by eating; don't hit self/walls |
| 2 | Tetris | `tetris` | Grid | Portrait | Stack & clear lines |
| 3 | Pong | `pong` | Paddle | Landscape | Bounce ball past opponent |
| 4 | Breakout | `breakout` | Paddle | Portrait | Clear bricks with ball+paddle |
| 5 | Asteroids | `asteroids` | Vector | Landscape | Shoot & avoid drifting rocks |
| 6 | Space Invaders | `invaders` | Shooter | Portrait | Repel descending aliens |
| 7 | Pac-Man | `pacman` | Grid | Portrait | Eat dots, dodge ghosts |
| 8 | Flappy Bird | `flappy` | SideScroll | Portrait | Tap to fly through gaps |
| 9 | 2048 | `g2048` | Grid | Portrait | Slide & merge to 2048 |
| 10 | Minesweeper | `minesweeper` | Grid | Portrait | Deduce mine locations |
| 11 | Frogger | `frogger` | Grid | Portrait | Cross road & river |
| 12 | Galaga | `galaga` | Shooter | Portrait | Formation shooter w/ dives |
| 13 | Centipede | `centipede` | Shooter | Portrait | Shoot segmented centipede |
| 14 | Missile Command | `missile` | Shooter | Portrait | Defend cities, aim & fire |
| 15 | Bomberman | `bomberman` | Grid | Portrait | Bomb maze, beat enemies |
| 16 | Q\*bert | `qbert` | Grid (iso) | Portrait | Hop cubes, change colors |
| 17 | Doodle Jump | `doodle` | SideScroll | Portrait | Bounce ever upward |
| 18 | Simon | `simon` | Standalone | Portrait | Repeat the color sequence |
| 19 | Lunar Lander | `lander` | Vector | Portrait | Land softly on low fuel |
| 20 | Tron Light Cycles | `tron` | Grid | Landscape | Trap opponent with trails |

---

## Specifications

### 1. Snake — `snake` · GridKit · Portrait
- **Loop:** tick-based movement on a grid; eat food to grow; collision with wall/self ends.
- **Controls:** D-pad / swipe / arrows. Cannot reverse 180°.
- **Twists:** speed ramps with length; optional "wrap walls" mode; bonus fruit timer.
- **Score:** food eaten × multiplier. **Achievements:** reach length 50; clear a "no-wall" run.
- **Assets:** snake/food sprites (or vector); crunch SFX.

### 2. Tetris — `tetris` · GridKit · Portrait
- **Loop:** 7-bag randomizer; gravity drop; rotate (SRS-lite kicks); soft/hard drop; line clear.
- **Controls:** L/R move, down soft-drop, A rotate CW, B rotate CCW, swipe-down hard-drop, hold.
- **Twists:** ghost piece, level speed curve, **particle burst** + screen-shake on Tetris (4-line).
- **Score:** standard (single/double/triple/tetris + soft/hard-drop bonus). **Ach.:** a Tetris;
  level 10. **Assets:** block atlas, clear SFX, level-up jingle.

### 3. Pong — `pong` · PaddleKit · Landscape
- **Loop:** ball bounces; angle depends on hit position; first to 11.
- **Modes:** 1P vs CPU (difficulty scales paddle speed/prediction), local 2P (two drag zones).
- **Controls:** drag paddle (each side), A to serve. **Twists:** speed-up on rally, optional
  curve. **Ach.:** shutout 11–0; 20-hit rally. **Assets:** blip/blop SFX.

### 4. Breakout — `breakout` · PaddleKit · Portrait
- **Loop:** paddle + ball clears brick layouts; lives system.
- **Controls:** drag paddle, A launch. **Twists:** power-ups (multiball, widen, laser, slow),
  brick maps per level, indestructible bricks. **Ach.:** clear 3 levels; catch 3 power-ups in a
  run. **Assets:** brick atlas, power-up icons, break SFX.

### 5. Asteroids — `asteroids` · VectorKit · Landscape
- **Loop:** rotate + thrust ship with inertia; shoot rocks that split; screen-wrap; UFO bonus.
- **Controls:** D-pad rotate, A thrust, B fire, optional hyperspace. **Twists:** wave scaling,
  vector glow visuals, thrust particles. **Ach.:** survive wave 5; destroy a UFO. **Assets:**
  vector shapes, thrust/explosion SFX.

### 6. Space Invaders — `invaders` · ShooterKit · Portrait
- **Loop:** alien grid steps & descends, speeding up as ranks thin; destructible bunkers;
  mystery ship. **Controls:** move L/R, A fire (single shot on screen, classic). **Twists:**
  increasing tempo, bunker erosion. **Ach.:** clear a wave; hit the mystery ship. **Assets:**
  alien atlas (2-frame march), bunker tiles, SFX march loop.

### 7. Pac-Man — `pacman` · GridKit · Portrait
- **Loop:** eat all dots; 4 ghosts with distinct AI (Blinky chase, Pinky ambush, Inky flank,
  Clyde scatter) cycling **chase/scatter**; power pellets → frightened (eat ghosts); fruit bonus.
- **Controls:** D-pad/swipe. **Twists:** authentic tunnel wrap, ghost house timing. **Ach.:**
  clear a maze; eat 4 ghosts on one pellet. **Assets:** maze tilemap, ghost atlas, waka SFX.

### 8. Flappy Bird — `flappy` · SideScrollKit · Portrait
- **Loop:** constant gravity; tap to flap; pass pipe gaps; one hit = over.
- **Controls:** tap anywhere / A / Space. **Twists:** day/night, parallax, near-miss flair.
  **Ach.:** score 10; score 25. **Assets:** bird (2-frame), pipe, ground; flap/hit SFX.

### 9. 2048 — `g2048` · GridKit · Portrait
- **Loop:** 4×4 grid; swipe slides & merges equal tiles; spawn 2/4; reach 2048 (keep going).
- **Controls:** swipe / arrows. **Twists:** smooth merge animation, undo (limited), best-tile
  tracking. **Ach.:** reach 2048; reach 4096. **Render:** Pixi for consistency (still grid-kit
  logic). **Assets:** tile colors per value, slide SFX.

### 10. Minesweeper — `minesweeper` · GridKit · Portrait
- **Loop:** reveal cells; numbers = adjacent mines; flag suspected mines; clear all safe cells.
- **Difficulties:** Beginner 9×9/10, Intermediate 16×16/40, Expert 30×16/99 (scaled to screen).
- **Controls:** tap reveal, long-press flag, flag-mode toggle, chord on numbers. **Twists:**
  first-click safe, timer, mine counter. **Ach.:** clear Beginner; clear Expert. **Assets:**
  tile sprites, flag/mine icons, click SFX.

### 11. Frogger — `frogger` · GridKit · Portrait
- **Loop:** hop across lanes of traffic, then a river (ride logs/turtles), into 5 home slots;
  timer. **Controls:** D-pad/swipe (one hop per press). **Twists:** speeding lanes, diving
  turtles, fly bonus. **Ach.:** fill all 5 homes; cross without dying. **Assets:** frog, cars,
  logs; hop/splash SFX.

### 12. Galaga — `galaga` · ShooterKit · Portrait
- **Loop:** enemies fly in to form a grid, then **dive-bomb**; capture-beam mechanic →
  rescue for dual-fighter; bonus stages. **Controls:** move L/R, A fire (2 shots). **Twists:**
  formation entry paths, dual ship. **Ach.:** rescue captured fighter; clear a bonus stage.
  **Assets:** bee/boss atlas, capture beam, SFX.

### 13. Centipede — `centipede` · ShooterKit · Portrait
- **Loop:** centipede winds down a mushroom field, splitting when shot; spider/flea/scorpion
  hazards; player moves in a bottom band. **Controls:** D-pad/drag in band, A fire (rapid).
  **Twists:** mushroom growth, poison columns. **Ach.:** clear a wave; 10k points. **Assets:**
  segment/mushroom/spider sprites, SFX.

### 14. Missile Command — `missile` · ShooterKit · Portrait
- **Loop:** defend 6 cities from raining missiles by **tapping** to detonate counter-missiles
  (travel time + blast radius); limited ammo per battery; waves. **Controls:** tap target point
  (nearest battery fires). **Twists:** smart bombs, MIRV splits, score = saved cities + ammo.
  **Ach.:** survive wave 5; save all cities one wave. **Assets:** city/missile/explosion, SFX.

### 15. Bomberman — `bomberman` · GridKit · Portrait
- **Loop:** grid maze of soft/hard blocks; drop bombs (cross blast) to clear blocks & enemies;
  power-ups (range, count, speed); reach exit. **Controls:** D-pad move, A bomb. **Twists:**
  chain explosions, enemy AI, kickable bombs (power-up). **Ach.:** clear a stage; 5-chain combo.
  **Assets:** tileset, bomb/explosion, enemy sprites, SFX.

### 16. Q\*bert — `qbert` · GridKit (isometric) · Portrait
- **Loop:** hop a pyramid of cubes to flip them to the target color; avoid Coily & enemies;
  discs for escape. **Controls:** 4 diagonal hops (D-pad mapped to iso). **Twists:** multi-flip
  levels, falling off edges. **Ach.:** complete a level; ride a disc. **Assets:** iso cube
  tiles, Q\*bert + enemy sprites, hop/"@!#?@!" SFX.

### 17. Doodle Jump — `doodle` · SideScrollKit · Portrait
- **Loop:** auto-bounce upward on platforms; steer L/R (wrap); platform types (moving, breaking,
  spring); monsters; endless height = score. **Controls:** tilt or L/R buttons; A shoot (up).
  **Twists:** jetpack/propeller power-ups, spring boosts. **Ach.:** reach 5k; defeat a monster.
  **Assets:** doodler, platform types, monsters, SFX.

### 18. Simon — `simon` · StandaloneKit · Portrait
- **Loop:** watch a growing sequence of 4 lit/sounded pads; repeat it; speed increases.
- **Controls:** tap the 4 pads. **Twists:** strict mode, distinct tones per pad. **Ach.:**
  reach sequence length 10; length 20. **Assets:** 4 pad colors, 4 tones (synth), fail buzz.

### 19. Lunar Lander — `lander` · VectorKit · Portrait
- **Loop:** descend onto flat pads under gravity with limited fuel; control thrust + rotation;
  land within safe velocity/angle; pad multipliers. **Controls:** A main thruster, D-pad rotate
  (or tilt). **Twists:** terrain generation, fuel/score economy, wind (hard mode). **Ach.:**
  perfect landing (low speed); land on ×5 pad. **Assets:** lander vector, terrain, thrust SFX.

### 20. Tron Light Cycles — `tron` · GridKit · Landscape
- **Loop:** two cycles leave solid trails; steer to make the opponent crash first; arena walls.
- **Modes:** 1P vs CPU (path-aware AI), local 2P (split controls). **Controls:** D-pad / two
  control halves. **Twists:** speed boost, shrinking arena (sudden death). **Ach.:** beat CPU on
  hard; win a 2P round. **Assets:** cycle + trail (neon lines), crash SFX.

---

## Shared per-game checklist (definition of done)

- [ ] Pure `core/` logic with seeded RNG + injected clock (unit tests pass).
- [ ] Pixi `view/` renders all core states; 60 FPS in virtual resolution.
- [ ] Control profile: touch + keyboard + gamepad; repositionable; correct default orientation.
- [ ] Tutorial overlay (first run), Pause overlay, animated Game-Over with score entry.
- [ ] High score + stats persisted (`store/scores`), shows on the home tile.
- [ ] ≥ 2 achievements wired; chiptune SFX via `ChiptuneSynth`.
- [ ] Daily-challenge compatible (accepts seed + optional modifier).
- [ ] Lazy-loaded via `Registry`; no static import from the home bundle.
