import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action } from '@core/InputManager';

/**
 * Q*bert-lite: hop down an isometric pyramid of cubes, flipping each to the target
 * color. Four diagonal hops mapped to the d-pad. Falling off the edge costs a life.
 * Enemies hop down after you, higher levels need several flips per cube, and a bonus
 * orb freezes foes.
 */
interface Cube {
  row: number;
  col: number;
  state: number; // flip progress 0..target
}
interface Hopper { row: number; col: number; t: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: number }

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const SIZE = 7; // pyramid rows
  const tile = Math.floor(Math.min(W / 9, H / 11));
  const cubeH = tile * 0.7;
  const cx = W / 2;
  const topY = H * 0.16;

  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const cubes: Cube[][] = [];
  for (let row = 0; row < SIZE; row++) {
    cubes[row] = [];
    for (let col = 0; col <= row; col++) cubes[row]![col] = { row, col, state: 0 };
  }

  const pos = (row: number, col: number): { x: number; y: number } => ({
    x: cx + (col - row / 2) * tile * 1.1,
    y: topY + row * cubeH,
  });

  const q = { row: 0, col: 0, fall: false };
  const enemies: Hopper[] = [];
  const particles: Particle[] = [];
  let orb: Hopper | null = null;
  let score = 0;
  let lives = 3;
  let over = false;
  let level = 1;
  let flipped = 0;
  let target = 1; // flips needed per cube
  let enemyTimer = 3;
  let orbTimer = 9;
  let freeze = 0;

  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('FLIP ALL CUBES · L1');

  const totalCubes = (): number => (SIZE * (SIZE + 1)) / 2;
  const onBoard = (r: number, c: number): boolean => r >= 0 && r < SIZE && c >= 0 && c <= r;

  const burst = (r: number, c: number, color: number, n = 8): void => {
    const p = pos(r, c);
    for (let i = 0; i < n; i++) {
      const a = ctx.rng.next() * Math.PI * 2;
      const s = 40 + ctx.rng.next() * 90;
      particles.push({ x: p.x, y: p.y + cubeH * 0.4, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, color });
    }
  };

  // Four diagonal hops mapped to the d-pad:
  //  up = up-left, right = up-right, down = down-right, left = down-left.
  const hopDelta = (a: Action): { dr: number; dc: number } | null => {
    if (a === 'up') return { dr: -1, dc: -1 };
    if (a === 'right') return { dr: -1, dc: 0 };
    if (a === 'down') return { dr: 1, dc: 1 };
    if (a === 'left') return { dr: 1, dc: 0 };
    return null;
  };
  const hop = (a: Action): void => {
    if (over || q.fall) return;
    const move = hopDelta(a);
    if (!move) return;
    const nr = q.row + move.dr;
    const nc = q.col + move.dc;

    ctx.audio.sfx('jump');
    if (!onBoard(nr, nc)) {
      q.fall = true;
      ctx.audio.sfx('hit');
      window.setTimeout(() => loseLife(), 200);
      return;
    }
    q.row = nr;
    q.col = nc;
    const cube = cubes[nr]![nc]!;
    if (cube.state < target) {
      cube.state++;
      burst(nr, nc, 0x3ddc84, 5);
      score += 25;
      ctx.hud.setScore(score);
      ctx.audio.sfx('coin');
      if (cube.state >= target) {
        flipped++;
        if (flipped >= totalCubes()) nextLevel();
      }
    }
    checkHit();
  };
  const offDown = ctx.input.on('down', hop);
  const offSwipe = ctx.input.on('swipe', (d) => hop(d));

  const loseLife = (): void => {
    lives--;
    burst(q.row, q.col, 0xff7b00, 12);
    ctx.hud.setLives(lives);
    enemies.length = 0;
    if (lives <= 0) {
      over = true;
      ctx.gameOver(score, { level });
    } else {
      q.row = 0;
      q.col = 0;
      q.fall = false;
    }
  };

  const checkHit = (): void => {
    if (freeze > 0) return;
    if (enemies.some((e) => e.row === q.row && e.col === q.col)) {
      ctx.audio.sfx('hit');
      loseLife();
    }
  };

  const nextLevel = (): void => {
    level++;
    flipped = 0;
    target = Math.min(3, 1 + Math.floor(level / 2)); // Feature: multi-flip cubes
    score += 500;
    enemies.length = 0;
    ctx.hud.setScore(score);
    ctx.hud.setLabel(`LEVEL ${level} · ${target} FLIPS`);
    ctx.audio.sfx('levelup');
    ctx.hud.toast(`LEVEL ${level}`);
    for (const rowArr of cubes) for (const c of rowArr) c.state = 0;
    q.row = 0;
    q.col = 0;
  };

  const hopDown = (h: Hopper): boolean => {
    // random diagonal descent; returns false if it falls off
    const dc = ctx.rng.next() < 0.5 ? 0 : 1;
    const nr = h.row + 1;
    const nc = h.col + dc;
    if (!onBoard(nr, nc)) return false;
    h.row = nr;
    h.col = nc;
    return true;
  };

  const drawCube = (x: number, y: number, state: number): void => {
    const f = state / target;
    const top = f >= 1 ? 0x3ddc84 : f > 0 ? 0x9cc9ff : 0xffd200;
    const left = f >= 1 ? 0x2bb86c : f > 0 ? 0x6a9fd6 : 0xc99a00;
    const right = f >= 1 ? 0x238f54 : f > 0 ? 0x4a7bb0 : 0xa37e00;
    const hw = tile * 0.55;
    g.poly([x, y, x + hw, y + cubeH * 0.4, x, y + cubeH * 0.8, x - hw, y + cubeH * 0.4]).fill({ color: top });
    g.poly([x - hw, y + cubeH * 0.4, x, y + cubeH * 0.8, x, y + cubeH * 1.3, x - hw, y + cubeH * 0.9]).fill({ color: left });
    g.poly([x + hw, y + cubeH * 0.4, x, y + cubeH * 0.8, x, y + cubeH * 1.3, x + hw, y + cubeH * 0.9]).fill({ color: right });
  };

  const draw = (): void => {
    g.clear();
    for (let row = 0; row < SIZE; row++)
      for (let col = 0; col <= row; col++) {
        const p = pos(row, col);
        drawCube(p.x, p.y, cubes[row]![col]!.state);
      }
    // particles
    for (const p of particles) g.circle(p.x, p.y, 3 * Math.min(1, p.life * 2)).fill({ color: p.color, alpha: Math.min(1, p.life * 2) });
    // bonus orb
    if (orb) {
      const p = pos(orb.row, orb.col);
      g.circle(p.x, p.y, tile * 0.26).fill({ color: 0x00f7ff });
      g.circle(p.x, p.y, tile * 0.13).fill({ color: 0xccffff });
    }
    // enemies
    enemies.forEach((e) => {
      const p = pos(e.row, e.col);
      g.circle(p.x, p.y, tile * 0.28).fill({ color: freeze > 0 ? 0x6a9fd6 : 0xb14cff });
    });
    // q*bert
    const qp = pos(q.row, q.col);
    const oy = q.fall ? 30 : -cubeH * 0.5;
    g.circle(qp.x, qp.y + oy, tile * 0.3).fill({ color: 0xff7b00 });
    g.circle(qp.x - 4, qp.y + oy - 3, 2).fill({ color: 0x101018 });
    g.circle(qp.x + 4, qp.y + oy - 3, 2).fill({ color: 0x101018 });
  };

  return {
    update(dt) {
      if (over) return;
      if (freeze > 0) freeze -= dt;
      // particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }

      // spawn enemies
      enemyTimer -= dt;
      if (enemyTimer <= 0 && enemies.length < 1 + level) {
        enemyTimer = Math.max(1.5, 3.5 - level * 0.2);
        enemies.push({ row: 0, col: 0, t: 0 });
      }
      // move enemies
      if (freeze <= 0) {
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i]!;
          e.t += dt;
          if (e.t >= 0.7) {
            e.t = 0;
            if (!hopDown(e)) enemies.splice(i, 1);
            else if (e.row === q.row && e.col === q.col) { ctx.audio.sfx('hit'); loseLife(); return; }
          }
        }
      }

      // bonus orb
      orbTimer -= dt;
      if (!orb && orbTimer <= 0) {
        orb = { row: 0, col: 0, t: 0 };
        orbTimer = 14 + ctx.rng.next() * 8;
      }
      if (orb) {
        orb.t += dt;
        if (orb.t >= 0.8) {
          orb.t = 0;
          if (!hopDown(orb)) orb = null;
        }
        if (orb && orb.row === q.row && orb.col === q.col) {
          freeze = 5;
          score += 150;
          ctx.hud.setScore(score);
          ctx.hud.toast('FREEZE +150');
          burst(orb.row, orb.col, 0x00f7ff, 12);
          ctx.audio.sfx('powerup');
          orb = null;
        }
      }

      draw();
    },
    destroy() {
      offDown();
      offSwipe();
      layer.destroy({ children: true });
    },
  };
}
