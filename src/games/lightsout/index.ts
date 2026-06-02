import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

export default function createGame(ctx: GameContext): Game {
  const N = 5;
  const size = Math.min(ctx.width, ctx.height) * 0.86;
  const cell = size / N;
  const ox = (ctx.width - size) / 2;
  const oy = (ctx.height - size) / 2;

  const layer = new Container();
  layer.position.set(ox, oy);
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const lights = new Array(N * N).fill(false);
  const idx = (c: number, r: number): number => r * N + c;
  const toggle = (c: number, r: number): void => {
    if (c < 0 || r < 0 || c >= N || r >= N) return;
    lights[idx(c, r)] = !lights[idx(c, r)];
  };
  // scramble from solved by random presses (guarantees solvable)
  for (let i = 0; i < 12; i++) {
    const c = ctx.rng.int(0, N - 1);
    const r = ctx.rng.int(0, N - 1);
    press(c, r, true);
  }

  let moves = 0;
  let over = false;

  function press(c: number, r: number, silent = false): void {
    toggle(c, r);
    toggle(c - 1, r);
    toggle(c + 1, r);
    toggle(c, r - 1);
    toggle(c, r + 1);
    if (!silent) {
      moves++;
      ctx.audio.sfx('blip');
    }
  }

  ctx.hud.setScore(0);
  ctx.hud.setLabel('TURN THEM OFF');

  const draw = (): void => {
    g.clear();
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const on = lights[idx(c, r)];
        g.roundRect(c * cell + 4, r * cell + 4, cell - 8, cell - 8, 8).fill({ color: on ? 0xffd200 : 0x1d1d2b });
        if (on) g.roundRect(c * cell + 4, r * cell + 4, cell - 8, cell - 8, 8).stroke({ width: 2, color: 0xfff6b0 });
      }
  };

  const tap = (vx: number, vy: number): void => {
    if (over) return;
    const c = Math.floor((vx - ox) / cell);
    const r = Math.floor((vy - oy) / cell);
    if (c < 0 || r < 0 || c >= N || r >= N) return;
    press(c, r);
    ctx.hud.setLabel(`MOVES ${moves}`);
    draw();
    if (lights.every((l) => !l)) {
      over = true;
      ctx.audio.sfx('levelup');
      ctx.hud.toast('SOLVED!');
      ctx.gameOver(Math.max(50, 1000 - moves * 25), { moves });
    }
  };
  const offTap = ctx.input.on('tap', ({ x, y }) => tap(x, y));

  draw();
  return {
    update() {},
    destroy() {
      offTap();
      layer.destroy({ children: true });
    },
  };
}
