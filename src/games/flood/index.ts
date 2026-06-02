import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action } from '@core/InputManager';

const COLORS = [0xff4d4d, 0xffd200, 0x3ddc84, 0x00f7ff, 0xb388ff, 0xff80ab];

export default function createGame(ctx: GameContext): Game {
  const N = 12;
  const size = Math.min(ctx.width, ctx.height - 70) * 0.96;
  const cell = size / N;
  const ox = (ctx.width - size) / 2;
  const oy = 10;
  const maxMoves = 24;

  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const grid = Array.from({ length: N * N }, () => ctx.rng.int(0, COLORS.length - 1));
  let moves = 0;
  let over = false;
  let selColor = 0;

  ctx.hud.setScore(0);
  ctx.hud.setLabel(`MOVES ${maxMoves}`);

  const flood = (target: number): void => {
    const start = grid[0]!;
    if (start === target) return;
    const stack = [0];
    const seen = new Set<number>();
    while (stack.length) {
      const i = stack.pop()!;
      if (seen.has(i) || grid[i] !== start) continue;
      seen.add(i);
      grid[i] = target;
      const c = i % N;
      const r = Math.floor(i / N);
      if (c > 0) stack.push(i - 1);
      if (c < N - 1) stack.push(i + 1);
      if (r > 0) stack.push(i - N);
      if (r < N - 1) stack.push(i + N);
    }
  };

  const apply = (color: number): void => {
    if (over || color === grid[0]) return;
    flood(color);
    moves++;
    ctx.audio.sfx('blip');
    draw();
    if (grid.every((c) => c === grid[0])) {
      over = true;
      ctx.audio.sfx('levelup');
      ctx.hud.toast('FLOODED!');
      ctx.gameOver((maxMoves - moves + 1) * 100, { moves });
    } else if (moves >= maxMoves) {
      over = true;
      ctx.audio.sfx('gameover');
      ctx.gameOver(0, { moves });
    } else {
      ctx.hud.setLabel(`MOVES ${maxMoves - moves}`);
    }
  };

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    const palY = oy + size + 24;
    if (y > palY - 20 && y < palY + 20) {
      const palX = ctx.width / 2 - (COLORS.length * cell * 1.4) / 2;
      const i = Math.floor((x - palX) / (cell * 1.4));
      if (i >= 0 && i < COLORS.length) apply(i);
    }
  });
  const offDown = ctx.input.on('down', (a: Action) => {
    if (a === 'left') selColor = (selColor + COLORS.length - 1) % COLORS.length;
    else if (a === 'right') selColor = (selColor + 1) % COLORS.length;
    else if (a === 'a') apply(selColor);
    draw();
  });

  function draw(): void {
    g.clear();
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) g.rect(ox + c * cell, oy + r * cell, cell, cell).fill({ color: COLORS[grid[r * N + c]!]! });
    const palY = oy + size + 24;
    const palX = ctx.width / 2 - (COLORS.length * cell * 1.4) / 2;
    COLORS.forEach((col, i) => {
      g.roundRect(palX + i * cell * 1.4, palY - cell * 0.6, cell * 1.2, cell * 1.2, 6).fill({ color: col });
      if (i === selColor) g.roundRect(palX + i * cell * 1.4, palY - cell * 0.6, cell * 1.2, cell * 1.2, 6).stroke({ width: 3, color: 0xffffff });
    });
  }
  draw();

  return {
    update() {},
    destroy() {
      offTap();
      offDown();
      layer.destroy({ children: true });
    },
  };
}
