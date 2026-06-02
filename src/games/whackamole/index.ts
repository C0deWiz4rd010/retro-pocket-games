import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

export default function createGame(ctx: GameContext): Game {
  const cols = 3;
  const rows = 3;
  const W = ctx.width;
  const H = ctx.height;
  const cellW = Math.min(W, 380) / cols;
  const cellH = (H - 60) / rows;
  const ox = (W - cellW * cols) / 2;
  const oy = 40;

  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  // each hole: up amount 0..1, state
  const holes = Array.from({ length: cols * rows }, () => ({ up: 0, active: false, golden: false, timer: 0 }));
  let score = 0;
  let misses = 0;
  let timeLeft = 30;
  let spawnAcc = 0;
  let over = false;

  ctx.hud.setScore(0);
  ctx.hud.setLabel('30s');

  const holeCenter = (i: number): { x: number; y: number } => ({
    x: ox + (i % cols) * cellW + cellW / 2,
    y: oy + Math.floor(i / cols) * cellH + cellH / 2,
  });

  const whack = (vx: number, vy: number): void => {
    if (over) return;
    for (let i = 0; i < holes.length; i++) {
      const h = holes[i]!;
      if (!h.active || h.up < 0.4) continue;
      const c = holeCenter(i);
      if (Math.hypot(vx - c.x, vy - c.y) < cellW * 0.32) {
        score += h.golden ? 50 : 10;
        ctx.hud.setScore(score);
        ctx.audio.sfx(h.golden ? 'coin' : 'hit');
        h.active = false;
        h.golden = false;
        return;
      }
    }
    misses++;
    ctx.audio.sfx('blip');
  };
  const offTap = ctx.input.on('tap', ({ x, y }) => whack(x, y));

  const draw = (): void => {
    g.clear();
    for (let i = 0; i < holes.length; i++) {
      const c = holeCenter(i);
      const rx = cellW * 0.36;
      const ry = cellH * 0.18;
      g.ellipse(c.x, c.y + ry, rx, ry).fill({ color: 0x3a2a1a });
      const h = holes[i]!;
      if (h.active && h.up > 0) {
        const moleY = c.y + ry - h.up * ry * 2.4;
        g.circle(c.x, moleY, rx * 0.7).fill({ color: h.golden ? 0xffd200 : 0x8d6e63 });
        g.circle(c.x - rx * 0.25, moleY - rx * 0.1, rx * 0.12).fill({ color: 0x101018 });
        g.circle(c.x + rx * 0.25, moleY - rx * 0.1, rx * 0.12).fill({ color: 0x101018 });
        g.ellipse(c.x, moleY + rx * 0.25, rx * 0.2, rx * 0.14).fill({ color: 0xff80ab });
      }
    }
  };

  return {
    update(dt) {
      if (over) return;
      timeLeft -= dt;
      ctx.hud.setLabel(`${Math.ceil(timeLeft)}s`);
      if (timeLeft <= 0) {
        over = true;
        ctx.audio.sfx('levelup');
        ctx.gameOver(score, { misses });
        return;
      }

      spawnAcc += dt;
      const rate = Math.max(0.4, 0.9 - (30 - timeLeft) * 0.015);
      if (spawnAcc >= rate) {
        spawnAcc = 0;
        const free = holes.map((h, i) => (h.active ? -1 : i)).filter((i) => i >= 0);
        if (free.length) {
          const h = holes[ctx.rng.pick(free)]!;
          h.active = true;
          h.golden = ctx.rng.next() < 0.15;
          h.timer = 0.8 + ctx.rng.next() * 0.8;
          h.up = 0;
        }
      }

      for (const h of holes) {
        if (h.active) {
          h.timer -= dt;
          h.up = Math.min(1, h.up + dt * 5);
          if (h.timer <= 0) {
            h.active = false;
            h.golden = false;
          }
        } else if (h.up > 0) {
          h.up = Math.max(0, h.up - dt * 5);
        }
      }
      draw();
    },
    destroy() {
      offTap();
      layer.destroy({ children: true });
    },
  };
}
