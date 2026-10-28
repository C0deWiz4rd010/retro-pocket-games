import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action, Dir } from '@core/InputManager';
import { DIRS } from '@kits/arcade/constants';
import { glowCircle } from '@kits/arcade/glow';

/**
 * Pac-Man-lite: a procedurally built, guaranteed-connected maze, dots + power pellets,
 * and four ghosts that alternate between scatter (head to their corner) and chase (target
 * Pac-Man). Power pellets make ghosts frightened and edible. See docs/04 #7.
 *
 * Maze rule: border is wall; interior cells at (even row, even col) are pillars, everything
 * else is an open corridor — this lattice is always fully connected.
 */

interface Ghost {
  x: number;
  y: number;
  dir: { x: number; y: number };
  color: number;
  scatter: { x: number; y: number };
  frightened: number;
}

export default function createGame(ctx: GameContext): Game {
  const COLS = 19;
  const ROWS = 21;
  const cell = Math.floor(Math.min(ctx.width / COLS, ctx.height / ROWS));
  const ox = (ctx.width - COLS * cell) / 2;
  const oy = (ctx.height - ROWS * cell) / 2;

  const layer = new Container();
  layer.position.set(ox, oy);
  ctx.stage.addChild(layer);
  const mazeG = new Graphics();
  // ~300 dots change only when one is eaten, so they get their own layer redrawn on demand
  // instead of being re-tessellated every frame.
  const dotsG = new Graphics();
  const g = new Graphics();
  layer.addChild(mazeG, dotsG, g);
  let dotsDirty = true;

  const homeC = Math.floor(COLS / 2);
  const homeR = Math.floor(ROWS / 2);

  const wall: boolean[][] = [];
  const dot: boolean[][] = [];
  const pellet: boolean[][] = [];
  let dotCount = 0;

  const inHouse = (c: number, r: number): boolean =>
    Math.abs(c - homeC) <= 1 && Math.abs(r - homeR) <= 1;

  for (let r = 0; r < ROWS; r++) {
    wall[r] = [];
    dot[r] = [];
    pellet[r] = [];
    for (let c = 0; c < COLS; c++) {
      const border = r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1;
      const pillar = r % 2 === 0 && c % 2 === 0;
      const isWall =
        (border && !(r === homeR && (c === 0 || c === COLS - 1))) || (pillar && !inHouse(c, r));
      wall[r]![c] = isWall;
      dot[r]![c] = false;
      pellet[r]![c] = false;
    }
  }

  const resetDots = (): void => {
    dotsDirty = true;
    dotCount = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        pellet[r]![c] = false;
        dot[r]![c] = false;
        if (!wall[r]![c] && !inHouse(c, r)) {
          dot[r]![c] = true;
          dotCount++;
        }
      }
    // power pellets near the four corners
    for (const [c, r] of [
      [1, 1],
      [COLS - 2, 1],
      [1, ROWS - 2],
      [COLS - 2, ROWS - 2],
    ] as [number, number][]) {
      if (dot[r]![c]) {
        dot[r]![c] = false;
        dotCount--;
        pellet[r]![c] = true;
      }
    }
  };
  resetDots();

  const isWall = (c: number, r: number): boolean => {
    if (r < 0 || r >= ROWS) return true;
    const cc = (c + COLS) % COLS; // horizontal tunnel wrap on the home row
    return wall[r]![cc] ?? true;
  };

  const start = { x: homeC, y: ROWS - 2 };
  const pac = { x: start.x, y: start.y, dir: { x: 0, y: 0 }, next: { x: 0, y: 0 }, mouth: 0 };
  const ghosts: Ghost[] = [
    {
      x: homeC,
      y: homeR,
      dir: DIRS.left!,
      color: 0xff2e97,
      scatter: { x: COLS - 2, y: 1 },
      frightened: 0,
    },
    { x: homeC, y: homeR, dir: DIRS.up!, color: 0x00f7ff, scatter: { x: 1, y: 1 }, frightened: 0 },
    {
      x: homeC,
      y: homeR,
      dir: DIRS.right!,
      color: 0xffb000,
      scatter: { x: COLS - 2, y: ROWS - 2 },
      frightened: 0,
    },
    {
      x: homeC,
      y: homeR,
      dir: DIRS.down!,
      color: 0xff7b00,
      scatter: { x: 1, y: ROWS - 2 },
      frightened: 0,
    },
  ];

  let initialDots = dotCount;
  let score = 0;
  let lives = 3;
  let over = false;
  let modeTimer = 0;
  let mode: 'scatter' | 'chase' = 'scatter';
  let level = 1;
  let ghostCombo = 0; // Feature: ghost-eat chain multiplier
  let fruit: { c: number; r: number; ttl: number; worth: number } | null = null; // Feature: bonus fruit
  let fruitDone = false;
  const pacSpeed = 6;
  let ghostSpeed = 5.4;

  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('EAT THE DOTS · L1');

  const spawnFruit = (): void => {
    if (fruit || fruitDone) return;
    fruit = { c: homeC, r: homeR + 2, ttl: 9, worth: 100 * level };
    fruitDone = true;
  };

  const setDir = (a: Action | Dir): void => {
    const d = DIRS[a];
    if (!d) return;
    pac.next = d;
    // Reversing is allowed anywhere, not just at junctions.
    if (d.x === -pac.dir.x && d.y === -pac.dir.y && (d.x !== 0 || d.y !== 0)) pac.dir = d;
  };
  const offDown = ctx.input.on('down', setDir);
  const offSwipe = ctx.input.on('swipe', setDir);

  const drawMaze = (): void => {
    mazeG.clear();
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (wall[r]![c]) {
          mazeG
            .roundRect(c * cell + 1, r * cell + 1, cell - 2, cell - 2, 3)
            .fill({ color: 0x13135a });
          // neon rim only on the sides that face a corridor
          const open = (dc: number, dr: number): boolean => !isWall(c + dc, r + dr);
          const x0 = c * cell + 1,
            y0 = r * cell + 1,
            s = cell - 2;
          if (open(0, -1)) mazeG.rect(x0 + 2, y0, s - 4, 2).fill({ color: 0x4a6bff });
          if (open(0, 1)) mazeG.rect(x0 + 2, y0 + s - 2, s - 4, 2).fill({ color: 0x4a6bff });
          if (open(-1, 0)) mazeG.rect(x0, y0 + 2, 2, s - 4).fill({ color: 0x4a6bff });
          if (open(1, 0)) mazeG.rect(x0 + s - 2, y0 + 2, 2, s - 4).fill({ color: 0x4a6bff });
        }
  };
  drawMaze();

  const loseLife = (): void => {
    lives--;
    ctx.hud.setLives(lives);
    ctx.audio.sfx('hit');
    if (lives <= 0) {
      over = true;
      ctx.gameOver(score, { dots: dotCount, cleared: level - 1 });
      return;
    }
    pac.x = start.x;
    pac.y = start.y;
    pac.dir = { x: 0, y: 0 };
    pac.next = { x: 0, y: 0 };
    ghosts.forEach((gh, i) => {
      gh.x = homeC;
      gh.y = homeR;
      gh.frightened = 0;
      gh.dir = [DIRS.left!, DIRS.up!, DIRS.right!, DIRS.down!][i]!;
    });
  };

  const atCentre = (m: { x: number; y: number }): boolean =>
    Math.abs(m.x - Math.round(m.x)) < 1e-6 && Math.abs(m.y - Math.round(m.y)) < 1e-6;

  /**
   * Move `dist` cells along m.dir, stopping at EVERY cell centre to call `decide` (which may
   * change m.dir, eat dots, ...). Because no centre is ever skipped, entities can never tunnel
   * through walls regardless of speed or frame time. Stops early if decide() leaves dir at 0.
   */
  const travel = (
    m: { x: number; y: number; dir: { x: number; y: number } },
    dist: number,
    decide: () => void,
  ): void => {
    let guard = 16;
    while (dist > 1e-6 && guard-- > 0) {
      if (atCentre(m)) {
        m.x = Math.round(m.x);
        m.y = Math.round(m.y);
        decide();
        if (m.dir.x === 0 && m.dir.y === 0) return;
      }
      // Distance to the next centre in the travel direction (a full cell when on a centre).
      const frac = m.dir.x !== 0 ? m.x - Math.floor(m.x) : m.y - Math.floor(m.y);
      const sign = m.dir.x !== 0 ? m.dir.x : m.dir.y;
      const toCentre = frac < 1e-6 ? 1 : sign > 0 ? 1 - frac : frac;
      const step = Math.min(dist, toCentre);
      m.x += m.dir.x * step;
      m.y += m.dir.y * step;
      dist -= step;
      if (step === toCentre) {
        m.x = Math.round(m.x);
        m.y = Math.round(m.y);
      }
      m.x = (m.x + COLS) % COLS;
    }
  };

  const chooseGhostDir = (gh: Ghost): void => {
    let choices = Object.values(DIRS).filter(
      (d) => !(d.x === -gh.dir.x && d.y === -gh.dir.y) && !isWall(gh.x + d.x, gh.y + d.y),
    );
    if (!choices.length)
      choices = Object.values(DIRS).filter((d) => !isWall(gh.x + d.x, gh.y + d.y));
    if (!choices.length) return;
    if (gh.frightened > 0) {
      gh.dir = ctx.rng.pick(choices);
      return;
    }
    const target = mode === 'chase' ? { x: pac.x, y: pac.y } : gh.scatter;
    let best = choices[0]!;
    let bestD = Infinity;
    for (const d of choices) {
      const dx = gh.x + d.x - target.x;
      const dy = gh.y + d.y - target.y;
      const dist = dx * dx + dy * dy;
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    gh.dir = best;
  };

  const moveGhost = (gh: Ghost, dt: number): void => {
    const sp = (gh.frightened > 0 ? ghostSpeed * 0.6 : ghostSpeed) * dt;
    travel(gh, sp, () => chooseGhostDir(gh));
  };

  return {
    update(dt) {
      if (over) return;
      pac.mouth = (pac.mouth + dt * 8) % (Math.PI / 2);

      if (fruit) {
        fruit.ttl -= dt;
        if (fruit.ttl <= 0) fruit = null;
      }

      modeTimer += dt;
      if (mode === 'scatter' && modeTimer > 7) {
        mode = 'chase';
        modeTimer = 0;
      } else if (mode === 'chase' && modeTimer > 20) {
        mode = 'scatter';
        modeTimer = 0;
      }

      let levelAdvanced = false;
      travel(pac, pacSpeed * dt, () => {
        const rx = pac.x;
        const ry = pac.y;
        if (!isWall(rx + pac.next.x, ry + pac.next.y)) pac.dir = pac.next;
        if (isWall(rx + pac.dir.x, ry + pac.dir.y)) pac.dir = { x: 0, y: 0 };

        if (dot[ry]![rx]) {
          dot[ry]![rx] = false;
          dotsDirty = true;
          dotCount--;
          score += 10;
          ctx.hud.setScore(score);
          ctx.audio.sfx('eat');
          // spawn the bonus fruit roughly halfway through the maze
          if (!fruitDone && dotCount < initialDots * 0.5) spawnFruit();
        } else if (pellet[ry]![rx]) {
          pellet[ry]![rx] = false;
          score += 50;
          ghostCombo = 0;
          ctx.hud.setScore(score);
          ctx.audio.sfx('powerup');
          ghosts.forEach((gh) => (gh.frightened = Math.max(2.5, 7 - level * 0.6)));
        }
        // Feature: bonus fruit pickup
        if (fruit && rx === fruit.c && ry === fruit.r) {
          score += fruit.worth;
          ctx.hud.setScore(score);
          ctx.hud.toast(`FRUIT +${fruit.worth}`);
          ctx.audio.sfx('coin');
          fruit = null;
        }
        if (dotCount <= 0) {
          // Feature: advance to the next level instead of ending
          level++;
          ghostSpeed = Math.min(8.5, ghostSpeed + 0.5);
          ctx.audio.sfx('levelup');
          ctx.hud.toast(`LEVEL ${level}!`);
          ctx.hud.setLabel(`EAT THE DOTS · L${level}`);
          score += 100 + lives * 50;
          resetDots();
          initialDots = dotCount;
          fruit = null;
          fruitDone = false;
          pac.x = start.x;
          pac.y = start.y;
          pac.dir = { x: 0, y: 0 };
          pac.next = { x: 0, y: 0 };
          ghosts.forEach((gh, i) => {
            gh.x = homeC;
            gh.y = homeR;
            gh.frightened = 0;
            gh.dir = [DIRS.left!, DIRS.up!, DIRS.right!, DIRS.down!][i]!;
          });
          ctx.hud.setScore(score);
          levelAdvanced = true;
        }
      });
      if (levelAdvanced) return;

      ghosts.forEach((gh) => {
        if (gh.frightened > 0) gh.frightened -= dt;
        moveGhost(gh, dt);
        if (Math.abs(gh.x - pac.x) < 0.6 && Math.abs(gh.y - pac.y) < 0.6) {
          if (gh.frightened > 0) {
            gh.x = homeC;
            gh.y = homeR;
            gh.frightened = 0;
            ghostCombo = Math.min(4, ghostCombo + 1);
            const gained = 200 * Math.pow(2, ghostCombo - 1); // 200/400/800/1600
            score += gained;
            ctx.hud.setScore(score);
            ctx.hud.toast(`GHOST +${gained}`);
            ctx.audio.sfx('coin');
          } else {
            loseLife();
          }
        }
      });
      if (over) return;

      if (dotsDirty) {
        dotsDirty = false;
        dotsG.clear();
        for (let r = 0; r < ROWS; r++)
          for (let c = 0; c < COLS; c++)
            if (dot[r]![c])
              dotsG.circle(c * cell + cell / 2, r * cell + cell / 2, cell * 0.1).fill({
                color: 0xffd27f,
              });
      }
      g.clear();
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
          if (pellet[r]![c])
            g.circle(
              c * cell + cell / 2,
              r * cell + cell / 2,
              cell * (0.2 + 0.06 * Math.sin(modeTimer * 6)),
            ).fill({ color: 0xffd27f });
          if (pellet[r]![c])
            glowCircle(g, c * cell + cell / 2, r * cell + cell / 2, cell * 0.2, 0xffd27f, 0.15);
        }
      // bonus fruit (cherry)
      if (fruit) {
        const fx = fruit.c * cell + cell / 2;
        const fy = fruit.r * cell + cell / 2;
        const flash = fruit.ttl < 3 && Math.floor(fruit.ttl * 6) % 2 === 0;
        if (!flash) {
          g.circle(fx - cell * 0.12, fy + cell * 0.1, cell * 0.18).fill({ color: 0xff2e44 });
          g.circle(fx + cell * 0.12, fy + cell * 0.1, cell * 0.18).fill({ color: 0xff2e44 });
          g.rect(fx - 1, fy - cell * 0.25, 2, cell * 0.3).fill({ color: 0x3ddc84 });
        }
      }
      const px = pac.x * cell + cell / 2;
      const py = pac.y * cell + cell / 2;
      const facing = pac.dir.x === 0 && pac.dir.y === 0 ? 0 : Math.atan2(pac.dir.y, pac.dir.x);
      const m = pac.mouth;
      glowCircle(g, px, py, cell * 0.45, 0xffd200, 0.12);
      g.moveTo(px, py)
        .arc(px, py, cell * 0.45, facing + m, facing - m + Math.PI * 2)
        .fill({ color: 0xffd200 });
      ghosts.forEach((gh) => {
        const gx = gh.x * cell + cell / 2;
        const gy = gh.y * cell + cell / 2;
        const col = gh.frightened > 0 ? (gh.frightened < 2 ? 0xffffff : 0x4a7bff) : gh.color;
        // dome head + skirt with a wavy hem
        g.circle(gx, gy - cell * 0.1, cell * 0.4).fill({ color: col });
        g.rect(gx - cell * 0.4, gy - cell * 0.1, cell * 0.8, cell * 0.45).fill({ color: col });
        const wave = Math.floor(modeTimer * 8) % 2;
        for (let k = 0; k < 4; k++)
          g.circle(
            gx - cell * 0.3 + k * cell * 0.2,
            gy + cell * 0.35 + ((k + wave) % 2) * 0.5,
            cell * 0.1,
          ).fill({ color: col });
        const ex = Math.sign(gh.dir.x) * cell * 0.05;
        const ey = Math.sign(gh.dir.y) * cell * 0.05;
        if (gh.frightened > 0) {
          g.rect(gx - cell * 0.2, gy - cell * 0.15, cell * 0.1, cell * 0.1).fill({
            color: 0xffd6ec,
          });
          g.rect(gx + cell * 0.1, gy - cell * 0.15, cell * 0.1, cell * 0.1).fill({
            color: 0xffd6ec,
          });
        } else {
          g.circle(gx - cell * 0.15, gy - cell * 0.12, cell * 0.12).fill({ color: 0xffffff });
          g.circle(gx + cell * 0.15, gy - cell * 0.12, cell * 0.12).fill({ color: 0xffffff });
          g.circle(gx - cell * 0.15 + ex, gy - cell * 0.12 + ey, cell * 0.06).fill({
            color: 0x1d2bff,
          });
          g.circle(gx + cell * 0.15 + ex, gy - cell * 0.12 + ey, cell * 0.06).fill({
            color: 0x1d2bff,
          });
        }
      });
    },
    destroy() {
      offDown();
      offSwipe();
      layer.destroy({ children: true });
    },
  };
}
