import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import { clamp } from '@utils/math';

const BRICK_COLORS = [0xff4d4d, 0xff7b00, 0xffd200, 0x3ddc84, 0x00f7ff];

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const cols = 7;
  const brickW = (W - 20) / cols;
  const brickH = 18;
  const pad = { w: 70, h: 12, x: W / 2 - 35, y: H - 40 };
  const ball = { x: W / 2, y: pad.y - 8, vx: 0, vy: 0, r: 6, stuck: true };
  let bricks: { x: number; y: number; c: number }[] = [];
  let score = 0;
  let lives = 3;
  let level = 1;
  let over = false;

  const buildBricks = (): void => {
    bricks = [];
    const rows = Math.min(3 + level, 6);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        bricks.push({ x: 10 + c * brickW, y: 60 + r * (brickH + 6), c: BRICK_COLORS[r % BRICK_COLORS.length]! });
  };

  const resetBall = (): void => {
    ball.stuck = true;
    ball.x = pad.x + pad.w / 2;
    ball.y = pad.y - ball.r - 1;
    ball.vx = 0;
    ball.vy = 0;
  };

  const launch = (): void => {
    if (!ball.stuck) return;
    const speed = 280 + level * 20;
    ball.vx = (ctx.rng.next() < 0.5 ? -1 : 1) * speed * 0.5;
    ball.vy = -speed;
    ball.stuck = false;
    ctx.audio.sfx('blip');
  };

  buildBricks();
  resetBall();
  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('TAP TO LAUNCH');

  const offPtr = ctx.input.on('pointermove', ({ x }) => {
    pad.x = clamp(x - pad.w / 2, 0, W - pad.w);
    if (ball.stuck) ball.x = pad.x + pad.w / 2;
  });
  const offTap = ctx.input.on('tap', () => launch());
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a') launch();
  });

  const draw = (): void => {
    g.clear();
    bricks.forEach((b) => g.roundRect(b.x, b.y, brickW - 4, brickH, 3).fill({ color: b.c }));
    g.roundRect(pad.x, pad.y, pad.w, pad.h, 6).fill({ color: 0x00f7ff });
    g.circle(ball.x, ball.y, ball.r).fill({ color: 0xffffff });
  };

  return {
    update(dt) {
      if (over) return;
      const moveX = ctx.input.axis().x;
      if (moveX) pad.x = clamp(pad.x + moveX * 360 * dt, 0, W - pad.w);

      if (ball.stuck) {
        ball.x = pad.x + pad.w / 2;
        draw();
        return;
      }

      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.x < ball.r) {
        ball.x = ball.r;
        ball.vx = Math.abs(ball.vx);
      } else if (ball.x > W - ball.r) {
        ball.x = W - ball.r;
        ball.vx = -Math.abs(ball.vx);
      }
      if (ball.y < ball.r) {
        ball.y = ball.r;
        ball.vy = Math.abs(ball.vy);
      }

      // paddle
      if (
        ball.vy > 0 &&
        ball.y + ball.r >= pad.y &&
        ball.y < pad.y + pad.h &&
        ball.x >= pad.x &&
        ball.x <= pad.x + pad.w
      ) {
        const hit = (ball.x - (pad.x + pad.w / 2)) / (pad.w / 2);
        const speed = Math.hypot(ball.vx, ball.vy);
        ball.vx = hit * speed * 0.8;
        ball.vy = -Math.abs(speed * 0.7) - 40;
        ctx.audio.sfx('blip');
      }

      // bricks
      for (let i = 0; i < bricks.length; i++) {
        const b = bricks[i]!;
        if (ball.x > b.x && ball.x < b.x + brickW && ball.y > b.y && ball.y < b.y + brickH) {
          bricks.splice(i, 1);
          ball.vy = -ball.vy;
          score += 10 * level;
          ctx.hud.setScore(score);
          ctx.audio.sfx('hit');
          break;
        }
      }

      if (!bricks.length) {
        level++;
        ctx.audio.sfx('powerup');
        buildBricks();
        resetBall();
      }

      if (ball.y > H + 20) {
        lives--;
        ctx.hud.setLives(lives);
        ctx.audio.sfx('explosion');
        if (lives <= 0) {
          over = true;
          ctx.gameOver(score, { level });
          return;
        }
        resetBall();
      }
      draw();
    },
    destroy() {
      offPtr();
      offTap();
      offDown();
      layer.destroy({ children: true });
    },
  };
}
