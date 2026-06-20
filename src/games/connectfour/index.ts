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
  // Feature: best-of-5 series with running score + winning-line highlight
  const SERIES = 5;
  let gameNo = 1;
  let pWins = 0;
  let cWins = 0;
  let score = 0;
  let winLine: number[] = [];

  ctx.hud.setScore(0);
  const setLabel = (): void => ctx.hud.setLabel(`GAME ${gameNo}/${SERIES} · YOU ${pWins}-${cWins} CPU`);
  setLabel();

  const drop = (col: number, who: number): number => {
    for (let r = ROWS - 1; r >= 0; r--)
      if (at(col, r) === 0) {
        board[r * COLS + col] = who;
        return r;
      }
    return -1;
  };

  const winningLine = (who: number): number[] | null => {
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (at(c, r) === who)
          for (const [dx, dy] of dirs) {
            const line = [r * COLS + c];
            let cc = c + dx!;
            let rr = r + dy!;
            while (cc >= 0 && cc < COLS && rr >= 0 && rr < ROWS && at(cc, rr) === who) {
              line.push(rr * COLS + cc);
              cc += dx!;
              rr += dy!;
            }
            if (line.length >= 4) return line.slice(0, 4);
          }
    return null;
  };
  const wins = (who: number): boolean => winningLine(who) !== null;

  const full = (): boolean => board.every((v) => v !== 0);

  const nextGame = (): void => {
    board.fill(0);
    winLine = [];
    gameNo++;
    turn = 1;
    over = false;
    setLabel();
    draw();
  };

  const endGame = (winner: number): void => {
    if (winner === 1) { pWins++; score += 1000; winLine = winningLine(1) ?? []; ctx.audio.sfx('levelup'); ctx.hud.toast('YOU WIN!'); }
    else if (winner === 2) { cWins++; score += 100; winLine = winningLine(2) ?? []; ctx.audio.sfx('gameover'); ctx.hud.toast('CPU WINS'); }
    else { score += 300; ctx.hud.toast('DRAW'); }
    ctx.hud.setScore(score);
    setLabel();
    draw();
    // series ends when someone clinches a majority or all games are played
    if (pWins > SERIES / 2 || cWins > SERIES / 2 || gameNo >= SERIES) {
      over = true;
      const bonus = pWins > cWins ? 1500 : 0;
      ctx.hud.toast(pWins > cWins ? 'SERIES WON!' : pWins < cWins ? 'SERIES LOST' : 'SERIES TIED');
      window.setTimeout(() => ctx.gameOver(score + bonus, { won: pWins > cWins ? 1 : 0, games: gameNo }), 900);
    } else {
      over = true; // block input until the next game starts
      window.setTimeout(nextGame, 1100);
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
    if (col < 0) {
      const order = [3, 2, 4, 1, 5, 0, 6].filter((c) => at(c, 0) === 0);
      // Feature: avoid a column that hands the player a winning reply
      const safe = order.filter((c) => {
        const r = drop(c, 2);
        let bad = false;
        for (let pc = 0; pc < COLS && !bad; pc++) {
          const pr = drop(pc, 1);
          if (pr >= 0) { if (wins(1)) bad = true; board[pr * COLS + pc] = 0; }
        }
        board[r * COLS + c] = 0;
        return !bad;
      });
      col = (safe[0] ?? order[0]) ?? 0;
    }
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
        if (winLine.includes(r * COLS + c)) {
          g.circle(ox + c * size + size / 2, oy + r * size + size / 2, size * 0.4).stroke({ width: 4, color: 0xffffff });
        }
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
