import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action } from '@core/InputManager';

const COLS = 7;
const ROWS = 6;

export default function createGame(ctx: GameContext): Game {
  const size = Math.min(ctx.width / COLS, (ctx.height - 60) / (ROWS + 1));
  const boardW = COLS * size;
  const boardH = ROWS * size;
  const ox = (ctx.width - boardW) / 2;
  const oy = (ctx.height - boardH) / 2 + size / 2;

  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const board = new Array(COLS * ROWS).fill(0); // 0 empty, 1 player, 2 cpu
  const at = (c: number, r: number): number => board[r * COLS + c]!;
  let cursor = 3;
  let over = false;
  let turn = 1;

  ctx.hud.setScore(0);
  ctx.hud.setLabel('CONNECT 4');

  const drop = (col: number, who: number): number => {
    for (let r = ROWS - 1; r >= 0; r--)
      if (at(col, r) === 0) {
        board[r * COLS + col] = who;
        return r;
      }
    return -1;
  };

  const wins = (who: number): boolean => {
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (at(c, r) === who)
          for (const [dx, dy] of dirs) {
            let n = 1;
            let cc = c + dx!;
            let rr = r + dy!;
            while (cc >= 0 && cc < COLS && rr >= 0 && rr < ROWS && at(cc, rr) === who) {
              n++;
              cc += dx!;
              rr += dy!;
            }
            if (n >= 4) return true;
          }
    return false;
  };

  const full = (): boolean => board.every((v) => v !== 0);

  const endGame = (winner: number): void => {
    over = true;
    draw();
    if (winner === 1) {
      ctx.audio.sfx('levelup');
      ctx.hud.toast('YOU WIN!');
      ctx.gameOver(1000, { won: 1 });
    } else if (winner === 2) {
      ctx.audio.sfx('gameover');
      ctx.gameOver(100, { won: 0 });
    } else {
      ctx.hud.toast('DRAW');
      ctx.gameOver(300, { draw: 1 });
    }
  };

  const cpuMove = (): void => {
    const tryCol = (who: number): number => {
      for (let c = 0; c < COLS; c++) {
        const r = drop(c, who);
        if (r >= 0) {
          const win = wins(who);
          board[r * COLS + c] = 0;
          if (win) return c;
        }
      }
      return -1;
    };
    let col = tryCol(2);
    if (col < 0) col = tryCol(1);
    if (col < 0) col = [3, 2, 4, 1, 5, 0, 6].filter((c) => at(c, 0) === 0)[0] ?? 0;
    const r = drop(col, 2);
    if (r >= 0) {
      ctx.audio.sfx('blip');
      if (wins(2)) return endGame(2);
      if (full()) return endGame(0);
      turn = 1;
    }
    draw();
  };

  const playCol = (col: number): void => {
    if (over || turn !== 1) return;
    const r = drop(col, 1);
    if (r < 0) return;
    ctx.audio.sfx('coin');
    draw();
    if (wins(1)) return endGame(1);
    if (full()) return endGame(0);
    turn = 2;
    window.setTimeout(cpuMove, 350);
  };

  const offDown = ctx.input.on('down', (a: Action) => {
    if (over) return;
    if (a === 'left') cursor = (cursor + COLS - 1) % COLS;
    else if (a === 'right') cursor = (cursor + 1) % COLS;
    else if (a === 'a' || a === 'down') playCol(cursor);
    draw();
  });
  const offTap = ctx.input.on('tap', ({ x }) => {
    const c = Math.floor((x - ox) / size);
    if (c >= 0 && c < COLS) {
      cursor = c;
      playCol(c);
    }
  });

  function draw(): void {
    g.clear();
    if (!over) g.circle(ox + cursor * size + size / 2, oy - size * 0.5, size * 0.18).fill({ color: turn === 1 ? 0xffca28 : 0xff4d4d });
    g.roundRect(ox - 4, oy - 4, boardW + 8, boardH + 8, 10).fill({ color: 0x1d1d6e });
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const v = at(c, r);
        const col = v === 1 ? 0xffca28 : v === 2 ? 0xff4d4d : 0x0a0a12;
        g.circle(ox + c * size + size / 2, oy + r * size + size / 2, size * 0.4).fill({ color: col });
      }
  }
  draw();

  return {
    update() {},
    destroy() {
      offDown();
      offTap();
      layer.destroy({ children: true });
    },
  };
}
