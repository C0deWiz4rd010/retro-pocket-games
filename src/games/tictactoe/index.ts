import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export default function createGame(ctx: GameContext): Game {
  const size = Math.min(ctx.width, ctx.height) * 0.86;
  const cell = size / 3;
  const ox = (ctx.width - size) / 2;
  const oy = (ctx.height - size) / 2;

  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const board = new Array(9).fill(0); // 0 empty, 1 player(X), 2 cpu(O)
  let over = false;
  // Feature: best-of-5 series with scoreboard + winning-line highlight
  const SERIES = 5;
  let gameNo = 1;
  let pWins = 0;
  let cWins = 0;
  let score = 0;
  let winLine: number[] = [];

  ctx.hud.setScore(0);
  const setLabel = (): void => ctx.hud.setLabel(`GAME ${gameNo}/${SERIES} · YOU ${pWins}-${cWins} CPU`);
  setLabel();

  const winLineOf = (b: number[]): number[] | null => {
    for (const line of LINES) { const [a, c, d] = line; if (b[a!] && b[a!] === b[c!] && b[a!] === b[d!]) return line; }
    return null;
  };
  const winner = (b: number[]): number => {
    const l = winLineOf(b);
    return l ? b[l[0]!]! : 0;
  };

  // minimax → an unbeatable CPU
  const minimax = (b: number[], who: number): { score: number; move: number } => {
    const w = winner(b);
    if (w === 2) return { score: 10, move: -1 };
    if (w === 1) return { score: -10, move: -1 };
    if (b.every((v) => v)) return { score: 0, move: -1 };
    let best = { score: who === 2 ? -Infinity : Infinity, move: -1 };
    for (let i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = who;
      const res = minimax(b, who === 2 ? 1 : 2).score;
      b[i] = 0;
      if (who === 2 ? res > best.score : res < best.score) best = { score: res, move: i };
    }
    return best;
  };

  const nextGame = (): void => {
    board.fill(0);
    winLine = [];
    gameNo++;
    over = false;
    setLabel();
    draw();
    // Feature: alternate who starts; CPU opens every other game
    if (gameNo % 2 === 0) window.setTimeout(cpu, 400);
  };

  const finish = (): boolean => {
    const w = winner(board);
    if (w || board.every((v) => v)) {
      over = true;
      winLine = winLineOf(board) ?? [];
      if (w === 1) { pWins++; score += 1000; ctx.audio.sfx('levelup'); ctx.hud.toast('YOU WIN!'); }
      else if (w === 2) { cWins++; score += 100; ctx.audio.sfx('gameover'); ctx.hud.toast('CPU WINS'); }
      else { score += 400; ctx.hud.toast('DRAW'); }
      ctx.hud.setScore(score);
      setLabel();
      draw();
      if (pWins > SERIES / 2 || cWins > SERIES / 2 || gameNo >= SERIES) {
        const bonus = pWins > cWins ? 1500 : 0;
        ctx.hud.toast(pWins > cWins ? 'SERIES WON!' : pWins < cWins ? 'SERIES LOST' : 'SERIES TIED');
        window.setTimeout(() => ctx.gameOver(score + bonus, { won: pWins > cWins ? 1 : 0, games: gameNo }), 900);
      } else {
        window.setTimeout(nextGame, 1100);
      }
      return true;
    }
    return false;
  };

  function cpu(): void {
    if (over) return;
    // Feature: difficulty ramp — early games have a chance of a non-optimal move (winnable)
    const mistakeChance = Math.max(0, 0.4 - (gameNo - 1) * 0.12);
    const empties = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    let move: number;
    if (empties.length && ctx.rng.next() < mistakeChance) move = ctx.rng.pick(empties);
    else move = minimax([...board], 2).move;
    if (move >= 0) {
      board[move] = 2;
      ctx.audio.sfx('blip');
    }
    draw();
    finish();
  }

  const play = (i: number): void => {
    if (over || board[i]) return;
    board[i] = 1;
    ctx.audio.sfx('coin');
    draw();
    if (finish()) return;
    window.setTimeout(cpu, 300);
  };

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    const c = Math.floor((x - ox) / cell);
    const r = Math.floor((y - oy) / cell);
    if (c >= 0 && r >= 0 && c < 3 && r < 3) play(r * 3 + c);
  });

  function draw(): void {
    g.clear();
    g.roundRect(ox, oy, size, size, 10).fill({ color: 0x1d1d2b });
    for (let i = 1; i < 3; i++) {
      g.rect(ox + i * cell - 1, oy, 2, size).fill({ color: 0x2b2b40 });
      g.rect(ox, oy + i * cell - 1, size, 2).fill({ color: 0x2b2b40 });
    }
    for (let i = 0; i < 9; i++) {
      const c = i % 3;
      const r = Math.floor(i / 3);
      const cx = ox + c * cell + cell / 2;
      const cy = oy + r * cell + cell / 2;
      const m = cell * 0.28;
      if (winLine.includes(i)) g.roundRect(ox + c * cell + 4, oy + r * cell + 4, cell - 8, cell - 8, 8).fill({ color: 0x3ddc84, alpha: 0.22 });
      if (board[i] === 1) {
        g.moveTo(cx - m, cy - m).lineTo(cx + m, cy + m).moveTo(cx + m, cy - m).lineTo(cx - m, cy + m).stroke({ width: 6, color: 0x00f7ff });
      } else if (board[i] === 2) {
        g.circle(cx, cy, m).stroke({ width: 6, color: 0xff4d4d });
      }
    }
  }
  draw();

  return {
    update() {},
    destroy() {
      offTap();
      layer.destroy({ children: true });
    },
  };
}
