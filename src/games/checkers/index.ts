import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

const N = 8; // board size

type Piece = { color: 0 | 1; king: boolean } | null;

interface Move {
  fr: number; fc: number;
  tr: number; tc: number;
  captures: { r: number; c: number }[];
}

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const pad = 10;
  const boardSize = Math.min(W, H - 20) - pad * 2;
  const cell = Math.floor(boardSize / N);
  const gw = cell * N;
  const ox = (W - gw) / 2;
  const oy = (H - gw) / 2;

  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);
  const statusText = new Text({
    text: '',
    style: { fontFamily: 'VT323, monospace', fontSize: 16, fill: 0xffd200 },
  });
  statusText.anchor.set(0.5, 0);
  statusText.position.set(W / 2, oy + gw + 8);
  layer.addChild(statusText);

  const board: Piece[][] = Array.from({ length: N }, () => new Array(N).fill(null));

  // initial setup: 0 = dark (player), 1 = light (AI)
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if ((r + c) % 2 === 1) {
        if (r < 3) board[r]![c] = { color: 1, king: false };
        else if (r > 4) board[r]![c] = { color: 0, king: false };
      }
    }
  }

  let sel: { r: number; c: number } | null = null;
  let playerTurn = true;
  let over = false;
  let score = 0;
  let aiTimer = 0;
  let aiPending = false;

  ctx.hud.setScore(0);
  ctx.hud.setLabel('YOUR TURN (DARK)');

  const isValid = (r: number, c: number): boolean => r >= 0 && r < N && c >= 0 && c < N;

  const getMoves = (color: 0 | 1, mustCapture = false): Move[] => {
    const moves: Move[] = [];
    const dir = color === 0 ? -1 : 1; // player (0) moves up, AI (1) moves down

    const getJumps = (r: number, c: number, piece: { color: 0 | 1; king: boolean }, visited: Set<string>): Move[] => {
      const jumps: Move[] = [];
      const dirs = piece.king ? [-1, 1] : [dir];
      for (const dr of dirs) {
        for (const dc of [-1, 1]) {
          const mr = r + dr, mc = c + dc;
          const lr = r + dr * 2, lc = c + dc * 2;
          if (isValid(lr, lc) && board[mr]?.[mc]?.color === (color === 0 ? 1 : 0) && !board[lr]![lc]) {
            const key = `${lr},${lc}`;
            if (!visited.has(key)) {
              visited.add(key);
              const cap = { r: mr, c: mc };
              // check multi-jump
              const savedPiece = board[mr]![mc];
              board[mr]![mc] = null;
              const further = getJumps(lr, lc, piece, new Set(visited));
              board[mr]![mc] = savedPiece;
              if (further.length) {
                further.forEach((m) => {
                  jumps.push({ fr: r, fc: c, tr: m.tr, tc: m.tc, captures: [cap, ...m.captures] });
                });
              } else {
                jumps.push({ fr: r, fc: c, tr: lr, tc: lc, captures: [cap] });
              }
              visited.delete(key);
            }
          }
        }
      }
      return jumps;
    };

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const p = board[r]![c];
        if (!p || p.color !== color) continue;
        // capture moves
        const jumps = getJumps(r, c, p, new Set<string>([`${r},${c}`]));
        moves.push(...jumps);
      }
    }

    // if captures available, they're mandatory
    if (moves.length > 0) return moves;
    if (mustCapture) return [];

    // simple moves
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const p = board[r]![c];
        if (!p || p.color !== color) continue;
        const dirs = p.king ? [-1, 1] : [dir];
        for (const dr of dirs) {
          for (const dc of [-1, 1]) {
            const nr = r + dr, nc = c + dc;
            if (isValid(nr, nc) && !board[nr]![nc]) {
              moves.push({ fr: r, fc: c, tr: nr, tc: nc, captures: [] });
            }
          }
        }
      }
    }
    return moves;
  };

  const applyMove = (m: Move): void => {
    const piece = board[m.fr]![m.fc]!;
    board[m.tr]![m.tc] = piece;
    board[m.fr]![m.fc] = null;
    m.captures.forEach(({ r, c }) => { board[r]![c] = null; });
    // promote to king
    if (piece.color === 0 && m.tr === 0) piece.king = true;
    if (piece.color === 1 && m.tr === N - 1) piece.king = true;
  };

  const countPieces = (color: 0 | 1): number => {
    let n = 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (board[r]![c]?.color === color) n++;
    return n;
  };

  const aiMove = (): void => {
    const moves = getMoves(1);
    if (!moves.length) {
      over = true;
      ctx.hud.toast('YOU WIN!');
      ctx.audio.sfx('powerup');
      ctx.gameOver(score + 500, {});
      return;
    }
    // greedy: prefer captures, prefer kings
    moves.sort((a, b) => {
      if (b.captures.length !== a.captures.length) return b.captures.length - a.captures.length;
      const ap = board[a.fr]![a.fc];
      const bp = board[b.fr]![b.fc];
      return (bp?.king ? 1 : 0) - (ap?.king ? 1 : 0);
    });
    // pick top move with slight randomness
    const topLen = moves[0]!.captures.length;
    const candidates = moves.filter((m) => m.captures.length === topLen);
    const chosen = candidates[Math.floor(ctx.rng.next() * candidates.length)]!;
    applyMove(chosen);
    if (chosen.captures.length) {
      ctx.audio.sfx('explosion');
      score -= chosen.captures.length * 50;
      ctx.hud.setScore(Math.max(0, score));
    } else {
      ctx.audio.sfx('blip');
    }
    const playerMoves = getMoves(0);
    if (!playerMoves.length) {
      over = true;
      ctx.hud.toast('AI WINS');
      ctx.audio.sfx('gameover');
      ctx.gameOver(Math.max(0, score), {});
    } else {
      playerTurn = true;
      ctx.hud.setLabel('YOUR TURN');
    }
    draw();
  };

  const validMoves = (): Move[] => getMoves(0);

  const draw = (): void => {
    g.clear();
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const x = ox + c * cell;
        const y = oy + r * cell;
        const dark = (r + c) % 2 === 1;
        g.rect(x, y, cell, cell).fill({ color: dark ? 0x2a1a0a : 0xd4a96a });
      }
    }

    // highlight valid moves for selected piece
    const moves = playerTurn ? validMoves() : [];
    if (sel) {
      const selMoves = moves.filter((m) => m.fr === sel!.r && m.fc === sel!.c);
      selMoves.forEach((m) => {
        g.roundRect(ox + m.tc * cell + 3, oy + m.tr * cell + 3, cell - 6, cell - 6, 4)
          .fill({ color: 0x3ddc84, alpha: 0.4 });
      });
      g.roundRect(ox + sel.c * cell + 1, oy + sel.r * cell + 1, cell - 2, cell - 2, 4)
        .stroke({ width: 2, color: 0xffd200 });
    }

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const p = board[r]![c];
        if (!p) continue;
        const x = ox + c * cell + cell / 2;
        const y = oy + r * cell + cell / 2;
        const radius = cell * 0.36;
        const col = p.color === 0 ? 0x222233 : 0xeeeeee;
        const rim = p.color === 0 ? 0x4466ff : 0xffaa33;
        g.circle(x, y, radius).fill({ color: col });
        g.circle(x, y, radius * 0.75).fill({ color: rim, alpha: 0.5 });
        if (p.king) {
          g.circle(x, y, radius * 0.32).fill({ color: 0xffd200 });
        }
      }
    }

    const pc = countPieces(0);
    const ac = countPieces(1);
    statusText.text = `YOU: ${pc}  AI: ${ac}`;
  };

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (over || !playerTurn || aiPending) return;
    const c = Math.floor((x - ox) / cell);
    const r = Math.floor((y - oy) / cell);
    if (!isValid(r, c)) return;

    if (sel) {
      // try to apply move
      const moves = getMoves(0);
      const m = moves.find((mv) => mv.fr === sel!.r && mv.fc === sel!.c && mv.tr === r && mv.tc === c);
      if (m) {
        applyMove(m);
        if (m.captures.length) {
          ctx.audio.sfx('coin');
          score += m.captures.length * 100;
          ctx.hud.setScore(score);
        } else {
          ctx.audio.sfx('blip');
        }
        sel = null;
        playerTurn = false;
        ctx.hud.setLabel('AI THINKING…');
        draw();

        if (countPieces(1) === 0) {
          over = true;
          ctx.hud.toast('YOU WIN!');
          ctx.audio.sfx('powerup');
          ctx.gameOver(score + 500, {});
        } else {
          aiPending = true;
          aiTimer = 0.5;
        }
        return;
      }
    }
    // select piece
    if (board[r]![c]?.color === 0) {
      sel = { r, c };
      ctx.audio.sfx('select');
      draw();
    } else {
      sel = null;
      draw();
    }
  });

  draw();

  return {
    update(dt) {
      if (over) return;
      if (aiPending) {
        aiTimer -= dt;
        if (aiTimer <= 0) {
          aiPending = false;
          aiMove();
        }
      }
    },
    destroy() {
      offTap();
      layer.destroy({ children: true });
    },
  };
}
