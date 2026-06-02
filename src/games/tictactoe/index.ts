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

  ctx.hud.setScore(0);
  ctx.hud.setLabel('YOU ARE X');

  const winner = (b: number[]): number => {
    for (const [a, c, d] of LINES) if (b[a!] && b[a!] === b[c!] && b[a!] === b[d!]) return b[a!]!;
    return 0;
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

  const finish = (): boolean => {
    const w = winner(board);
    if (w || board.every((v) => v)) {
      over = true;
      if (w === 1) {
        ctx.audio.sfx('levelup');
        ctx.hud.toast('YOU WIN!');
      } else if (w === 2) {
        ctx.audio.sfx('gameover');
        ctx.hud.toast('CPU WINS');
      } else {
        ctx.hud.toast('DRAW');
      }
      ctx.gameOver(w === 1 ? 1000 : w === 2 ? 100 : 400, { won: w === 1 ? 1 : 0 });
      return true;
    }
    return false;
  };

  const cpu = (): void => {
    const { move } = minimax([...board], 2);
    if (move >= 0) {
      board[move] = 2;
      ctx.audio.sfx('blip');
    }
    draw();
    finish();
  };

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
