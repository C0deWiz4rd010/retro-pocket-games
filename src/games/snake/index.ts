import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action, Dir } from '@core/InputManager';
import { createSnake, setDir, step, type SnakeState } from './core';

const DIRS: Record<string, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export default function createGame(ctx: GameContext): Game {
  const cols = 18;
  const cell = Math.floor(ctx.width / cols);
  const rows = Math.floor(ctx.height / cell);
  const ox = (ctx.width - cols * cell) / 2;
  const oy = (ctx.height - rows * cell) / 2;

  const layer = new Container();
  layer.position.set(ox, oy);
  ctx.stage.addChild(layer);

  // checkerboard background
  const bg = new Graphics();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if ((x + y) % 2 === 0) bg.rect(x * cell, y * cell, cell, cell).fill({ color: 0xffffff, alpha: 0.03 });
    }
  }
  layer.addChild(bg);

  const food = new Graphics();
  const snakeG = new Graphics();
  layer.addChild(food, snakeG);

  const state: SnakeState = createSnake(cols, rows, ctx.rng);
  ctx.hud.setScore(0);

  const turn = (a: Action): void => {
    const d = DIRS[a];
    if (d) setDir(state, d);
  };
  const offDown = ctx.input.on('down', turn);
  const offSwipe = ctx.input.on('swipe', (d: Dir) => turn(d));

  let acc = 0;
  let dead = false;

  const interval = (): number => Math.max(0.06, 0.16 - state.score * 0.0008);

  const draw = (): void => {
    food.clear();
    food
      .circle(state.food.x * cell + cell / 2, state.food.y * cell + cell / 2, cell * 0.34)
      .fill({ color: 0xff2e97 });

    snakeG.clear();
    state.body.forEach((seg, i) => {
      const head = i === 0;
      snakeG
        .roundRect(seg.x * cell + 1, seg.y * cell + 1, cell - 2, cell - 2, 4)
        .fill({ color: head ? 0x9bffce : 0x3ddc84, alpha: head ? 1 : 0.9 });
    });
  };
  draw();

  return {
    update(dt) {
      if (dead) return;
      acc += dt;
      if (acc < interval()) return;
      acc = 0;
      const r = step(state, ctx.rng);
      if (r === 'eat') {
        ctx.audio.sfx('eat');
        ctx.hud.setScore(state.score);
      }
      if (r === 'dead') {
        dead = true;
        ctx.gameOver(state.score, { length: state.body.length });
        return;
      }
      draw();
    },
    destroy() {
      offDown();
      offSwipe();
      layer.destroy({ children: true });
    },
  };
}
