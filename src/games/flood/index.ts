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
  let score = 0;
  let level = 1; // Feature: level progression
  let hints = 3; // Feature: greedy hint
  let flashColor = -1;
  let flashT = 0;

  ctx.hud.setScore(0);
  ctx.hud.setLabel(`L1 · MOVES ${maxMoves}`);

  // Feature: coverage % of the owned (top-left) region
  const ownedCount = (src: number[]): number => {
    const start = src[0]!;
    const seen = new Set<number>([0]);
    const stack = [0];
    while (stack.length) {
      const i = stack.pop()!;
      const c = i % N, r = Math.floor(i / N);
      for (const j of [c > 0 ? i - 1 : -1, c < N - 1 ? i + 1 : -1, r > 0 ? i - N : -1, r < N - 1 ? i + N : -1]) {
        if (j >= 0 && !seen.has(j) && src[j] === start) { seen.add(j); stack.push(j); }
      }
    }
    return seen.size;
  };

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

  const regrid = (): void => {
    for (let i = 0; i < grid.length; i++) grid[i] = ctx.rng.int(0, COLORS.length - 1);
    moves = 0;
  };

  // Feature: greedy hint — the colour that captures the most new cells
  const bestColor = (): number => {
    let best = -1, bestGain = -1;
    for (let col = 0; col < COLORS.length; col++) {
      if (col === grid[0]) continue;
      const copy = grid.slice();
      const start = copy[0]!;
      const stack = [0];
      const seen = new Set<number>();
      while (stack.length) {
        const i = stack.pop()!;
        if (seen.has(i) || copy[i] !== start) continue;
        seen.add(i); copy[i] = col;
        const c = i % N, r = Math.floor(i / N);
        if (c > 0) stack.push(i - 1);
        if (c < N - 1) stack.push(i + 1);
        if (r > 0) stack.push(i - N);
        if (r < N - 1) stack.push(i + N);
      }
      const gain = ownedCount(copy);
      if (gain > bestGain) { bestGain = gain; best = col; }
    }
    return best;
  };

  const apply = (color: number): void => {
    if (over || color === grid[0]) return;
    flood(color);
    moves++;
    flashColor = -1;
    ctx.audio.sfx('blip');
    draw();
    if (grid.every((c) => c === grid[0])) {
      // Feature: flooded → bank a bonus and advance to a fresh harder board
      const bonus = (maxMoves - moves + 1) * 100 + level * 150;
      score += bonus;
      level++;
      ctx.hud.setScore(score);
      ctx.audio.sfx('levelup');
      ctx.hud.toast(`FLOODED! +${bonus}`);
      regrid();
      draw();
      ctx.hud.setLabel(`L${level} · MOVES ${maxMoves}`);
    } else if (moves >= maxMoves) {
      over = true;
      ctx.audio.sfx('gameover');
      ctx.hud.toast('OUT OF MOVES');
      ctx.gameOver(score, { moves, level });
    } else {
      const pct = Math.round((ownedCount(grid) / (N * N)) * 100);
      ctx.hud.setLabel(`L${level} · ${maxMoves - moves} left · ${pct}%`);
    }
  };

  const useHint = (): void => {
    if (over || hints <= 0) return;
    hints--;
    flashColor = bestColor();
    flashT = 1.6;
    ctx.hud.toast(`HINT (${hints} left)`);
    ctx.audio.sfx('powerup');
    draw();
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
    else if (a === 'b' || a === 'start') { useHint(); return; }
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
      if (i === flashColor && flashT > 0) g.roundRect(palX + i * cell * 1.4 - 3, palY - cell * 0.6 - 3, cell * 1.2 + 6, cell * 1.2 + 6, 8).stroke({ width: 4, color: 0x00f7ff, alpha: 0.5 + Math.sin(flashT * 16) * 0.4 });
    });
  }
  draw();

  return {
    update(dt) {
      if (flashT > 0) {
        flashT -= dt;
        if (flashT <= 0) flashColor = -1;
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
