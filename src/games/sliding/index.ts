import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action, Dir } from '@core/InputManager';

export default function createGame(ctx: GameContext): Game {
  const N = 4;
  const size = Math.min(ctx.width, ctx.height) * 0.9;
  const cell = size / N;
  const ox = (ctx.width - size) / 2;
  const oy = (ctx.height - size) / 2;

  const layer = new Container();
  layer.position.set(ox, oy);
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  // 0 = blank
  const tiles = Array.from({ length: N * N }, (_, i) => (i + 1) % (N * N));
  const labels: Text[] = [];
  for (let i = 0; i < N * N; i++) {
    const t = new Text({ text: '', style: { fontFamily: 'Inter', fontWeight: '800', fontSize: cell * 0.4, fill: 0x101018 } });
    t.anchor.set(0.5);
    labels.push(t);
    layer.addChild(t);
  }

  const blankIdx = (): number => tiles.indexOf(0);
  const swap = (a: number, b: number): void => {
    [tiles[a], tiles[b]] = [tiles[b]!, tiles[a]!];
  };

  // shuffle by valid moves (always solvable)
  const reshuffle = (): void => {
    for (let i = 0; i < 200; i++) {
      const b = blankIdx();
      const bc = b % N;
      const br = Math.floor(b / N);
      const opts: number[] = [];
      if (bc > 0) opts.push(b - 1);
      if (bc < N - 1) opts.push(b + 1);
      if (br > 0) opts.push(b - N);
      if (br < N - 1) opts.push(b + N);
      swap(b, ctx.rng.pick(opts));
    }
  };
  reshuffle();

  let moves = 0;
  let over = false;
  let score = 0;
  let level = 1; // Feature: level progression
  const maxTime = 120;
  let timeLeft = maxTime; // Feature: shared countdown + time bonus
  ctx.hud.setScore(0);
  ctx.hud.setLabel(`ORDER 1-15 · L1`);

  const solved = (): boolean => tiles.every((v, i) => v === (i + 1) % (N * N));

  const move = (a: Action | Dir): void => {
    if (over) return;
    const b = blankIdx();
    const bc = b % N;
    const br = Math.floor(b / N);
    // move the tile from the given direction into the blank
    let from = -1;
    if (a === 'left' && bc < N - 1) from = b + 1;
    else if (a === 'right' && bc > 0) from = b - 1;
    else if (a === 'up' && br < N - 1) from = b + N;
    else if (a === 'down' && br > 0) from = b - N;
    if (from < 0) return;
    swap(b, from);
    moves++;
    ctx.audio.sfx('blip');
    ctx.hud.setLabel(`L${level} · MOVES ${moves}`);
    draw();
    if (solved()) {
      // Feature: efficiency bonus + extra time, then a fresh harder board
      const bonus = Math.max(50, 1500 - moves * 10) + level * 120;
      score += bonus;
      timeLeft = Math.min(maxTime + 40, timeLeft + 20);
      level++;
      moves = 0;
      ctx.hud.setScore(score);
      ctx.audio.sfx('levelup');
      ctx.hud.toast(`SOLVED! +${bonus}`);
      reshuffle();
      draw();
    }
  };
  const offDown = ctx.input.on('down', move);
  const offSwipe = ctx.input.on('swipe', move);

  const tapMove = (vx: number, vy: number): void => {
    const c = Math.floor((vx - ox) / cell);
    const r = Math.floor((vy - oy) / cell);
    if (c < 0 || r < 0 || c >= N || r >= N) return;
    const b = blankIdx();
    const bc = b % N;
    const br = Math.floor(b / N);
    if (r === br && c === bc - 1) move('right');
    else if (r === br && c === bc + 1) move('left');
    else if (c === bc && r === br - 1) move('down');
    else if (c === bc && r === br + 1) move('up');
  };
  const offTap = ctx.input.on('tap', ({ x, y }) => tapMove(x, y));

  function draw(): void {
    g.clear();
    g.roundRect(0, 0, size, size, 10).fill({ color: 0x1d1d2b });
    tiles.forEach((v, i) => {
      const c = i % N;
      const r = Math.floor(i / N);
      const lbl = labels[i]!;
      if (v === 0) {
        lbl.visible = false;
        return;
      }
      const correct = v === (i + 1) % (N * N); // Feature: highlight tiles in their final spot
      g.roundRect(c * cell + 4, r * cell + 4, cell - 8, cell - 8, 8).fill({ color: correct ? 0x9bffce : 0x90caf9 });
      lbl.text = String(v);
      lbl.position.set(c * cell + cell / 2, r * cell + cell / 2);
      lbl.visible = true;
    });
  }
  draw();

  let labelAcc = 0;
  return {
    update(dt) {
      if (over) return;
      timeLeft -= dt;
      if (timeLeft <= 0) {
        over = true;
        ctx.audio.sfx('gameover');
        ctx.hud.toast("TIME'S UP!");
        ctx.gameOver(score, { level });
        return;
      }
      labelAcc += dt;
      if (labelAcc >= 0.25) {
        labelAcc = 0;
        ctx.hud.setLabel(`L${level} · ${Math.ceil(timeLeft)}s`);
      }
    },
    destroy() {
      offDown();
      offSwipe();
      offTap();
      layer.destroy({ children: true });
    },
  };
}
