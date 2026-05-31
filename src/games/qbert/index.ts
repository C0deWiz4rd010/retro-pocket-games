import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action } from '@core/InputManager';

/**
 * Q*bert-lite: hop down an isometric pyramid of cubes, flipping each to the target
 * color. Four diagonal hops mapped to the d-pad. Falling off the edge costs a life.
 */
interface Cube {
  row: number;
  col: number;
  state: number; // 0 unflipped, 1 flipped
}

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const SIZE = 7; // pyramid rows
  const tile = Math.floor(Math.min(W / 9, H / 11));
  const cubeH = tile * 0.7;
  const cx = W / 2;
  const topY = H * 0.16;

  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const cubes: Cube[][] = [];
  for (let row = 0; row < SIZE; row++) {
    cubes[row] = [];
    for (let col = 0; col <= row; col++) cubes[row]![col] = { row, col, state: 0 };
  }

  const pos = (row: number, col: number): { x: number; y: number } => ({
    x: cx + (col - row / 2) * tile * 1.1,
    y: topY + row * cubeH,
  });

  const q = { row: 0, col: 0, fall: false };
  let score = 0;
  let lives = 3;
  let over = false;
  let level = 1;
  let flipped = 0;

  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('FLIP ALL CUBES');

  const totalCubes = (): number => (SIZE * (SIZE + 1)) / 2;

  // Four diagonal hops mapped to the d-pad:
  //  up = up-left, right = up-right, down = down-right, left = down-left.
  const hopDelta = (a: Action): { dr: number; dc: number } | null => {
    if (a === 'up') return { dr: -1, dc: -1 };
    if (a === 'right') return { dr: -1, dc: 0 };
    if (a === 'down') return { dr: 1, dc: 1 };
    if (a === 'left') return { dr: 1, dc: 0 };
    return null;
  };
  const hop = (a: Action): void => {
    if (over || q.fall) return;
    const move = hopDelta(a);
    if (!move) return;
    const nr = q.row + move.dr;
    const nc = q.col + move.dc;

    ctx.audio.sfx('jump');
    if (nr < 0 || nr >= SIZE || nc < 0 || nc > nr) {
      // fell off
      q.fall = true;
      ctx.audio.sfx('hit');
      window.setTimeout(() => loseLife(), 200);
      return;
    }
    q.row = nr;
    q.col = nc;
    const cube = cubes[nr]![nc]!;
    if (cube.state === 0) {
      cube.state = 1;
      flipped++;
      score += 25;
      ctx.hud.setScore(score);
      ctx.audio.sfx('coin');
      if (flipped >= totalCubes()) nextLevel();
    }
  };
  const offDown = ctx.input.on('down', hop);
  const offSwipe = ctx.input.on('swipe', (d) => hop(d));

  const loseLife = (): void => {
    lives--;
    ctx.hud.setLives(lives);
    if (lives <= 0) {
      over = true;
      ctx.gameOver(score, { level });
    } else {
      q.row = 0;
      q.col = 0;
      q.fall = false;
    }
  };

  const nextLevel = (): void => {
    level++;
    flipped = 0;
    score += 500;
    ctx.hud.setScore(score);
    ctx.hud.setLabel(`LEVEL ${level}`);
    ctx.audio.sfx('levelup');
    ctx.hud.toast(`LEVEL ${level}`);
    for (const rowArr of cubes) for (const c of rowArr) c.state = 0;
    q.row = 0;
    q.col = 0;
  };

  const drawCube = (x: number, y: number, flippedState: number): void => {
    const top = flippedState ? 0x3ddc84 : 0xffd200;
    const left = flippedState ? 0x2bb86c : 0xc99a00;
    const right = flippedState ? 0x238f54 : 0xa37e00;
    const hw = tile * 0.55;
    // top diamond
    g.poly([x, y, x + hw, y + cubeH * 0.4, x, y + cubeH * 0.8, x - hw, y + cubeH * 0.4]).fill({ color: top });
    // left face
    g.poly([x - hw, y + cubeH * 0.4, x, y + cubeH * 0.8, x, y + cubeH * 1.3, x - hw, y + cubeH * 0.9]).fill({ color: left });
    // right face
    g.poly([x + hw, y + cubeH * 0.4, x, y + cubeH * 0.8, x, y + cubeH * 1.3, x + hw, y + cubeH * 0.9]).fill({ color: right });
  };

  const draw = (): void => {
    g.clear();
    for (let row = 0; row < SIZE; row++)
      for (let col = 0; col <= row; col++) {
        const p = pos(row, col);
        drawCube(p.x, p.y, cubes[row]![col]!.state);
      }
    const qp = pos(q.row, q.col);
    const oy = q.fall ? 30 : -cubeH * 0.5;
    g.circle(qp.x, qp.y + oy, tile * 0.3).fill({ color: 0xff7b00 });
    g.circle(qp.x - 4, qp.y + oy - 3, 2).fill({ color: 0x101018 });
    g.circle(qp.x + 4, qp.y + oy - 3, 2).fill({ color: 0x101018 });
  };

  return {
    update() {
      if (over) return;
      draw();
    },
    destroy() {
      offDown();
      offSwipe();
      layer.destroy({ children: true });
    },
  };
}
