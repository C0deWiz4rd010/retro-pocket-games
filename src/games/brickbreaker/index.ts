import type { Game, GameContext } from '@core/types';
import { burst, clamp, drawSparks, updateSparks } from '@kits/arcade/juice';
import {
  CYAN,
  PINK,
  GOLD,
  GREEN,
  VIOLET,
  WHITE,
  makeLayer,
  backdrop,
  boxHit,
} from '@kits/arcade/concept';

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const { layer, g, sparks } = makeLayer(ctx);
  const paddle = { x: W / 2, y: H - 54, w: 76 };
  interface Ball {
    x: number;
    y: number;
    vx: number;
    vy: number;
    r: number;
  }
  let balls: Ball[] = [{ x: W / 2, y: H - 82, vx: 180, vy: -285, r: 6 }];
  const bricks: { x: number; y: number; w: number; h: number; hp: number; color: number }[] = [];
  const drops: { x: number; y: number; kind: 'multi' | 'slow' | 'grow' }[] = []; // Feature: power-up capsules
  let score = 0;
  let lives = 3;
  let cleared = 0;
  let hot = 0;
  let slow = 0; // Feature timer
  let level = 1; // Feature: level progression
  let combo = 0; // Feature: hits before the ball touches the paddle
  let t = 0;
  const colors = [PINK, GOLD, GREEN, CYAN, VIOLET];
  const DROP: Record<string, number> = { multi: CYAN, slow: GOLD, grow: GREEN };
  const buildBricks = (lvl: number): void => {
    bricks.length = 0;
    const rowsN = Math.min(5 + lvl, 8);
    for (let r = 0; r < rowsN; r++) {
      for (let c = 0; c < 8; c++)
        bricks.push({
          x: 18 + c * 40,
          y: 62 + r * 24,
          w: 34,
          h: 15,
          hp: r < lvl ? 2 : 1,
          color: colors[r % colors.length]!,
        });
    }
  };
  buildBricks(level);
  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('BREAK · L1');
  const offPtr = ctx.input.on('pointermove', ({ x }) => {
    paddle.x = clamp(x, paddle.w / 2, W - paddle.w / 2);
  });
  function draw(): void {
    g.clear();
    backdrop(g, W, H, t, H * 0.72);
    for (const b of bricks) {
      g.roundRect(b.x, b.y, b.w, b.h, 4)
        .fill({ color: b.color, alpha: b.hp === 2 ? 0.92 : 0.75 })
        .stroke({ width: 1, color: WHITE, alpha: 0.22 });
    }
    for (const d of drops) {
      g.roundRect(d.x - 8, d.y - 6, 16, 12, 3).fill({ color: DROP[d.kind]! });
      g.roundRect(d.x - 8, d.y - 6, 16, 12, 3).stroke({ width: 1, color: WHITE, alpha: 0.6 });
    }
    g.roundRect(paddle.x - paddle.w / 2, paddle.y, paddle.w, 12, 6).fill({
      color: slow > 0 ? GOLD : CYAN,
    });
    for (const ball of balls)
      g.circle(ball.x, ball.y, ball.r + (hot > 0 ? 2 : 0)).fill({ color: hot > 0 ? GOLD : WHITE });
    drawSparks(g, sparks);
  }
  return {
    update(dt) {
      t += dt;
      updateSparks(sparks, dt);
      hot = Math.max(0, hot - dt);
      slow = Math.max(0, slow - dt);
      const ax = ctx.input.axis().x;
      if (ax) paddle.x = clamp(paddle.x + ax * 330 * dt, paddle.w / 2, W - paddle.w / 2);
      const sp = slow > 0 ? 0.62 : 1;
      for (const ball of balls) {
        ball.x += ball.vx * dt * sp;
        ball.y += ball.vy * dt * sp;
        if (ball.x < ball.r || ball.x > W - ball.r) ball.vx *= -1;
        if (ball.y < ball.r) ball.vy = Math.abs(ball.vy);
        if (
          boxHit(
            ball.x - ball.r,
            ball.y - ball.r,
            ball.r * 2,
            ball.r * 2,
            paddle.x - paddle.w / 2,
            paddle.y,
            paddle.w,
            14,
          ) &&
          ball.vy > 0
        ) {
          ball.vy = -Math.abs(ball.vy) * 1.02;
          ball.vx += (ball.x - paddle.x) * 4;
          combo = 0; // paddle touch breaks the combo
          ctx.audio.sfx('blip');
        }
        for (let i = bricks.length - 1; i >= 0; i--) {
          const b = bricks[i]!;
          if (
            boxHit(ball.x - ball.r, ball.y - ball.r, ball.r * 2, ball.r * 2, b.x, b.y, b.w, b.h)
          ) {
            ball.vy *= -1;
            b.hp -= hot > 0 ? 2 : 1;
            if (b.hp <= 0) {
              bricks.splice(i, 1);
              cleared++;
              combo++;
              const mult = 1 + Math.floor(combo / 5);
              score += (hot > 0 ? 120 : 80) * mult;
              if (combo > 0 && combo % 5 === 0)
                ctx.fx.floatingText(`COMBO x${mult}`, b.x + b.w / 2, b.y, GOLD);
              burst(sparks, ctx.rng, b.x + b.w / 2, b.y + b.h / 2, b.color, 9, 90);
              ctx.audio.sfx('coin');
              if (ctx.rng.next() < 0.12)
                drops.push({
                  x: b.x + b.w / 2,
                  y: b.y,
                  kind: ctx.rng.pick(['multi', 'slow', 'grow'] as const),
                });
              if (cleared % 10 === 0) {
                hot = 5;
                ctx.hud.toast('HOT BALL');
              }
            } else ctx.audio.sfx('hit');
            break;
          }
        }
      }
      // capsules fall + catch
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]!;
        d.y += 130 * dt;
        if (d.y > H + 10) {
          drops.splice(i, 1);
          continue;
        }
        if (Math.abs(d.x - paddle.x) < paddle.w / 2 + 6 && d.y > paddle.y - 6) {
          drops.splice(i, 1);
          if (d.kind === 'multi') {
            const extra: Ball[] = [];
            for (const b of balls) {
              const s = Math.hypot(b.vx, b.vy) || 320;
              extra.push(
                { x: b.x, y: b.y, vx: s * 0.5, vy: -Math.abs(s * 0.86), r: 6 },
                { x: b.x, y: b.y, vx: -s * 0.5, vy: -Math.abs(s * 0.86), r: 6 },
              );
            }
            balls.push(...extra.slice(0, 4));
            ctx.hud.toast('MULTIBALL');
          } else if (d.kind === 'slow') {
            slow = 7;
            ctx.hud.toast('SLOW');
          } else {
            paddle.w = Math.min(132, paddle.w + 18);
            ctx.hud.toast('WIDE PADDLE');
          }
          ctx.audio.sfx('powerup');
        }
      }
      // lost balls
      balls = balls.filter((b) => b.y <= H + 20);
      if (balls.length === 0) {
        lives--;
        ctx.hud.setLives(lives);
        balls = [{ x: paddle.x, y: H - 82, vx: ctx.rng.pick([-190, 190]), vy: -285, r: 6 }];
        if (lives <= 0) {
          ctx.gameOver(score, { level });
          return;
        }
      }
      // Feature: clear the board → next level
      if (!bricks.length) {
        level++;
        score += 500;
        paddle.w = 76;
        drops.length = 0;
        balls = [{ x: paddle.x, y: H - 82, vx: ctx.rng.pick([-200, 200]), vy: -300, r: 6 }];
        buildBricks(level);
        ctx.audio.sfx('levelup');
        ctx.hud.toast(`LEVEL ${level}`);
      }
      ctx.hud.setScore(score);
      ctx.hud.setLabel(
        hot > 0
          ? `HOT ${Math.ceil(hot)}`
          : slow > 0
            ? `SLOW ${Math.ceil(slow)}`
            : combo >= 5
              ? `COMBO x${1 + Math.floor(combo / 5)}`
              : `BREAK · L${level}`,
      );
      draw();
    },
    destroy() {
      offPtr();
      layer.destroy({ children: true });
    },
  };
}
