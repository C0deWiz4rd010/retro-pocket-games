import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import { idx } from '@kits/grid/core';
import { burst, drawBackdrop, drawSparks, type Spark, updateSparks } from '@games/_shared/juice';

const COLS = 6;
const ROWS = 7;
const COLORS = [0x22d3ee, 0xff4d8d, 0xffd200, 0x3ddc84, 0xb388ff];

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const size = Math.min(W - 34, H - 142);
  const cell = size / COLS;
  const ox = (W - cell * COLS) / 2;
  const oy = 94;
  const layer = new Container();
  const g = new Graphics();
  layer.addChild(g);
  ctx.stage.addChild(layer);

  const board = new Array<number>(COLS * ROWS).fill(0).map(() => ctx.rng.int(0, COLORS.length - 1));
  const sparks: Spark[] = [];
  let score = 0;
  let moves = 24;
  let combo = 0;
  let t = 0;
  let over = false;

  ctx.hud.setScore(score);
  ctx.hud.setLabel(`MOVES ${moves}`);

  const at = (c: number, r: number): number => board[idx(COLS, c, r)] ?? -1;
  const collectGroup = (c: number, r: number): number[] => {
    const color = at(c, r);
    const seen = new Set<number>();
    const stack: [number, number][] = [[c, r]];
    while (stack.length) {
      const [x, y] = stack.pop()!;
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
      const i = idx(COLS, x, y);
      if (seen.has(i) || board[i] !== color) continue;
      seen.add(i);
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return [...seen];
  };

  const collapse = (): void => {
    for (let c = 0; c < COLS; c++) {
      let write = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        const value = at(c, r);
        if (value < 0) continue;
        board[idx(COLS, c, write)] = value;
        if (write !== r) board[idx(COLS, c, r)] = -1;
        write--;
      }
      for (let r = write; r >= 0; r--) board[idx(COLS, c, r)] = ctx.rng.int(0, COLORS.length - 1);
    }
  };

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (over) return;
    const c = Math.floor((x - ox) / cell);
    const r = Math.floor((y - oy) / cell);
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
    const group = collectGroup(c, r);
    if (group.length < 2) {
      combo = 0;
      ctx.audio.sfx('hit');
      ctx.fx.screenShake(2, 0.06);
      return;
    }
    moves--;
    combo++;
    const pts = group.length * group.length * 8 * combo;
    score += pts;
    for (const i of group) {
      const gx = ox + (i % COLS) * cell + cell / 2;
      const gy = oy + Math.floor(i / COLS) * cell + cell / 2;
      burst(sparks, ctx.rng, gx, gy, COLORS[board[i]!]!, 4, 90);
      board[i] = -1;
    }
    collapse();
    ctx.hud.setScore(score);
    ctx.hud.setLabel(`MOVES ${moves} x${combo}`);
    ctx.fx.floatingText(`+${pts}`, W / 2, oy - 22, 0xffd200);
    ctx.audio.sfx(group.length >= 6 ? 'powerup' : 'clear');
    if (moves <= 0) {
      over = true;
      ctx.gameOver(score, { combo });
    }
  });

  function draw(): void {
    g.clear();
    drawBackdrop(g, W, H, t, 0x2b1b5b, 0x070512);
    g.roundRect(ox - 7, oy - 7, COLS * cell + 14, ROWS * cell + 14, 12).fill({ color: 0x130a24, alpha: 0.86 });
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const value = at(c, r);
        const x = ox + c * cell;
        const y = oy + r * cell;
        const pulse = 1 + Math.sin(t * 5 + c + r) * 0.03;
        g.roundRect(x + 4, y + 4, cell - 8, cell - 8, 8).fill({ color: 0x1d1230 }).stroke({ width: 1, color: 0xffffff, alpha: 0.06 });
        g.roundRect(x + cell * 0.17, y + cell * 0.17, cell * 0.66 * pulse, cell * 0.66 * pulse, 7)
          .fill({ color: COLORS[value] ?? 0xffffff })
          .stroke({ width: 2, color: 0xffffff, alpha: 0.24 });
        g.circle(x + cell * 0.38, y + cell * 0.32, cell * 0.08).fill({ color: 0xffffff, alpha: 0.38 });
      }
    }
    drawSparks(g, sparks);
  }

  return {
    update(dt) {
      t += dt;
      updateSparks(sparks, dt);
      draw();
    },
    destroy() {
      offTap();
      layer.destroy({ children: true });
    },
  };
}
