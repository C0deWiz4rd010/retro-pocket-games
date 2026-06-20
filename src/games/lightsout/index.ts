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
  // Live solution set: the cells that, if pressed now, turn everything off.
  // Pressing any cell toggles its membership — so a real hint is always available.
  const solution = new Set<number>();
  const idx = (c: number, r: number): number => r * N + c;
  const toggle = (c: number, r: number): void => {
    if (c < 0 || r < 0 || c >= N || r >= N) return;
    lights[idx(c, r)] = !lights[idx(c, r)];
  };

  let moves = 0;
  let over = false;
  let level = 1; // Feature: level progression
  let score = 0;
  let hints = 3; // Feature: hint power-up
  let flash = -1;
  let flashT = 0;

  function press(c: number, r: number, silent = false): void {
    toggle(c, r);
    toggle(c - 1, r);
    toggle(c + 1, r);
    toggle(c, r - 1);
    toggle(c, r + 1);
    const i = idx(c, r);
    if (solution.has(i)) solution.delete(i); else solution.add(i);
    if (!silent) {
      moves++;
      ctx.audio.sfx('blip');
    }
  }

  function makePuzzle(): void {
    lights.fill(false);
    solution.clear();
    moves = 0;
    const scrambles = 8 + level * 2;
    for (let i = 0; i < scrambles; i++) press(ctx.rng.int(0, N - 1), ctx.rng.int(0, N - 1), true);
  }
  makePuzzle();

  ctx.hud.setScore(0);
  ctx.hud.setLabel(`L1 · A=HINT(${hints})`);

  const draw = (): void => {
    g.clear();
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const i = idx(c, r);
        const on = lights[i];
        g.roundRect(c * cell + 4, r * cell + 4, cell - 8, cell - 8, 8).fill({ color: on ? 0xffd200 : 0x1d1d2b });
        if (on) g.roundRect(c * cell + 4, r * cell + 4, cell - 8, cell - 8, 8).stroke({ width: 2, color: 0xfff6b0 });
        if (i === flash && flashT > 0) g.roundRect(c * cell + 4, r * cell + 4, cell - 8, cell - 8, 8).stroke({ width: 4, color: 0x00f7ff, alpha: 0.5 + Math.sin(flashT * 18) * 0.4 });
      }
  };

  const useHint = (): void => {
    if (over || hints <= 0 || solution.size === 0) return;
    hints--;
    flash = [...solution][0]!;
    flashT = 1.4;
    ctx.hud.toast(`HINT (${hints} left)`);
    ctx.audio.sfx('powerup');
    draw();
  };
  const offDown = ctx.input.on('down', (a) => { if (a === 'a' || a === 'b' || a === 'start') useHint(); });

  const tap = (vx: number, vy: number): void => {
    if (over) return;
    const c = Math.floor((vx - ox) / cell);
    const r = Math.floor((vy - oy) / cell);
    if (c < 0 || r < 0 || c >= N || r >= N) return;
    press(c, r);
    ctx.hud.setLabel(`L${level} · MOVES ${moves}`);
    draw();
    if (lights.every((l) => !l)) {
      // Feature: efficiency bonus + level progression
      const bonus = Math.max(50, 600 - moves * 15) + level * 100;
      score += bonus;
      level++;
      hints = Math.min(3, hints + 1);
      ctx.hud.setScore(score);
      ctx.audio.sfx('levelup');
      ctx.hud.toast(`SOLVED! +${bonus}`);
      flash = -1;
      makePuzzle();
      ctx.hud.setLabel(`L${level} · A=HINT(${hints})`);
      draw();
    }
  };
  const offTap = ctx.input.on('tap', ({ x, y }) => tap(x, y));

  draw();
  return {
    update(dt) {
      if (flashT > 0) {
        flashT -= dt;
        if (flashT <= 0) flash = -1;
        draw();
      }
    },
    destroy() {
      offTap();
      offDown();
      layer.destroy({ children: true });
    },
  };
}
