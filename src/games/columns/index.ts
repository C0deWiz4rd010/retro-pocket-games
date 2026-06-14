import { Container, Graphics, Text } from 'pixi.js';
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
  softDrop,
  spawnPiece,
} from './core';

const DEFAULT_COLORS = [0xff4d4d, 0xffd200, 0x3ddc84, 0x00f7ff, 0xb388ff, 0xff80ab];
const COLORBLIND_COLORS = [0xe69f00, 0x56b4e9, 0x009e73, 0xf0e442, 0x0072b2, 0xcc79a7];

export default function createGame(ctx: GameContext): Game {
  const state = createColumns(ctx.rng);
  const colors = document.documentElement.dataset.colorblind === 'off' ? DEFAULT_COLORS : COLORBLIND_COLORS;

  const previewReserve = 64;
  const controlsReserve = 112;
  const cell = Math.floor(Math.min((ctx.width - previewReserve) / COLS, (ctx.height - controlsReserve) / ROWS));
  const fieldW = COLS * cell;
  const fieldH = ROWS * cell;
  const previewCell = Math.max(14, Math.floor(cell * 0.58));
  const previewGap = Math.max(10, Math.floor(cell * 0.34));
  const previewW = previewCell + 18;
  const previewX = fieldW + previewGap;
  const previewY = Math.max(22, Math.floor(cell * 0.55));
  const layoutW = fieldW + previewGap + previewW;
  const ox = (ctx.width - layoutW) / 2;
  const oy = Math.max(28, (ctx.height - fieldH) / 2 - Math.floor(cell * 0.8));

  const layer = new Container();
  layer.position.set(ox, oy);
  ctx.stage.addChild(layer);

  const g = new Graphics();
  layer.addChild(g);
  const nextLabel = new Text({
    text: 'NEXT',
    style: {
      fill: 0xc9c9ff,
      fontFamily: 'VT323, monospace',
      fontSize: 17,
      letterSpacing: 0,
    },
  });
  nextLabel.anchor.set(0.5, 0);
  nextLabel.position.set(previewX + previewW / 2, previewY - 20);
  layer.addChild(nextLabel);

  let dropAcc = 0;
  let settleT = 0;
  let locked = false;
  let softDropBonus = 0;

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
    softDropBonus = 0;
  };

  const lockCurrent = (): void => {
    lockPiece(state);
    beginResolve();
  };

  const dropAndLock = (): void => {
    const rows = hardDrop(state);
    if (rows > 0) {
      const bonus = rows * state.level * 2;
      state.score += bonus;
      ctx.fx.floatingText(`DROP +${bonus}`, ox + fieldW / 2, oy + fieldH * 0.13, 0x00f7ff);
      syncHud();
    }
    ctx.fx.screenShake(3, 0.1);
    beginResolve();
  };

  const stepDown = (manual: boolean): boolean => {
    if (softDrop(state)) {
      if (manual) {
        const bonus = state.level;
        state.score += bonus;
        softDropBonus += bonus;
        syncHud();
      }
      return true;
    }
    lockCurrent();
    return false;
  };

  const showSoftDropBonus = (): void => {
    if (softDropBonus < state.level * 5) return;
    ctx.fx.floatingText(`+${softDropBonus}`, ox + fieldW / 2, oy + fieldH * 0.18, 0xb388ff);
    softDropBonus = 0;
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
    } else if (a === 'down') {
      dropAcc = 0;
      if (stepDown(true)) showSoftDropBonus();
    } else if (a === 'b') {
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

  const drawMarker = (x: number, y: number, size: number, value: number, alpha: number): void => {
    const ink = 0x05050d;
    const midX = x + size / 2;
    const midY = y + size / 2;
    const mark = Math.max(2, size * 0.11);
    if (value === 0) {
      g.circle(midX, midY, size * 0.13).fill({ color: ink, alpha: alpha * 0.45 });
    } else if (value === 1) {
      g.roundRect(midX - mark / 2, y + size * 0.28, mark, size * 0.44, 2).fill({ color: ink, alpha: alpha * 0.44 });
    } else if (value === 2) {
      g.roundRect(x + size * 0.28, midY - mark / 2, size * 0.44, mark, 2).fill({ color: ink, alpha: alpha * 0.44 });
    } else if (value === 3) {
      g.circle(x + size * 0.39, midY, size * 0.08).fill({ color: ink, alpha: alpha * 0.42 });
      g.circle(x + size * 0.61, midY, size * 0.08).fill({ color: ink, alpha: alpha * 0.42 });
    } else if (value === 4) {
      g.roundRect(midX - mark / 2, y + size * 0.3, mark, size * 0.4, 2).fill({ color: ink, alpha: alpha * 0.42 });
      g.roundRect(x + size * 0.3, midY - mark / 2, size * 0.4, mark, 2).fill({ color: ink, alpha: alpha * 0.42 });
    } else {
      g.roundRect(x + size * 0.35, y + size * 0.35, size * 0.3, size * 0.3, 2).fill({ color: ink, alpha: alpha * 0.42 });
    }
  };

  const drawJewelAt = (x: number, y: number, size: number, value: number, alpha = 1): void => {
    const color = colors[value] ?? colors[0]!;
    g.roundRect(x + 2, y + 2, size - 4, size - 4, Math.max(4, size * 0.14)).fill({ color, alpha });
    g.circle(x + size * 0.34, y + size * 0.28, Math.max(2, size * 0.1)).fill({ color: 0xffffff, alpha: alpha * 0.36 });
    g.roundRect(x + size * 0.18, y + size * 0.68, size * 0.64, Math.max(2, size * 0.08), 2).fill({
      color: 0x000000,
      alpha: alpha * 0.18,
    });
    drawMarker(x, y, size, value, alpha);
  };

  const drawJewel = (c: number, r: number, value: number, alpha = 1): void => {
    drawJewelAt(c * cell, r * cell, cell, value, alpha);
  };

  function draw(): void {
    g.clear();
    g.roundRect(-5, -5, fieldW + 10, fieldH + 10, 10).fill({ color: 0x1d1d2b, alpha: 0.75 });
    g.rect(0, 0, fieldW, fieldH).fill({ color: 0x060611, alpha: 0.86 });
    g.rect(0, 0, fieldW, cell * 3).fill({ color: 0xff4d4d, alpha: 0.06 });
    g.rect(0, cell * 3 - 1, fieldW, 1).fill({ color: 0xffd200, alpha: 0.28 });
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
        if (r >= 0 && r < ROWS) drawJewel(state.piece.col, r, state.piece.cells[i]!, 0.26);
      }
      for (let i = 0; i < state.piece.cells.length; i++) {
        const r = state.piece.row + i;
        if (r >= 0 && r < ROWS) drawJewel(state.piece.col, r, state.piece.cells[i]!);
      }
    }
    g.roundRect(previewX, previewY, previewW, previewCell * 3 + 14, 8).fill({ color: 0x101020, alpha: 0.78 });
    for (let i = 0; i < state.next.length; i++) {
      drawJewelAt(previewX + 9, previewY + 7 + i * previewCell, previewCell, state.next[i]!, 0.92);
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
      const manualDrop = ctx.input.isDown('down');
      const speed = manualDrop ? 0.045 : Math.max(0.09, 0.62 - (state.level - 1) * 0.045);
      if (dropAcc >= speed) {
        dropAcc = 0;
        stepDown(manualDrop);
        if (manualDrop) showSoftDropBonus();
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
