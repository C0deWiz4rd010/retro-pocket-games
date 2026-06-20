import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action, Dir } from '@core/InputManager';

interface Bomb {
  c: number;
  r: number;
  t: number;
}
interface Enemy {
  c: number;
  r: number;
  dir: { x: number; y: number };
  moveT: number;
}

const DIRS: Record<string, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

// 0 empty, 1 hard wall, 2 soft block
export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const cols = 13;
  const rows = 11;
  const cell = Math.floor(Math.min(W / cols, H / rows));
  const ox = (W - cols * cell) / 2;
  const oy = (H - rows * cell) / 2;

  const layer = new Container();
  layer.position.set(ox, oy);
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const grid = new Uint8Array(cols * rows);
  const gi = (c: number, r: number): number => r * cols + c;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (r === 0 || c === 0 || r === rows - 1 || c === cols - 1 || (r % 2 === 0 && c % 2 === 0)) grid[gi(c, r)] = 1;
      else if (ctx.rng.next() < 0.45 && !(c <= 2 && r <= 2)) grid[gi(c, r)] = 2;
    }

  const player = { c: 1, r: 1 };
  let bombs: Bomb[] = [];
  let blasts: { c: number; r: number; t: number }[] = [];
  let enemies: Enemy[] = [];
  const particles: { x: number; y: number; vx: number; vy: number; life: number; color: number }[] = [];
  let range = 1;
  let maxBombs = 1;
  let pierce = false; // Feature: blasts pass through soft blocks
  let shield = false; // Feature: absorbs one hit
  let score = 0;
  let lives = 3;
  let over = false;
  let level = 1;
  let shake = 0;
  let pulse = 0;
  let exit: { c: number; r: number } | null = null; // Feature: exit portal
  let exitRevealed = false;

  const placeExit = (): void => {
    const blocks: { c: number; r: number }[] = [];
    for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) if (grid[gi(c, r)] === 2) blocks.push({ c, r });
    exit = blocks.length ? ctx.rng.pick(blocks) : null;
    exitRevealed = false;
  };

  const burst = (c: number, r: number, color: number, n = 8): void => {
    const cx = c * cell + cell / 2;
    const cy = r * cell + cell / 2;
    for (let i = 0; i < n; i++) {
      const a = ctx.rng.next() * Math.PI * 2;
      const s = 40 + ctx.rng.next() * 110;
      particles.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, color });
    }
  };

  const setLabel = (): void => ctx.hud.setLabel(`L${level}${pierce ? ' ⊕' : ''}${shield ? ' 🛡' : ''}`);

  const spawnEnemies = (n: number): void => {
    enemies = [];
    let placed = 0;
    let guard = 0;
    while (placed < n && guard++ < 500) {
      const c = ctx.rng.int(1, cols - 2);
      const r = ctx.rng.int(1, rows - 2);
      if (grid[gi(c, r)] === 0 && (c > 3 || r > 3)) {
        enemies.push({ c, r, dir: ctx.rng.pick(Object.values(DIRS)), moveT: 0 });
        placed++;
      }
    }
  };
  spawnEnemies(3);
  placeExit();

  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('BOMB THE MAZE');

  const placeBomb = (): void => {
    if (bombs.length >= maxBombs) return;
    if (bombs.some((b) => b.c === player.c && b.r === player.r)) return;
    bombs.push({ c: player.c, r: player.r, t: 2 });
    ctx.audio.sfx('blip');
  };

  const move = (a: Action | Dir): void => {
    const d = DIRS[a];
    if (!d) return;
    const nc = player.c + d.x;
    const nr = player.r + d.y;
    if (grid[gi(nc, nr)] === 0 && !bombs.some((b) => b.c === nc && b.r === nr)) {
      player.c = nc;
      player.r = nr;
    }
  };
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a' || a === 'b') placeBomb();
    else move(a);
  });
  const offSwipe = ctx.input.on('swipe', move);

  const breakBlock = (c: number, r: number): void => {
    grid[gi(c, r)] = 0;
    score += 5;
    burst(c, r, 0x8a5a2b, 5);
    if (exit && exit.c === c && exit.r === r) exitRevealed = true;
    else if (ctx.rng.next() < 0.28) {
      // power-up drop: 3 range / 4 bomb / 5 pierce / 6 shield
      const roll = ctx.rng.next();
      grid[gi(c, r)] = roll < 0.4 ? 3 : roll < 0.75 ? 4 : roll < 0.9 ? 5 : 6;
    }
  };

  const explode = (b: Bomb): void => {
    const cells = [{ c: b.c, r: b.r }];
    for (const d of Object.values(DIRS)) {
      for (let i = 1; i <= range; i++) {
        const c = b.c + d.x * i;
        const r = b.r + d.y * i;
        if (grid[gi(c, r)] === 1) break;
        cells.push({ c, r });
        if (grid[gi(c, r)] === 2) {
          breakBlock(c, r);
          if (!pierce) break; // Feature: pierce continues through blocks
        }
      }
    }
    blasts.push(...cells.map((p) => ({ ...p, t: 0.4 })));
    shake = Math.max(shake, 0.3);
    for (const p of cells) burst(p.c, p.r, 0xff7b00, 4);
    ctx.audio.sfx('explosion');
    // chain other bombs
    for (const other of bombs) if (cells.some((p) => p.c === other.c && p.r === other.r)) other.t = 0;
    // kill enemies / player in blast
    enemies = enemies.filter((e) => {
      if (cells.some((p) => p.c === e.c && p.r === e.r)) {
        score += 100;
        burst(e.c, e.r, 0xff4d4d, 10);
        return false;
      }
      return true;
    });
    if (cells.some((p) => p.c === player.c && p.r === player.r)) loseLife();
    ctx.hud.setScore(score);
  };

  const loseLife = (): void => {
    if (shield) {
      shield = false;
      shake = 0.5;
      burst(player.c, player.r, 0x00f7ff, 12);
      ctx.audio.sfx('powerup');
      ctx.hud.toast('SHIELD ABSORBED');
      setLabel();
      return;
    }
    lives--;
    shake = 0.5;
    burst(player.c, player.r, 0x3ddc84, 12);
    ctx.hud.setLives(lives);
    ctx.audio.sfx('hit');
    if (lives <= 0) {
      over = true;
      ctx.gameOver(score, { level });
    } else {
      player.c = 1;
      player.r = 1;
    }
  };

  const draw = (): void => {
    g.clear();
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const v = grid[gi(c, r)]!;
        const x = c * cell;
        const y = r * cell;
        if (v === 1) g.rect(x, y, cell, cell).fill({ color: 0x4a4a5a });
        else if (v === 2) g.roundRect(x + 1, y + 1, cell - 2, cell - 2, 3).fill({ color: 0x8a5a2b });
        else g.rect(x, y, cell, cell).fill({ color: 0x14141f });
        if (v === 3) g.circle(x + cell / 2, y + cell / 2, cell * 0.2).fill({ color: 0xff7b00 });
        if (v === 4) g.circle(x + cell / 2, y + cell / 2, cell * 0.2).fill({ color: 0x00f7ff });
        if (v === 5) g.star(x + cell / 2, y + cell / 2, 4, cell * 0.22, cell * 0.1).fill({ color: 0xc084fc });
        if (v === 6) g.circle(x + cell / 2, y + cell / 2, cell * 0.2).fill({ color: 0x3ddc84 });
      }
    // exit portal (visible once its block is destroyed)
    if (exit && exitRevealed) {
      const ex = exit.c * cell + cell / 2;
      const ey = exit.r * cell + cell / 2;
      const ready = enemies.length === 0;
      const rr = cell * (0.32 + 0.06 * Math.sin(pulse * 5));
      g.circle(ex, ey, rr).stroke({ width: 3, color: ready ? 0x3ddc84 : 0x9aa0ff, alpha: 0.9 });
      g.circle(ex, ey, rr * 0.5).fill({ color: ready ? 0x3ddc84 : 0x4a4a7a, alpha: 0.7 });
    }
    blasts.forEach((b) => g.rect(b.c * cell + 2, b.r * cell + 2, cell - 4, cell - 4).fill({ color: 0xff7b00, alpha: 0.7 }));
    bombs.forEach((b) => {
      const sc = 0.3 + 0.06 * Math.sin(pulse * 12) * (b.t < 1 ? 2 : 1);
      g.circle(b.c * cell + cell / 2, b.r * cell + cell / 2, cell * sc).fill({ color: 0x101018 });
      g.circle(b.c * cell + cell / 2, b.r * cell + cell / 2, cell * sc * 0.4).fill({ color: b.t < 0.6 ? 0xff4d4d : 0xff7b00 });
    });
    enemies.forEach((e) => g.roundRect(e.c * cell + 3, e.r * cell + 3, cell - 6, cell - 6, 4).fill({ color: 0xff4d4d }));
    g.roundRect(player.c * cell + 3, player.r * cell + 3, cell - 6, cell - 6, 5).fill({ color: shield ? 0x9bffce : 0x3ddc84 });
    if (shield) g.circle(player.c * cell + cell / 2, player.r * cell + cell / 2, cell * 0.5).stroke({ width: 2, color: 0x00f7ff, alpha: 0.6 });
    // particles
    for (const p of particles) g.circle(p.x, p.y, 3 * Math.min(1, p.life * 2)).fill({ color: p.color, alpha: Math.min(1, p.life * 2) });
  };

  return {
    update(dt) {
      if (over) return;
      pulse += dt;
      if (shake > 0) shake = Math.max(0, shake - dt * 2);
      // particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }
      // pick up powerups
      const cellVal = grid[gi(player.c, player.r)]!;
      if (cellVal === 3) {
        range++;
        grid[gi(player.c, player.r)] = 0;
        ctx.audio.sfx('powerup');
        ctx.hud.toast('RANGE UP');
      } else if (cellVal === 4) {
        maxBombs++;
        grid[gi(player.c, player.r)] = 0;
        ctx.audio.sfx('powerup');
        ctx.hud.toast('BOMB UP');
      } else if (cellVal === 5) {
        pierce = true;
        grid[gi(player.c, player.r)] = 0;
        ctx.audio.sfx('powerup');
        ctx.hud.toast('PIERCE BLAST');
        setLabel();
      } else if (cellVal === 6) {
        shield = true;
        grid[gi(player.c, player.r)] = 0;
        ctx.audio.sfx('powerup');
        ctx.hud.toast('SHIELD');
        setLabel();
      }

      // Feature: reach the revealed exit (after clearing enemies) to advance
      if (exit && exitRevealed && enemies.length === 0 && player.c === exit.c && player.r === exit.r) {
        level++;
        score += 300;
        ctx.hud.setScore(score);
        setLabel();
        ctx.audio.sfx('levelup');
        ctx.hud.toast(`LEVEL ${level}!`);
        for (let r = 1; r < rows - 1; r++)
          for (let c = 1; c < cols - 1; c++)
            if (grid[gi(c, r)] === 0 && !(c <= 2 && r <= 2) && ctx.rng.next() < 0.4) grid[gi(c, r)] = 2;
        spawnEnemies(3 + level);
        placeExit();
        player.c = 1;
        player.r = 1;
        bombs = [];
        blasts = [];
        draw();
        return;
      }

      for (const b of bombs) b.t -= dt;
      const exploding = bombs.filter((b) => b.t <= 0);
      bombs = bombs.filter((b) => b.t > 0);
      exploding.forEach(explode);
      if (over) return;

      for (const b of blasts) b.t -= dt;
      blasts = blasts.filter((b) => b.t > 0);

      // enemy movement
      enemies.forEach((e) => {
        e.moveT -= dt;
        if (e.moveT <= 0) {
          e.moveT = 0.4;
          const opts = Object.values(DIRS).filter((d) => grid[gi(e.c + d.x, e.r + d.y)] === 0);
          if (opts.length) {
            // mostly keep direction
            if (grid[gi(e.c + e.dir.x, e.r + e.dir.y)] !== 0 || ctx.rng.next() < 0.3) e.dir = ctx.rng.pick(opts);
            e.c += e.dir.x;
            e.r += e.dir.y;
          }
          if (e.c === player.c && e.r === player.r) loseLife();
        }
      });

      if (!over && enemies.length === 0) {
        if (!exit) {
          // no block hid an exit — fall back to auto-advance
          level++;
          score += 200;
          ctx.hud.setScore(score);
          setLabel();
          ctx.audio.sfx('levelup');
          ctx.hud.toast(`LEVEL ${level}`);
          for (let r = 1; r < rows - 1; r++)
            for (let c = 1; c < cols - 1; c++)
              if (grid[gi(c, r)] === 0 && !(c <= 2 && r <= 2) && ctx.rng.next() < 0.4) grid[gi(c, r)] = 2;
          spawnEnemies(3 + level);
          placeExit();
        } else if (!exitRevealed) {
          ctx.hud.setLabel('FIND THE EXIT!');
        } else {
          ctx.hud.setLabel('REACH THE EXIT →');
        }
      }
      layer.position.set(ox + (shake > 0 ? (ctx.rng.next() * 2 - 1) * shake * 6 : 0), oy + (shake > 0 ? (ctx.rng.next() * 2 - 1) * shake * 6 : 0));
      draw();
    },
    destroy() {
      offDown();
      offSwipe();
      layer.destroy({ children: true });
    },
  };
}
