import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action } from '@core/InputManager';

const COLORS = [0xff4d4d, 0xffd200, 0x3ddc84, 0x00f7ff, 0xb388ff, 0xff80ab];
const COLS = 7;
const ROWS = 14;

export default function createGame(ctx: GameContext): Game {
  const cell = Math.floor(Math.min(ctx.width / COLS, ctx.height / ROWS));
  const fieldW = COLS * cell;
  const fieldH = ROWS * cell;
  const ox = (ctx.width - fieldW) / 2;
  const oy = (ctx.height - fieldH) / 2;

  const layer = new Container();
  layer.position.set(ox, oy);
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const board: number[] = new Array(COLS * ROWS).fill(-1);
  const at = (c: number, r: number): number => board[r * COLS + c]!;
  const set = (c: number, r: number, v: number): void => {
    board[r * COLS + c] = v;
  };

  // falling triple
  let piece = { col: 3, row: 0, cells: [0, 0, 0] };
  const newPiece = (): void => {
    piece = { col: 3, row: 0, cells: [ctx.rng.int(0, 5), ctx.rng.int(0, 5), ctx.rng.int(0, 5)] };
    if (at(piece.col, 0) !== -1) {
      over = true;
      ctx.audio.sfx('gameover');
      ctx.gameOver(score, { level });
    }
  };

  let score = 0;
  let level = 1;
  let over = false;
  let dropAcc = 0;
  let settleT = 0;

  ctx.hud.setScore(0);
  ctx.hud.setLabel('LV 1');
  newPiece();

  const canFall = (): boolean => piece.row + 3 <= ROWS - 1 && at(piece.col, piece.row + 3) === -1;

  const lockPiece = (): void => {
    for (let i = 0; i < 3; i++) {
      const r = piece.row + i;
      if (r >= 0 && r < ROWS) set(piece.col, r, piece.cells[i]!);
    }
    settleT = 0.01;
  };

  const clearMatches = (): boolean => {
    const mark = new Set<number>();
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const v = at(c, r);
        if (v < 0) continue;
        for (const [dx, dy] of dirs) {
          const run = [r * COLS + c];
          let cc = c + dx!;
          let rr = r + dy!;
          while (cc >= 0 && cc < COLS && rr >= 0 && rr < ROWS && at(cc, rr) === v) {
            run.push(rr * COLS + cc);
            cc += dx!;
            rr += dy!;
          }
          if (run.length >= 3) run.forEach((i) => mark.add(i));
        }
      }
    if (!mark.size) return false;
    mark.forEach((i) => (board[i] = -1));
    score += mark.size * 20 * level;
    ctx.hud.setScore(score);
    level = 1 + Math.floor(score / 1000);
    ctx.hud.setLabel(`LV ${level}`);
    ctx.audio.sfx('clear');
    return true;
  };

  const collapse = (): void => {
    for (let c = 0; c < COLS; c++) {
      const stack: number[] = [];
      for (let r = ROWS - 1; r >= 0; r--) if (at(c, r) >= 0) stack.push(at(c, r));
      for (let r = ROWS - 1; r >= 0; r--) set(c, r, stack[ROWS - 1 - r] ?? -1);
    }
  };

  const cycle = (): void => {
    piece.cells = [piece.cells[2]!, piece.cells[0]!, piece.cells[1]!];
    ctx.audio.sfx('blip');
  };

  const offDown = ctx.input.on('down', (a: Action) => {
    if (over || settleT > 0) return;
    if (a === 'left' && piece.col > 0 && at(piece.col - 1, piece.row) === -1) piece.col--;
    else if (a === 'right' && piece.col < COLS - 1 && at(piece.col + 1, piece.row) === -1) piece.col++;
    else if (a === 'a' || a === 'up') cycle();
    else if (a === 'down') {
      while (canFall()) piece.row++;
      lockPiece();
    }
    draw();
  });
  const offSwipe = ctx.input.on('swipe', (d) => {
    if (over || settleT > 0) return;
    if (d === 'left' && piece.col > 0) piece.col--;
    else if (d === 'right' && piece.col < COLS - 1) piece.col++;
    else if (d === 'up') cycle();
    else if (d === 'down') {
      while (canFall()) piece.row++;
      lockPiece();
    }
    draw();
  });

  function draw(): void {
    g.clear();
    g.rect(0, 0, fieldW, fieldH).fill({ color: 0x0a0a12, alpha: 0.6 });
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const v = at(c, r);
        if (v >= 0) g.roundRect(c * cell + 1, r * cell + 1, cell - 2, cell - 2, 3).fill({ color: COLORS[v]! });
      }
    if (!over)
      for (let i = 0; i < 3; i++) {
        const r = piece.row + i;
        if (r >= 0 && r < ROWS) g.roundRect(piece.col * cell + 1, r * cell + 1, cell - 2, cell - 2, 3).fill({ color: COLORS[piece.cells[i]!]! });
      }
  }
  draw();

  return {
    update(dt) {
      if (over) return;
      if (settleT > 0) {
        settleT -= dt;
        if (settleT <= 0) {
          collapse();
          if (clearMatches()) {
            collapse();
            settleT = 0.12;
          } else {
            newPiece();
          }
          draw();
        }
        return;
      }
      dropAcc += dt;
      const speed = Math.max(0.1, 0.6 - (level - 1) * 0.05);
      if (dropAcc >= speed) {
        dropAcc = 0;
        if (canFall()) piece.row++;
        else lockPiece();
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
