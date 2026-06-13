import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action } from '@core/InputManager';
import {
  COLS,
  ROWS,
  at,
  canFall,
  createColumns,
  cyclePiece,
  hardDrop,
  lockPiece,
  movePiece,
  resolveMatches,
  spawnPiece,
} from './core';

const DEFAULT_COLORS = [0xff4d4d, 0xffd200, 0x3ddc84, 0x00f7ff, 0xb388ff, 0xff80ab];
const COLORBLIND_COLORS = [0xe69f00, 0x56b4e9, 0x009e73, 0xf0e442, 0x0072b2, 0xcc79a7];

export default function createGame(ctx: GameContext): Game {
  const state = createColumns(ctx.rng);
  const colors = document.documentElement.dataset.colorblind === 'off' ? DEFAULT_COLORS : COLORBLIND_COLORS;

  const cell = Math.floor(Math.min(ctx.width / COLS, (ctx.height - 22) / ROWS));
  const fieldW = COLS * cell;
  const fieldH = ROWS * cell;
  const ox = (ctx.width - fieldW) / 2;
  const oy = (ctx.height - fieldH) / 2;

  const layer = new Container();
  layer.position.set(ox, oy);
  ctx.stage.addChild(layer);

  const g = new Graphics();
  layer.addChild(g);

  let dropAcc = 0;
  let settleT = 0;
  let locked = false;

  ctx.hud.setScore(0);
  ctx.hud.setLabel('LV 1');

  const syncHud = (): void => {
    ctx.hud.setScore(state.score);
    ctx.hud.setLabel(state.combo > 1 ? `LV ${state.level}  x${state.combo}` : `LV ${state.level}`);
  };

  const finishRun = (): void => {
    ctx.audio.sfx('gameover');
    ctx.gameOver(state.score, { level: state.level, combo: state.combo });
  };

  const beginResolve = (): void => {
    locked = true;
    settleT = 0.08;
  };

  const lockCurrent = (): void => {
    lockPiece(state);
    beginResolve();
  };

  const dropAndLock = (): void => {
    const rows = hardDrop(state);
    if (rows > 0) {
      state.score += rows * state.level;
      syncHud();
    }
    ctx.fx.screenShake(3, 0.1);
    beginResolve();
  };

  const cycle = (): void => {
    cyclePiece(state);
    ctx.audio.sfx('blip');
  };

  const onDown = (a: Action): void => {
    if (state.over || locked) return;
    if (a === 'left') {
      if (movePiece(state, -1)) ctx.audio.sfx('blip');
    } else if (a === 'right') {
      if (movePiece(state, 1)) ctx.audio.sfx('blip');
    } else if (a === 'a' || a === 'up') {
      cycle();
    } else if (a === 'b' || a === 'down') {
      dropAndLock();
    }
    draw();
  };

  const offDown = ctx.input.on('down', onDown);
  const offSwipe = ctx.input.on('swipe', (d) => {
    if (state.over || locked) return;
    if (d === 'left') movePiece(state, -1);
    else if (d === 'right') movePiece(state, 1);
    else if (d === 'up') cycle();
    else if (d === 'down') dropAndLock();
    draw();
  });

  const ghostRow = (): number => {
    const old = state.piece.row;
    while (canFall(state)) state.piece.row++;
    const row = state.piece.row;
    state.piece.row = old;
    return row;
  };

  const drawJewel = (c: number, r: number, value: number, alpha = 1): void => {
    const x = c * cell;
    const y = r * cell;
    const color = colors[value] ?? colors[0]!;
    g.roundRect(x + 2, y + 2, cell - 4, cell - 4, Math.max(4, cell * 0.14)).fill({ color, alpha });
    g.circle(x + cell * 0.34, y + cell * 0.28, Math.max(2, cell * 0.1)).fill({ color: 0xffffff, alpha: alpha * 0.36 });
    g.roundRect(x + cell * 0.18, y + cell * 0.68, cell * 0.64, Math.max(2, cell * 0.08), 2).fill({
      color: 0x000000,
      alpha: alpha * 0.18,
    });
  };

  function draw(): void {
    g.clear();
    g.roundRect(-5, -5, fieldW + 10, fieldH + 10, 10).fill({ color: 0x1d1d2b, alpha: 0.75 });
    g.rect(0, 0, fieldW, fieldH).fill({ color: 0x060611, alpha: 0.86 });
    for (let c = 1; c < COLS; c++) {
      g.rect(c * cell, 0, 1, fieldH).fill({ color: 0xffffff, alpha: 0.05 });
    }
    for (let r = 1; r < ROWS; r++) {
      g.rect(0, r * cell, fieldW, 1).fill({ color: 0xffffff, alpha: 0.04 });
    }
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = at(state, c, r);
        if (v >= 0) drawJewel(c, r, v);
      }
    }
    if (!state.over) {
      const gy = ghostRow();
      for (let i = 0; i < state.piece.cells.length; i++) {
        const r = gy + i;
        if (r >= 0 && r < ROWS) drawJewel(state.piece.col, r, state.piece.cells[i]!, 0.2);
      }
      for (let i = 0; i < state.piece.cells.length; i++) {
        const r = state.piece.row + i;
        if (r >= 0 && r < ROWS) drawJewel(state.piece.col, r, state.piece.cells[i]!);
      }
    }
  }
  draw();

  return {
    update(dt) {
      if (state.over) return;
      if (locked) {
        settleT -= dt;
        if (settleT <= 0) {
          const result = resolveMatches(state);
          syncHud();
          if (result.cleared > 0) {
            ctx.audio.sfx(result.combo > 1 ? 'powerup' : 'clear');
            ctx.fx.flashRect(0, 0, fieldW, fieldH, 0xffffff);
            ctx.fx.floatingText(result.combo > 1 ? `CASCADE x${result.combo}` : `+${result.scoreDelta}`, fieldW / 2, fieldH * 0.18, 0xffd200);
            ctx.fx.screenShake(Math.min(8, 2 + result.combo * 1.6), 0.14);
            settleT = 0.18;
          } else {
            state.combo = 0;
            spawnPiece(state, ctx.rng);
            locked = false;
            if (state.over) finishRun();
          }
          draw();
        }
        return;
      }

      dropAcc += dt;
      const speed = Math.max(0.09, 0.62 - (state.level - 1) * 0.045);
      if (dropAcc >= speed) {
        dropAcc = 0;
        if (canFall(state)) state.piece.row++;
        else lockCurrent();
        draw();
      }
    },
    destroy() {
      offDown();
      offSwipe();
      layer.destroy({ children: true });
    },
  };
}
