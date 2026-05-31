import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action, Dir } from '@core/InputManager';

interface Mover {
  x: number;
  w: number;
  lane: number;
  speed: number;
  log: boolean;
}

const DIRS: Record<string, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const rows = 14;
  const cell = Math.floor(H / rows);
  const cols = Math.floor(W / cell);
  const ox = (W - cols * cell) / 2;

  const layer = new Container();
  layer.position.set(ox, 0);
  ctx.stage.addChild(layer);
  const bgG = new Graphics();
  const g = new Graphics();
  layer.addChild(bgG, g);

  const riverRows = [1, 2, 3, 4, 5];
  const roadRows = [7, 8, 9, 10, 11, 12];

  const movers: Mover[] = [];
  const buildMovers = (): void => {
    movers.length = 0;
    for (const lane of [...riverRows, ...roadRows]) {
      const isRiver = riverRows.includes(lane);
      const dir = lane % 2 === 0 ? 1 : -1;
      const speed = (0.8 + ctx.rng.next() * 1.4) * dir * cell;
      const w = isRiver ? cell * (2 + Math.floor(ctx.rng.next() * 2)) : cell * 1.4;
      const count = 3;
      for (let i = 0; i < count; i++)
        movers.push({ x: (cols / count) * i * cell + ctx.rng.next() * cell, w, lane, speed, log: isRiver });
    }
  };
  buildMovers();

  const frog = { col: Math.floor(cols / 2), row: rows - 1 };
  const homes = [false, false, false, false, false];
  let score = 0;
  let lives = 3;
  let frogX = frog.col * cell;

  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('GET HOME');

  const reset = (): void => {
    frog.col = Math.floor(cols / 2);
    frog.row = rows - 1;
    frogX = frog.col * cell;
  };

  const die = (): void => {
    lives--;
    ctx.hud.setLives(lives);
    ctx.audio.sfx('hit');
    if (lives <= 0) ctx.gameOver(score, { homes: homes.filter(Boolean).length });
    else reset();
  };

  const hop = (a: Action | Dir): void => {
    const d = DIRS[a];
    if (!d) return;
    frog.col = Math.max(0, Math.min(cols - 1, frog.col + d.x));
    frog.row = Math.max(0, Math.min(rows - 1, frog.row + d.y));
    frogX = frog.col * cell;
    if (d.y < 0) score += 2;
    ctx.audio.sfx('jump');
    ctx.hud.setScore(score);
  };
  const offDown = ctx.input.on('down', hop);
  const offSwipe = ctx.input.on('swipe', hop);

  const draw = (): void => {
    bgG.clear();
    for (let r = 0; r < rows; r++) {
      let col = 0x14141f;
      if (r === 0) col = 0x1d3b1d;
      else if (riverRows.includes(r)) col = 0x16335a;
      else if (roadRows.includes(r)) col = 0x1a1a22;
      else if (r === 6 || r === rows - 1) col = 0x24402a;
      bgG.rect(0, r * cell, cols * cell, cell).fill({ color: col });
    }
    for (let i = 0; i < 5; i++) {
      const hx = (i + 0.5) * (cols / 5) * cell;
      bgG.roundRect(hx - cell * 0.4, 2, cell * 0.8, cell - 4, 4).fill({ color: homes[i] ? 0x3ddc84 : 0x0d1f0d });
    }
    g.clear();
    movers.forEach((m) => {
      g.roundRect(m.x, m.lane * cell + 4, m.w, cell - 8, 5).fill({ color: m.log ? 0x8a5a2b : 0xff5252 });
    });
    g.roundRect(frogX + 4, frog.row * cell + 4, cell - 8, cell - 8, 6).fill({ color: 0x9bffce });
  };

  return {
    update(dt) {
      movers.forEach((m) => {
        m.x += m.speed * dt;
        if (m.speed > 0 && m.x > cols * cell) m.x = -m.w;
        if (m.speed < 0 && m.x < -m.w) m.x = cols * cell;
      });

      if (riverRows.includes(frog.row)) {
        const log = movers.find(
          (m) => m.log && m.lane === frog.row && frogX + cell / 2 > m.x && frogX + cell / 2 < m.x + m.w,
        );
        if (log) {
          frogX += log.speed * dt;
          if (frogX < -cell || frogX > cols * cell) return die();
          frog.col = Math.round(frogX / cell);
        } else {
          ctx.audio.sfx('explosion');
          return die();
        }
      } else if (roadRows.includes(frog.row)) {
        const hit = movers.some(
          (m) => !m.log && m.lane === frog.row && frogX + cell * 0.7 > m.x && frogX + cell * 0.3 < m.x + m.w,
        );
        if (hit) return die();
      } else if (frog.row === 0) {
        const slot = Math.floor((frogX / (cols * cell)) * 5);
        if (slot >= 0 && slot < 5 && !homes[slot]) {
          homes[slot] = true;
          score += 50;
          ctx.hud.setScore(score);
          ctx.audio.sfx('powerup');
          ctx.hud.toast('HOME!');
          if (homes.every(Boolean)) {
            ctx.audio.sfx('levelup');
            homes.fill(false);
            score += 200;
            buildMovers();
          }
          reset();
        } else {
          return die();
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
