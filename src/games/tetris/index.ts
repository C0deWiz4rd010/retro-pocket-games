import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action } from '@core/InputManager';
import type { RNG } from '@utils/rng';

const COLS = 10;
const ROWS = 20;

type Cell = number;
interface Piece {
  id: number;
  m: number[][];
  color: number;
  x: number;
  y: number;
}

const SHAPES: { m: number[][]; color: number }[] = [
  { m: [[1, 1, 1, 1]], color: 0x00f7ff }, // I
  { m: [[1, 1], [1, 1]], color: 0xffd200 }, // O
  { m: [[0, 1, 0], [1, 1, 1]], color: 0xb14cff }, // T
  { m: [[0, 1, 1], [1, 1, 0]], color: 0x3ddc84 }, // S
  { m: [[1, 1, 0], [0, 1, 1]], color: 0xff4d4d }, // Z
  { m: [[1, 0, 0], [1, 1, 1]], color: 0x4a7bff }, // J
  { m: [[0, 0, 1], [1, 1, 1]], color: 0xff7b00 }, // L
];

const rotate = (m: number[][]): number[][] => m[0]!.map((_, x) => m.map((row) => row[x]!).reverse());
const bag = (rng: RNG): number[] => rng.shuffle([0, 1, 2, 3, 4, 5, 6]);

