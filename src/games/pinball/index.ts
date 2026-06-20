import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import { clamp } from '@utils/math';

interface Bumper {
  x: number;
  y: number;
  r: number;
  flash: number;
  lit: boolean;
}

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const GRAV = 620;
  const ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 8 };
  const flipperLen = W * 0.26;
  const flipperY = H - 60;
  const gapHalf = W * 0.12;
  let leftUp = false;
  let rightUp = false;
  let score = 0;
  let balls = 3;
  let over = false;
  let combo = 0; // Feature: bumper-combo multiplier
  let comboTimer = 0;
  let nextExtra = 5000; // Feature: extra-ball milestones

  const bumpers: Bumper[] = [
    { x: W * 0.3, y: H * 0.3, r: 22, flash: 0, lit: false },
    { x: W * 0.7, y: H * 0.3, r: 22, flash: 0, lit: false },
    { x: W * 0.5, y: H * 0.48, r: 26, flash: 0, lit: false },
  ];

  ctx.hud.setScore(0);
  ctx.hud.setLives(balls);
  ctx.hud.setLabel('A=L  B=R');

  const launch = (): void => {
    ball.x = W - 16;
    ball.y = H - 120;
    ball.vx = 0;
    ball.vy = -560;
  };
  launch();

  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a' || a === 'left') leftUp = true;
    if (a === 'b' || a === 'right') rightUp = true;
  });
  const offUp = ctx.input.on('up', (a) => {
    if (a === 'a' || a === 'left') leftUp = false;
    if (a === 'b' || a === 'right') rightUp = false;
  });

  const flipperHit = (fx0: number, fy0: number, fx1: number, fy1: number): void => {
    // distance from ball to the flipper segment
    const dx = fx1 - fx0;
    const dy = fy1 - fy0;
    const len2 = dx * dx + dy * dy;
    const t = clamp(((ball.x - fx0) * dx + (ball.y - fy0) * dy) / len2, 0, 1);
    const px = fx0 + dx * t;
    const py = fy0 + dy * t;
    const d = Math.hypot(ball.x - px, ball.y - py);
    if (d < ball.r + 4 && ball.vy > -50) {
      ball.vy = -Math.abs(ball.vy) - 180;
      ball.vx += (ball.x - px) * 4;
      ctx.audio.sfx('blip');
    }
  };

  const draw = (): void => {
    g.clear();
    // walls
    g.rect(0, 0, 6, H).fill({ color: 0x2b2b40 });
    g.rect(W - 6, 0, 6, H).fill({ color: 0x2b2b40 });
    g.rect(0, 0, W, 6).fill({ color: 0x2b2b40 });
    bumpers.forEach((b) => {
      g.circle(b.x, b.y, b.r).fill({ color: b.flash > 0 ? 0xffffff : b.lit ? 0x3ddc84 : 0xef5350 });
      g.circle(b.x, b.y, b.r * 0.5).fill({ color: 0xffd200 });
    });
    // flippers
    const angL = leftUp ? -0.5 : 0.3;
    const angR = rightUp ? 0.5 : -0.3;
    const lx0 = W / 2 - gapHalf;
    const rx0 = W / 2 + gapHalf;
    g.moveTo(lx0, flipperY).lineTo(lx0 - flipperLen * Math.cos(angL), flipperY + flipperLen * Math.sin(angL)).stroke({ width: 10, color: 0x00f7ff, cap: 'round' });
    g.moveTo(rx0, flipperY).lineTo(rx0 + flipperLen * Math.cos(angR), flipperY + flipperLen * Math.sin(angR)).stroke({ width: 10, color: 0x00f7ff, cap: 'round' });
    g.circle(ball.x, ball.y, ball.r).fill({ color: 0xffffff });
  };

  return {
    update(dt) {
      if (over) return;
      ball.vy += GRAV * dt;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      ball.vx *= 0.999;

      if (ball.x < 6 + ball.r) {
        ball.x = 6 + ball.r;
        ball.vx = Math.abs(ball.vx);
      } else if (ball.x > W - 6 - ball.r) {
        ball.x = W - 6 - ball.r;
        ball.vx = -Math.abs(ball.vx);
      }
      if (ball.y < 6 + ball.r) {
        ball.y = 6 + ball.r;
        ball.vy = Math.abs(ball.vy);
      }

      if (comboTimer > 0) comboTimer -= dt; else combo = 0;
      bumpers.forEach((b) => {
        if (b.flash > 0) b.flash -= dt;
        const d = Math.hypot(ball.x - b.x, ball.y - b.y);
        if (d < b.r + ball.r) {
          const nx = (ball.x - b.x) / d;
          const ny = (ball.y - b.y) / d;
          ball.vx = nx * 320;
          ball.vy = ny * 320;
          b.flash = 0.15;
          combo++;
          comboTimer = 2;
          const mult = 1 + Math.floor(combo / 4);
          score += 100 * mult;
          if (combo >= 4 && combo % 4 === 0) ctx.fx.floatingText(`COMBO x${mult}`, b.x, b.y - 30, 0xffd200);
          b.lit = true;
          // Feature: jackpot when all bumpers are lit
          if (bumpers.every((x) => x.lit)) {
            score += 2000;
            ctx.hud.toast('JACKPOT +2000');
            ctx.fx.screenShake(7, 0.18);
            bumpers.forEach((x) => (x.lit = false));
          }
          // Feature: extra ball at score milestones
          if (score >= nextExtra) {
            nextExtra += 5000;
            balls++;
            ctx.hud.setLives(balls);
            ctx.hud.toast('EXTRA BALL!');
          }
          ctx.hud.setScore(score);
          ctx.audio.sfx('coin');
        }
      });

      const angL = leftUp ? -0.5 : 0.3;
      const angR = rightUp ? 0.5 : -0.3;
      const lx0 = W / 2 - gapHalf;
      const rx0 = W / 2 + gapHalf;
      flipperHit(lx0, flipperY, lx0 - flipperLen * Math.cos(angL), flipperY + flipperLen * Math.sin(angL));
      flipperHit(rx0, flipperY, rx0 + flipperLen * Math.cos(angR), flipperY + flipperLen * Math.sin(angR));

      if (ball.y > H + 20) {
        balls--;
        ctx.hud.setLives(balls);
        ctx.audio.sfx('hit');
        if (balls <= 0) {
          over = true;
          ctx.gameOver(score, {});
          return;
        }
        launch();
      }
      draw();
    },
    destroy() {
      offDown();
      offUp();
      layer.destroy({ children: true });
    },
  };
}
