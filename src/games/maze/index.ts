import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action, Dir } from '@core/InputManager';

const DIRS: Record<string, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export default function createGame(ctx: GameContext): Game {
  // odd dimensions so the recursive-backtracker carver works cleanly
  const cols = 15;
  const rows = 21;
  const cell = Math.floor(Math.min(ctx.width / cols, (ctx.height - 20) / rows));
  const ox = (ctx.width - cols * cell) / 2;
  const oy = (ctx.height - rows * cell) / 2;

  const layer = new Container();
  layer.position.set(ox, oy);
  ctx.stage.addChild(layer);
  const mazeG = new Graphics();
  const g = new Graphics();
  layer.addChild(mazeG, g);

  // wall grid: true = wall
  const wall: boolean[] = new Array(cols * rows).fill(true);
  const wi = (c: number, r: number): number => r * cols + c;

  // recursive backtracker on odd cells
  const carve = (c: number, r: number): void => {
    wall[wi(c, r)] = false;
    const dirs = ctx.rng.shuffle([
      [0, -2],
      [0, 2],
      [-2, 0],
      [2, 0],
    ]);
    for (const [dx, dy] of dirs) {
      const nc = c + dx!;
      const nr = r + dy!;
      if (nc > 0 && nc < cols - 1 && nr > 0 && nr < rows - 1 && wall[wi(nc, nr)]) {
        wall[wi(c + dx! / 2, r + dy! / 2)] = false;
        carve(nc, nr);
      }
    }
  };
  carve(1, 1);

  const player = { c: 1, r: 1 };
  const exit = { c: cols - 2, r: rows - 2 };
  wall[wi(exit.c, exit.r)] = false;
  let timeLeft = 30;
  let over = false;
  let level = 1;
  let totalScore = 0;

  ctx.hud.setScore(0);
  ctx.hud.setLabel('30s');

  const move = (a: Action | Dir): void => {
    if (over) return;
    const d = DIRS[a];
    if (!d) return;
    const nc = player.c + d.x;
    const nr = player.r + d.y;
    if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || wall[wi(nc, nr)]) return;
    player.c = nc;
    player.r = nr;
    ctx.audio.sfx('blip');
    if (player.c === exit.c && player.r === exit.r) {
      const bonus = Math.ceil(timeLeft) * 10 + level * 100;
      totalScore += bonus;
      ctx.audio.sfx('levelup');
      ctx.hud.setScore(totalScore);
      ctx.hud.toast(`LV ${level} CLEAR! +${bonus}`);
      level++;
      // add time bonus, regenerate a larger maze
      timeLeft = Math.min(timeLeft + 12, 45);
      // clear and regenerate maze
      wall.fill(true);
      carve(1, 1);
      player.c = 1;
      player.r = 1;
      drawMaze();
      draw();
    }
    draw();
  };
  const offDown = ctx.input.on('down', move);
  const offSwipe = ctx.input.on('swipe', move);

  const drawMaze = (): void => {
    mazeG.clear();
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (wall[wi(c, r)]) mazeG.rect(c * cell, r * cell, cell, cell).fill({ color: 0x2b2b40 });
    mazeG.roundRect(exit.c * cell + 2, exit.r * cell + 2, cell - 4, cell - 4, 3).fill({ color: 0x3ddc84 });
  };
  drawMaze();

  const draw = (): void => {
    g.clear();
    g.circle(player.c * cell + cell / 2, player.r * cell + cell / 2, cell * 0.34).fill({ color: 0x00f7ff });
  };
  draw();

  return {
    update(dt) {
      if (over) return;
      timeLeft -= dt;
      ctx.hud.setLabel(`LV${level} ${Math.ceil(timeLeft)}s`);
      if (timeLeft <= 0) {
        over = true;
        ctx.audio.sfx('gameover');
        ctx.gameOver(totalScore, { level });
      }
    },
    destroy() {
      offDown();
      offSwipe();
      layer.destroy({ children: true });
    },
  };
}