export default function createGame(ctx: GameContext): Game {
  const cell = Math.floor(Math.min(ctx.width / (COLS + 5), ctx.height / (ROWS + 1)));
  const fieldW = COLS * cell;
  const fieldH = ROWS * cell;
  const sideW = cell * 4.2;
  const totalW = fieldW + sideW;
  const ox = (ctx.width - totalW) / 2;
  const oy = (ctx.height - fieldH) / 2;

  const layer = new Container();
  layer.position.set(ox, oy);
  ctx.stage.addChild(layer);
  const frame = new Graphics();
  frame.rect(-3, -3, fieldW + 6, fieldH + 6).stroke({ width: 3, color: 0x2b2b40 });
  const g = new Graphics();
  const sideG = new Graphics();
  layer.addChild(frame, g, sideG);

  const board: Cell[] = new Array(COLS * ROWS).fill(0);
  const queue: number[] = [...bag(ctx.rng), ...bag(ctx.rng)];
  let holdId: number | null = null;
  let holdUsed = false;
  let score = 0;
  let lines = 0;
  let level = 1;
  let over = false;
  let dropAcc = 0;
  let softDrop = false;
  let lastClearWasTetris = false;
  let flashRows: number[] = [];
  let flashT = 0;
  let combo = -1; // Feature: back-to-back line-clear combo
  let lastMoveWasRotate = false; // for T-spin detection
  let shake = 0;
  interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: number }
  const particles: Particle[] = [];
  const spawnParticles = (rowY: number, color: number): void => {
    for (let i = 0; i < 14; i++) {
      particles.push({ x: Math.random() * fieldW, y: rowY * cell + cell / 2, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 120, life: 0.5, color });
    }
  };

  const makePiece = (id: number): Piece => {
    const s = SHAPES[id]!;
    return { id, m: s.m.map((r) => [...r]), color: s.color, x: Math.floor((COLS - s.m[0]!.length) / 2), y: 0 };
  };
  const spawn = (): Piece => {
    if (queue.length < 7) queue.push(...bag(ctx.rng));
    holdUsed = false;
    return makePiece(queue.shift() as number);
  };
  let piece = spawn();

  const collides = (p: Piece, nx = p.x, ny = p.y, m = p.m): boolean => {
    for (let y = 0; y < m.length; y++)
      for (let x = 0; x < m[y]!.length; x++) {
        if (!m[y]![x]) continue;
        const bx = nx + x;
        const by = ny + y;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && board[by * COLS + bx]) return true;
      }
    return false;
  };

  let pendingTSpin = false;
  const lock = (): void => {
    pendingTSpin = isTSpin();
    piece.m.forEach((row, y) =>
      row.forEach((v, x) => {
        if (v && piece.y + y >= 0) board[(piece.y + y) * COLS + piece.x + x] = piece.color;
      }),
    );
    clearLines();
    // if no flash pending, spawn immediately; otherwise update() handles it after flash
    if (flashT <= 0) {
      piece = spawn();
      if (collides(piece)) {
        over = true;
        ctx.gameOver(score, { lines, level });
      }
    }
  };

  const clearLines = (): void => {
    let cleared = 0;
    flashRows = [];
    for (let y = ROWS - 1; y >= 0; y--) {
      if (board.slice(y * COLS, y * COLS + COLS).every((c) => c !== 0)) {
        flashRows.push(y);
        cleared++;
      }
    }
    if (cleared) {
      flashT = 0.18;
      lines += cleared;
      const isTetris = cleared >= 4;
      const b2b = isTetris && lastClearWasTetris;
      const base = [0, 100, 300, 500, 800][cleared]! * level;
      let pts = b2b ? Math.floor(base * 1.5) : base;
      // Feature: T-spin bonus
      if (pendingTSpin) pts += 400 * cleared * level;
      // Feature: combo chain bonus
      combo++;
      if (combo > 0) pts += 50 * combo * level;
      score += pts;
      lastClearWasTetris = isTetris;
      level = 1 + Math.floor(lines / 10);
      shake = Math.min(0.6, 0.2 + cleared * 0.12);
      for (const ry of flashRows) spawnParticles(ry, 0xffffff);
      ctx.hud.setScore(score);
      ctx.hud.setLabel(`LV ${level}`);
      if (pendingTSpin) ctx.hud.toast(`T-SPIN! +${400 * cleared * level}`);
      else if (b2b) ctx.hud.toast('B2B TETRIS! x1.5');
      else if (isTetris) ctx.hud.toast('TETRIS!');
      if (combo > 0) ctx.hud.toast(`COMBO x${combo}`);
      ctx.audio.sfx(isTetris || pendingTSpin ? 'powerup' : 'clear');
    } else {
      lastClearWasTetris = false;
      combo = -1; // reset combo when a lock clears no lines
    }
    pendingTSpin = false;
  };

  const tryMove = (dx: number, dy: number): boolean => {
    if (collides(piece, piece.x + dx, piece.y + dy)) return false;
    piece.x += dx;
    piece.y += dy;
    lastMoveWasRotate = false;
    return true;
  };

  const tryRotate = (): void => {
    const r = rotate(piece.m);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collides(piece, piece.x + kick, piece.y, r)) {
        piece.m = r;
        piece.x += kick;
        lastMoveWasRotate = true;
        ctx.audio.sfx('blip');
        return;
      }
    }
  };

  // T-spin: a just-rotated T-piece wedged with 3+ corners blocked.
  const isTSpin = (): boolean => {
    if (piece.id !== 2 || !lastMoveWasRotate) return false;
    const corners = [[0, 0], [2, 0], [0, 2], [2, 2]];
    let blocked = 0;
    for (const [dx, dy] of corners) {
      const bx = piece.x + dx!;
      const by = piece.y + dy!;
      if (bx < 0 || bx >= COLS || by >= ROWS || (by >= 0 && board[by * COLS + bx])) blocked++;
    }
    return blocked >= 3;
  };

  const hardDrop = (): void => {
    while (tryMove(0, 1)) score += 1;
    ctx.hud.setScore(score);
    lock();
  };

  const hold = (): void => {
    if (holdUsed) return;
    holdUsed = true;
    const cur = piece.id;
    if (holdId === null) {
      holdId = cur;
      piece = spawn();
    } else {
      const swap = holdId;
      holdId = cur;
      piece = makePiece(swap);
    }
    ctx.audio.sfx('select');
  };

  const onDown = (a: Action): void => {
    if (over) return;
    if (a === 'left') tryMove(-1, 0);
    else if (a === 'right') tryMove(1, 0);
    else if (a === 'a' || a === 'up') tryRotate();
    else if (a === 'down') softDrop = true;
    else if (a === 'b') hardDrop();
    else if (a === 'select' || a === 'start') hold();
  };
  const onUp = (a: Action): void => {
    if (a === 'down') softDrop = false;
  };
  const offD = ctx.input.on('down', onDown);
  const offU = ctx.input.on('up', onUp);
  const offS = ctx.input.on('swipe', (d) => {
    if (over) return;
    if (d === 'down') hardDrop();
    else if (d === 'left') tryMove(-1, 0);
    else if (d === 'right') tryMove(1, 0);
    else tryRotate();
  });

  ctx.hud.setScore(0);
  ctx.hud.setLabel('LV 1');

  const drawMini = (id: number | null, px: number, py: number): void => {
    if (id === null) return;
    const s = SHAPES[id]!;
    const mc = cell * 0.7;
    s.m.forEach((row, y) =>
      row.forEach((v, x) => {
        if (v) sideG.roundRect(px + x * mc, py + y * mc, mc - 2, mc - 2, 2).fill({ color: s.color });
      }),
    );
  };

  const draw = (): void => {
    g.clear();
    g.rect(0, 0, fieldW, fieldH).fill({ color: 0x0a0a12, alpha: 0.6 });
    board.forEach((c, i) => {
      if (!c) return;
      const x = (i % COLS) * cell;
      const y = Math.floor(i / COLS) * cell;
      const row = Math.floor(i / COLS);
      const flashing = flashRows.includes(row) && flashT > 0;
      g.roundRect(x + 1, y + 1, cell - 2, cell - 2, 3).fill({ color: flashing ? 0xffffff : c });
    });
    let gy = piece.y;
    while (!collides(piece, piece.x, gy + 1)) gy++;
    piece.m.forEach((row, y) =>
      row.forEach((v, x) => {
        if (v) g.roundRect((piece.x + x) * cell + 1, (gy + y) * cell + 1, cell - 2, cell - 2, 3).fill({ color: piece.color, alpha: 0.18 });
      }),
    );
    piece.m.forEach((row, y) =>
      row.forEach((v, x) => {
        if (v && piece.y + y >= 0)
          g.roundRect((piece.x + x) * cell + 1, (piece.y + y) * cell + 1, cell - 2, cell - 2, 3).fill({ color: piece.color });
      }),
    );

    for (const p of particles) g.circle(p.x, p.y, 3 * Math.min(1, p.life * 2)).fill({ color: p.color, alpha: Math.min(1, p.life * 2) });

    sideG.clear();
    const sx = fieldW + cell * 0.6;
    sideG.rect(sx, 0, sideW - cell * 0.6, fieldH).fill({ color: 0x0a0a12, alpha: 0.3 });
    drawMini(holdId, sx + cell * 0.3, cell * 1.0);
    for (let n = 0; n < 3; n++) drawMini(queue[n] ?? null, sx + cell * 0.3, cell * (4.2 + n * 2.4));
  };

  return {
    update(dt) {
      if (over) return;
      // particles + shake animate independently of lock state
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }
      if (shake > 0) shake = Math.max(0, shake - dt * 2);
      layer.position.set(ox + (shake > 0 ? (Math.random() * 2 - 1) * shake * 6 : 0), oy + (shake > 0 ? (Math.random() * 2 - 1) * shake * 6 : 0));
      if (flashT > 0) {
        flashT -= dt;
        if (flashT <= 0) {
          // actually remove the flashed rows
          for (let y = ROWS - 1; y >= 0; ) {
            if (board.slice(y * COLS, y * COLS + COLS).every((c) => c !== 0)) {
              board.splice(y * COLS, COLS);
              board.unshift(...new Array(COLS).fill(0));
            } else {
              y--;
            }
          }
          flashRows = [];
          piece = spawn();
          if (collides(piece)) {
            over = true;
            ctx.gameOver(score, { lines, level });
          }
        }
        draw();
        return;
      }
      dropAcc += dt;
      const speed = softDrop ? 0.05 : Math.max(0.08, 0.8 - (level - 1) * 0.07);
      if (dropAcc >= speed) {
        dropAcc = 0;
        if (!tryMove(0, 1)) lock();
      }
      draw();
    },
    destroy() {
      offD();
      offU();
      offS();
      layer.destroy({ children: true });
    },
  };
}
