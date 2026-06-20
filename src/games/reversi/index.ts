import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

const N = 8;
const DIRS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

export default function createGame(ctx: GameContext): Game {
  const size = Math.min(ctx.width, ctx.height - 30) * 0.96;
  const cell = size / N;
  const ox = (ctx.width - size) / 2;
  const oy = (ctx.height - size) / 2;

  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  // 0 empty, 1 player(black), 2 cpu(white)
  const board = new Array(N * N).fill(0);
  const at = (c: number, r: number): number => board[r * N + c]!;
  const setCell = (c: number, r: number, v: number): void => {
    board[r * N + c] = v;
  };
  setCell(3, 3, 2);
  setCell(4, 4, 2);
  setCell(3, 4, 1);
  setCell(4, 3, 1);

  let over = false;
  let lastMove = -1; // Feature: highlight the most recent move
  let hints = 3; // Feature: best-move hint
  let flashCell = -1;
  let flashT = 0;

  // Feature: positional weights for a much stronger CPU (corners good, X/C squares bad)
  const WEIGHTS = [
    120, -20, 20, 5, 5, 20, -20, 120,
    -20, -40, -5, -5, -5, -5, -40, -20,
    20, -5, 15, 3, 3, 15, -5, 20,
    5, -5, 3, 3, 3, 3, -5, 5,
    5, -5, 3, 3, 3, 3, -5, 5,
    20, -5, 15, 3, 3, 15, -5, 20,
    -20, -40, -5, -5, -5, -5, -40, -20,
    120, -20, 20, 5, 5, 20, -20, 120,
  ];

  ctx.hud.setScore(2);
  const setLabel = (): void => { const { p, cpu } = counts(); ctx.hud.setLabel(`YOU ${p} · CPU ${cpu} · 💡${hints}`); };

  const flips = (c: number, r: number, who: number): number[][] => {
    if (at(c, r) !== 0) return [];
    const opp = who === 1 ? 2 : 1;
    const out: number[][] = [];
    for (const [dx, dy] of DIRS) {
      const line: number[][] = [];
      let cc = c + dx!;
      let rr = r + dy!;
      while (cc >= 0 && cc < N && rr >= 0 && rr < N && at(cc, rr) === opp) {
        line.push([cc, rr]);
        cc += dx!;
        rr += dy!;
      }
      if (line.length && cc >= 0 && cc < N && rr >= 0 && rr < N && at(cc, rr) === who) out.push(...line);
    }
    return out;
  };

  const legal = (who: number): number[][] => {
    const moves: number[][] = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (flips(c, r, who).length) moves.push([c, r]);
    return moves;
  };

  const place = (c: number, r: number, who: number): boolean => {
    const f = flips(c, r, who);
    if (!f.length) return false;
    setCell(c, r, who);
    for (const cell2 of f) setCell(cell2[0]!, cell2[1]!, who);
    return true;
  };

  const counts = (): { p: number; cpu: number } => {
    let p = 0;
    let cpu = 0;
    for (const v of board) {
      if (v === 1) p++;
      else if (v === 2) cpu++;
    }
    return { p, cpu };
  };

  const finish = (): void => {
    over = true;
    const { p, cpu } = counts();
    if (p > cpu) {
      ctx.audio.sfx('levelup');
      ctx.hud.toast(`WIN ${p}-${cpu}`);
    } else if (cpu > p) {
      ctx.audio.sfx('gameover');
      ctx.hud.toast(`LOSE ${p}-${cpu}`);
    } else {
      ctx.hud.toast(`DRAW ${p}-${cpu}`);
    }
    ctx.gameOver(p > cpu ? 500 + p * 10 : p * 10, { discs: p });
  };

  const cpuMove = (): void => {
    if (over) return;
    const moves = legal(2);
    if (!moves.length) {
      if (legal(1).length) return; // player continues
      finish();
      return;
    }
    let best = moves[0]!;
    let bestScore = -Infinity;
    for (const mv of moves) {
      const c = mv[0]!;
      const r = mv[1]!;
      // Feature: positional eval — board weight dominates, flips break ties
      const s = WEIGHTS[r * N + c]! + flips(c, r, 2).length;
      if (s > bestScore) {
        bestScore = s;
        best = mv;
      }
    }
    place(best[0]!, best[1]!, 2);
    lastMove = best[1]! * N + best[0]!;
    ctx.audio.sfx('blip');
    ctx.hud.setScore(counts().p);
    setLabel();
    draw();
    if (!legal(1).length && !legal(2).length) finish();
  };

  // Feature: hint — flash the player's strongest move by the same positional weights
  const useHint = (): void => {
    if (over || hints <= 0) return;
    const moves = legal(1);
    if (!moves.length) return;
    let best = moves[0]!, bestScore = -Infinity;
    for (const mv of moves) {
      const s = WEIGHTS[mv[1]! * N + mv[0]!]! + flips(mv[0]!, mv[1]!, 1).length;
      if (s > bestScore) { bestScore = s; best = mv; }
    }
    hints--;
    flashCell = best[1]! * N + best[0]!;
    flashT = 1.6;
    ctx.audio.sfx('powerup');
    setLabel();
    draw();
  };
  const offDown = ctx.input.on('down', (a) => { if (a === 'a' || a === 'b' || a === 'start') useHint(); });

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (over) return;
    const c = Math.floor((x - ox) / cell);
    const r = Math.floor((y - oy) / cell);
    if (c < 0 || r < 0 || c >= N || r >= N) return;
    if (place(c, r, 1)) {
      lastMove = r * N + c;
      ctx.audio.sfx('coin');
      ctx.hud.setScore(counts().p);
      setLabel();
      draw();
      if (legal(2).length) window.setTimeout(cpuMove, 350);
      else if (!legal(1).length) finish();
    }
  });

  function draw(): void {
    g.clear();
    g.roundRect(ox - 4, oy - 4, size + 8, size + 8, 8).fill({ color: 0x14331a });
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        g.rect(ox + c * cell + 1, oy + r * cell + 1, cell - 2, cell - 2).fill({ color: 0x1d6e44 });
        const i = r * N + c;
        if (i === lastMove) g.rect(ox + c * cell + 1, oy + r * cell + 1, cell - 2, cell - 2).fill({ color: 0x3a8f5e });
        const v = at(c, r);
        if (v) g.circle(ox + c * cell + cell / 2, oy + r * cell + cell / 2, cell * 0.4).fill({ color: v === 1 ? 0x101018 : 0xffffff });
        if (i === flashCell && flashT > 0) g.circle(ox + c * cell + cell / 2, oy + r * cell + cell / 2, cell * 0.42).stroke({ width: 4, color: 0x00f7ff, alpha: 0.5 + Math.sin(flashT * 16) * 0.4 });
      }
    if (!over)
      for (const mv of legal(1))
        g.circle(ox + mv[0]! * cell + cell / 2, oy + mv[1]! * cell + cell / 2, cell * 0.1).fill({ color: 0x9bffce });
  }
  setLabel();
  draw();

  return {
    update(dt) {
      if (flashT > 0) {
        flashT -= dt;
        if (flashT <= 0) flashCell = -1;
        draw();
      }
    },
    destroy() {
      offTap();
      offDown();
      layer.destroy({ children: true });
    },
  };
}
