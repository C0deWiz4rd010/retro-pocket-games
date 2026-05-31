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
  let range = 1;
  let maxBombs = 1;
  let score = 0;
  let lives = 3;
  let over = false;
  let level = 1;

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

  const explode = (b: Bomb): void => {
    const cells = [{ c: b.c, r: b.r }];
    for (const d of Object.values(DIRS)) {
      for (let i = 1; i <= range; i++) {
        const c = b.c + d.x * i;
        const r = b.r + d.y * i;
        if (grid[gi(c, r)] === 1) break;
        cells.push({ c, r });
        if (grid[gi(c, r)] === 2) {
          grid[gi(c, r)] = 0;
          score += 5;
          if (ctx.rng.next() < 0.25) {
            // power-up drop encoded as 3 (range) / 4 (bomb)
            grid[gi(c, r)] = ctx.rng.next() < 0.5 ? 3 : 4;
          }
          break;
        }
      }
    }
    blasts.push(...cells.map((p) => ({ ...p, t: 0.4 })));
    ctx.audio.sfx('explosion');
    // chain other bombs
    for (const other of bombs) if (cells.some((p) => p.c === other.c && p.r === other.r)) other.t = 0;
    // kill enemies / player in blast
    enemies = enemies.filter((e) => {
      if (cells.some((p) => p.c === e.c && p.r === e.r)) {
        score += 100;
        return false;
      }
      return true;
    });
    if (cells.some((p) => p.c === player.c && p.r === player.r)) loseLife();
    ctx.hud.setScore(score);
  };

  const loseLife = (): void => {
    lives--;
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
      }
    blasts.forEach((b) => g.rect(b.c * cell + 2, b.r * cell + 2, cell - 4, cell - 4).fill({ color: 0xff7b00, alpha: 0.7 }));
    bombs.forEach((b) => g.circle(b.c * cell + cell / 2, b.r * cell + cell / 2, cell * 0.32).fill({ color: 0x101018 }));
    enemies.forEach((e) => g.roundRect(e.c * cell + 3, e.r * cell + 3, cell - 6, cell - 6, 4).fill({ color: 0xff4d4d }));
    g.roundRect(player.c * cell + 3, player.r * cell + 3, cell - 6, cell - 6, 5).fill({ color: 0x3ddc84 });
  };

  return {
    update(dt) {
      if (over) return;
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
        level++;
        score += 200;
        ctx.hud.setScore(score);
        ctx.hud.setLabel(`LEVEL ${level}`);
        ctx.audio.sfx('levelup');
        ctx.hud.toast(`LEVEL ${level}`);
        // regenerate soft blocks
        for (let r = 1; r < rows - 1; r++)
          for (let c = 1; c < cols - 1; c++)
            if (grid[gi(c, r)] === 0 && !(c <= 2 && r <= 2) && ctx.rng.next() < 0.4) grid[gi(c, r)] = 2;
        spawnEnemies(3 + level);
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
