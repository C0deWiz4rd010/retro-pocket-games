import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action, Dir } from '@core/InputManager';

const N = 4;
const COLORS: Record<number, number> = {
  2: 0x3c3a32, 4: 0x4a4632, 8: 0xf2b179, 16: 0xf59563, 32: 0xf67c5f, 64: 0xf65e3b,
  128: 0xedcf72, 256: 0xedcc61, 512: 0xedc850, 1024: 0xedc53f, 2048: 0xedc22e,
};

export default function createGame(ctx: GameContext): Game {
  const pad = 18;
  const boardSize = Math.min(ctx.width - pad * 2, ctx.height - pad * 2);
  const gap = 10;
  const cell = (boardSize - gap * (N + 1)) / N;
  const ox = (ctx.width - boardSize) / 2;
  const oy = (ctx.height - boardSize) / 2;

  const layer = new Container();
  layer.position.set(ox, oy);
  ctx.stage.addChild(layer);

  const board = new Graphics();
  board.roundRect(0, 0, boardSize, boardSize, 12).fill({ color: 0x1d1d2b });
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++)
      board
        .roundRect(gap + x * (cell + gap), gap + y * (cell + gap), cell, cell, 8)
        .fill({ color: 0xffffff, alpha: 0.04 });
  layer.addChild(board);

  const tilesG = new Graphics();
  const labels: Text[] = [];
  layer.addChild(tilesG);
  for (let i = 0; i < N * N; i++) {
    const t = new Text({ text: '', style: { fontFamily: 'Inter, sans-serif', fontWeight: '800', fontSize: cell * 0.32, fill: 0x101018, align: 'center' } });
    t.anchor.set(0.5);
    labels.push(t);
    layer.addChild(t);
  }

  let grid: number[] = new Array(N * N).fill(0);
  let score = 0;
  let over = false;
  let won = false;
  let prev: { grid: number[]; score: number } | null = null;
  const at = (x: number, y: number): number => grid[y * N + x] as number;
  const set = (x: number, y: number, v: number): void => {
    grid[y * N + x] = v;
  };

  const spawn = (): void => {
    const empty: number[] = [];
    grid.forEach((v, i) => v === 0 && empty.push(i));
    if (!empty.length) return;
    const idx = empty[Math.floor(ctx.rng.next() * empty.length)] as number;
    grid[idx] = ctx.rng.next() < 0.9 ? 2 : 4;
  };

  const line = (vals: number[]): { row: number[]; gained: number } => {
    const f = vals.filter((v) => v !== 0);
    let gained = 0;
    for (let i = 0; i < f.length - 1; i++) {
      if (f[i] === f[i + 1]) {
        f[i] = (f[i] as number) * 2;
        gained += f[i] as number;
        f.splice(i + 1, 1);
      }
    }
    while (f.length < N) f.push(0);
    return { row: f, gained };
  };

  const move = (dir: 'up' | 'down' | 'left' | 'right'): boolean => {
    const before = grid.join(',');
    const snapGrid = [...grid];
    const snapScore = score;
    let gained = 0;
    for (let i = 0; i < N; i++) {
      const vals: number[] = [];
      for (let j = 0; j < N; j++) {
        if (dir === 'left') vals.push(at(j, i));
        else if (dir === 'right') vals.push(at(N - 1 - j, i));
        else if (dir === 'up') vals.push(at(i, j));
        else vals.push(at(i, N - 1 - j));
      }
      const { row, gained: g } = line(vals);
      gained += g;
      for (let j = 0; j < N; j++) {
        const v = row[j] as number;
        if (dir === 'left') set(j, i, v);
        else if (dir === 'right') set(N - 1 - j, i, v);
        else if (dir === 'up') set(i, j, v);
        else set(i, N - 1 - j, v);
      }
    }
    const moved = grid.join(',') !== before;
    if (moved) {
      prev = { grid: snapGrid, score: snapScore };
      score += gained;
      ctx.hud.setScore(score);
      if (gained > 0) ctx.audio.sfx('eat');
      else ctx.audio.sfx('blip');
      spawn();
      draw();
      if (!won && grid.includes(2048)) {
        won = true;
        ctx.audio.sfx('powerup');
        ctx.hud.toast('2048! KEEP GOING');
      }
      if (!canMove()) endGame();
    }
    return moved;
  };

  const undo = (): void => {
    if (over || !prev) return;
    grid = [...prev.grid];
    score = prev.score;
    prev = null;
    ctx.hud.setScore(score);
    ctx.audio.sfx('select');
    draw();
  };

  const canMove = (): boolean => {
    if (grid.includes(0)) return true;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const v = at(x, y);
        if (x < N - 1 && at(x + 1, y) === v) return true;
        if (y < N - 1 && at(x, y + 1) === v) return true;
      }
    return false;
  };

  const endGame = (): void => {
    over = true;
    ctx.gameOver(score, { best: Math.max(...grid) });
  };

  const draw = (): void => {
    tilesG.clear();
    grid.forEach((v, i) => {
      const x = i % N;
      const y = Math.floor(i / N);
      const px = gap + x * (cell + gap);
      const py = gap + y * (cell + gap);
      const label = labels[i] as Text;
      if (v === 0) {
        label.text = '';
        return;
      }
      tilesG.roundRect(px, py, cell, cell, 8).fill({ color: COLORS[v] ?? 0xedc22e });
      label.text = String(v);
      label.style.fill = v <= 4 ? 0xcadc9f : 0x101018;
      label.position.set(px + cell / 2, py + cell / 2);
    });
  };

  const handle = (a: Action | Dir): void => {
    if (over) return;
    if (a === 'up' || a === 'down' || a === 'left' || a === 'right') move(a);
    else if (a === 'b' || a === 'select') undo();
  };
  const offDown = ctx.input.on('down', handle);
  const offSwipe = ctx.input.on('swipe', handle);

  spawn();
  spawn();
  draw();
  ctx.hud.setScore(0);
  ctx.hud.setLabel('SWIPE • B=UNDO');

  return {
    update() {},
    destroy() {
      offDown();
      offSwipe();
      layer.destroy({ children: true });
    },
  };
}
