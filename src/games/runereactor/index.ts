import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import { idx } from '@kits/grid/core';
import { burst, drawBackdrop, drawSparks, type Spark, updateSparks } from '@games/_shared/juice';

const N = 6;
const COLORS = [0x182033, 0x22d3ee, 0xffd200, 0xff4d8d];

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const size = Math.min(W - 32, H - 144);
  const cell = size / N;
  const ox = (W - size) / 2;
  const oy = 94;
  const layer = new Container();
  const g = new Graphics();
  layer.addChild(g);
  ctx.stage.addChild(layer);
  const grid = new Array<number>(N * N).fill(0).map(() => ctx.rng.int(0, 2));
  const sparks: Spark[] = [];
  let score = 0;
  let time = 40;
  let chain = 0;
  let t = 0;
  let over = false;

  ctx.hud.setScore(0);
  ctx.hud.setLabel('40s');

  const add = (c: number, r: number): void => {
    if (c < 0 || r < 0 || c >= N || r >= N) return;
    grid[idx(N, c, r)] = (grid[idx(N, c, r)] ?? 0) + 1;
  };

  const resolve = (): void => {
    let again = true;
    while (again) {
      again = false;
      for (let i = 0; i < grid.length; i++) {
        if ((grid[i] ?? 0) < 4) continue;
        again = true;
        chain++;
        const c = i % N;
        const r = Math.floor(i / N);
        grid[i] = 0;
        score += 90 + chain * 30;
        burst(sparks, ctx.rng, ox + c * cell + cell / 2, oy + r * cell + cell / 2, 0xb388ff, 20, 150);
        add(c + 1, r);
        add(c - 1, r);
        add(c, r + 1);
        add(c, r - 1);
      }
    }
  };

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (over) return;
    const c = Math.floor((x - ox) / cell);
    const r = Math.floor((y - oy) / cell);
    if (c < 0 || r < 0 || c >= N || r >= N) return;
    chain = 0;
    add(c, r);
    resolve();
    score += 12;
    ctx.hud.setScore(score);
    ctx.audio.sfx(chain > 2 ? 'powerup' : 'blip');
    if (chain > 0) ctx.fx.floatingText(`CHAIN ${chain}`, W / 2, oy - 20, 0xb388ff);
  });

  function draw(): void {
    g.clear();
    drawBackdrop(g, W, H, t, 0x27174b, 0x050512);
    g.roundRect(ox - 7, oy - 7, size + 14, size + 14, 12).fill({ color: 0x12091e, alpha: 0.9 });
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const value = grid[idx(N, c, r)] ?? 0;
        const x = ox + c * cell;
        const y = oy + r * cell;
        g.roundRect(x + 4, y + 4, cell - 8, cell - 8, 8).fill({ color: COLORS[value] ?? 0xff4d8d, alpha: 0.78 });
        for (let p = 0; p < value; p++) {
          const a = t * 2 + p * (Math.PI * 2 / 4);
          g.circle(x + cell / 2 + Math.cos(a) * cell * 0.18, y + cell / 2 + Math.sin(a) * cell * 0.18, cell * 0.045).fill({ color: 0xffffff, alpha: 0.5 });
        }
      }
    }
    drawSparks(g, sparks);
  }

  return {
    update(dt) {
      if (over) return;
      t += dt;
      updateSparks(sparks, dt);
      time -= dt;
      ctx.hud.setLabel(`${Math.ceil(time)}s`);
      if (time <= 0) {
        over = true;
        ctx.gameOver(score, { chain });
      }
      draw();
    },
    destroy() {
      offTap();
      layer.destroy({ children: true });
    },
  };
}

