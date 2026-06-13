import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import { idx } from '@kits/grid/core';

const N = 6;

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const size = Math.min(W - 28, H - 120);
  const cell = size / N;
  const ox = (W - size) / 2;
  const oy = 78;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const grid = new Array<number>(N * N).fill(0);
  let moves = 20;
  let score = 0;
  let over = false;
  const queue: number[] = [];

  ctx.hud.setScore(0);
  ctx.hud.setLabel(`MOVES ${moves}`);

  const add = (c: number, r: number): void => {
    if (c < 0 || c >= N || r < 0 || r >= N) return;
    const i = idx(N, c, r);
    grid[i] = (grid[i] ?? 0) + 1;
    if (grid[i]! >= 4) queue.push(i);
  };

  const resolve = (): void => {
    while (queue.length) {
      const i = queue.shift()!;
      if ((grid[i] ?? 0) < 4) continue;
      grid[i] = 0;
      const c = i % N;
      const r = Math.floor(i / N);
      score += 40;
      add(c + 1, r);
      add(c - 1, r);
      add(c, r + 1);
      add(c, r - 1);
      ctx.fx.flashRect(ox + c * cell, oy + r * cell, cell, cell, 0xc084fc);
    }
    ctx.hud.setScore(score);
  };

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (over) return;
    const c = Math.floor((x - ox) / cell);
    const r = Math.floor((y - oy) / cell);
    if (c < 0 || r < 0 || c >= N || r >= N) return;
    moves--;
    add(c, r);
    resolve();
    ctx.audio.sfx('blip');
    ctx.hud.setLabel(`MOVES ${moves}`);
    if (moves <= 0) {
      over = true;
      ctx.gameOver(score, { cells: grid.filter(Boolean).length });
    }
    draw();
  });

  function draw(): void {
    g.clear();
    g.roundRect(ox - 5, oy - 5, size + 10, size + 10, 10).fill({ color: 0x151021 });
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const value = grid[idx(N, c, r)] ?? 0;
        const x = ox + c * cell;
        const y = oy + r * cell;
        g.roundRect(x + 3, y + 3, cell - 6, cell - 6, 7).fill({ color: 0x251638 }).stroke({ width: 1, color: 0x6d28d9, alpha: 0.55 });
        for (let p = 0; p < value; p++) {
          const px = x + cell * (0.34 + (p % 2) * 0.32);
          const py = y + cell * (0.34 + Math.floor(p / 2) * 0.32);
          g.circle(px, py, cell * 0.09).fill({ color: 0xc084fc });
        }
      }
    }
  }

  draw();
  return {
    update() {},
    destroy() {
      offTap();
      layer.destroy({ children: true });
    },
  };
}
