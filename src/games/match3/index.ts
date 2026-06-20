import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

const COLORS = [0xff4d4d, 0xffd200, 0x3ddc84, 0x00f7ff, 0xb388ff, 0xff80ab];
const N = 8;

export default function createGame(ctx: GameContext): Game {
  const size = Math.min(ctx.width, ctx.height - 20) * 0.96;
  const cell = size / N;
  const ox = (ctx.width - size) / 2;
  const oy = (ctx.height - size) / 2;

  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const grid: number[] = [];
  const at = (c: number, r: number): number => grid[r * N + c]!;
  const set = (c: number, r: number, v: number): void => {
    grid[r * N + c] = v;
  };
  for (let i = 0; i < N * N; i++) grid.push(ctx.rng.int(0, COLORS.length - 1));

  let score = 0;
  let sel: { c: number; r: number } | null = null;
  let busy = 0;
  let moves = 30;
  let over = false;
  let cascade = 0;
  let level = 1; // Feature: level progression
  let target = 2500;

  ctx.hud.setScore(0);
  ctx.hud.setLabel(`L1 · MOVES ${moves}`);

  const findMatches = (): boolean[] => {
    const m = new Array(N * N).fill(false);
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N - 2; c++) {
        const v = at(c, r);
        if (v === at(c + 1, r) && v === at(c + 2, r)) m[r * N + c] = m[r * N + c + 1] = m[r * N + c + 2] = true;
      }
    for (let c = 0; c < N; c++)
      for (let r = 0; r < N - 2; r++) {
        const v = at(c, r);
        if (v === at(c, r + 1) && v === at(c, r + 2)) m[r * N + c] = m[(r + 1) * N + c] = m[(r + 2) * N + c] = true;
      }
    return m;
  };

  const resolve = (): boolean => {
    const m = findMatches();
    if (!m.some(Boolean)) { cascade = 0; return false; }
    // Feature: a run of 4+ blasts the whole row (horizontal) or column (vertical)
    let blasted = false;
    for (let r = 0; r < N; r++) {
      let run = 1;
      for (let c = 1; c <= N; c++) {
        if (c < N && at(c, r) === at(c - 1, r)) run++;
        else { if (run >= 4) { for (let k = 0; k < N; k++) m[r * N + k] = true; blasted = true; } run = 1; }
      }
    }
    for (let c = 0; c < N; c++) {
      let run = 1;
      for (let r = 1; r <= N; r++) {
        if (r < N && at(c, r) === at(c, r - 1)) run++;
        else { if (run >= 4) { for (let k = 0; k < N; k++) m[k * N + c] = true; blasted = true; } run = 1; }
      }
    }
    const count = m.filter(Boolean).length;
    cascade++;
    const pts = count * 10 * cascade;
    score += pts;
    ctx.hud.setScore(score);
    if (blasted) ctx.hud.toast(`LINE BLAST! +${pts}`);
    else if (cascade >= 2) ctx.hud.toast(`CASCADE x${cascade}! +${pts}`);
    // Feature: big clears refund moves
    if (count >= 8) { moves += 2; ctx.fx.floatingText('+2 MOVES', ctx.width / 2, oy - 14, 0x3ddc84); }
    // Feature: level progression
    if (score >= target) { level++; moves += 8; target += 2500 + level * 1200; ctx.hud.toast(`LEVEL ${level}! +8 MOVES`); ctx.audio.sfx('levelup'); }
    ctx.audio.sfx('coin');
    for (let c = 0; c < N; c++) {
      const kept: number[] = [];
      for (let r = N - 1; r >= 0; r--) if (!m[r * N + c]) kept.push(at(c, r));
      for (let r = N - 1; r >= 0; r--) {
        const v = kept[N - 1 - r];
        set(c, r, v !== undefined ? v : ctx.rng.int(0, COLORS.length - 1));
      }
    }
    return true;
  };

  const swap = (a: { c: number; r: number }, b: { c: number; r: number }): void => {
    const va = at(a.c, a.r);
    set(a.c, a.r, at(b.c, b.r));
    set(b.c, b.r, va);
  };

  const attemptSwap = (a: { c: number; r: number }, b: { c: number; r: number }): void => {
    swap(a, b);
    if (findMatches().some(Boolean)) {
      moves--;
      cascade = 0;
      ctx.hud.setLabel(`L${level} · MOVES ${moves}`);
      busy = 0.15;
      ctx.audio.sfx('blip');
    } else {
      swap(a, b);
      ctx.audio.sfx('hit');
    }
    sel = null;
  };

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (over || busy > 0) return;
    const c = Math.floor((x - ox) / cell);
    const r = Math.floor((y - oy) / cell);
    if (c < 0 || r < 0 || c >= N || r >= N) return;
    if (!sel) {
      sel = { c, r };
    } else if (Math.abs(sel.c - c) + Math.abs(sel.r - r) === 1) {
      attemptSwap(sel, { c, r });
    } else {
      sel = { c, r };
    }
    draw();
  });

  function draw(): void {
    g.clear();
    g.roundRect(ox - 4, oy - 4, size + 8, size + 8, 8).fill({ color: 0x1d1d2b });
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const x = ox + c * cell;
        const y = oy + r * cell;
        g.roundRect(x + 3, y + 3, cell - 6, cell - 6, 6).fill({ color: COLORS[at(c, r)]! });
        if (sel && sel.c === c && sel.r === r) g.roundRect(x + 1, y + 1, cell - 2, cell - 2, 7).stroke({ width: 3, color: 0xffffff });
      }
  }

  // settle initial matches without scoring
  while (findMatches().some(Boolean)) {
    const m = findMatches();
    for (let i = 0; i < N * N; i++) if (m[i]) grid[i] = ctx.rng.int(0, COLORS.length - 1);
  }
  draw();

  return {
    update(dt) {
      if (over) return;
      if (busy > 0) {
        busy -= dt;
        if (busy <= 0) {
          if (resolve()) {
            busy = 0.15;
          } else if (moves <= 0) {
            over = true;
            ctx.audio.sfx('gameover');
            ctx.gameOver(score, { level });
          }
          draw();
        }
      }
    },
    destroy() {
      offTap();
      layer.destroy({ children: true });
    },
  };
}
