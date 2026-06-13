import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import { clamp } from '@utils/math';

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const padH = 70;
  const padW = 10;
  const player = { y: H / 2 - padH / 2 };
  const cpu = { y: H / 2 - padH / 2 };
  const ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 7 };
  let pScore = 0;
  let cScore = 0;
  let over = false;
  let rally = 0;
  let bestRally = 0;
  const trail: { x: number; y: number }[] = [];
  const WIN = 11;

  const serve = (toPlayer: boolean): void => {
    ball.x = W / 2;
    ball.y = H / 2;
    const speed = 300;
    ball.vx = (toPlayer ? -1 : 1) * speed;
    ball.vy = (ctx.rng.next() * 2 - 1) * speed * 0.5;
  };
  serve(ctx.rng.next() < 0.5);

  const setLabel = (): void => ctx.hud.setLabel(`YOU ${pScore} : ${cScore} CPU`);
  ctx.hud.setScore(0);
  setLabel();

  const offPtr = ctx.input.on('pointermove', ({ y }) => {
    player.y = clamp(y - padH / 2, 0, H - padH);
  });

  const draw = (): void => {
    g.clear();
    for (let y = 0; y < H; y += 24) g.rect(W / 2 - 1, y, 2, 12).fill({ color: 0xffffff, alpha: 0.3 });
    trail.forEach((t, i) =>
      g
        .circle(t.x, t.y, ball.r * (0.3 + (i / trail.length) * 0.6))
        .fill({ color: 0x00f7ff, alpha: (i / trail.length) * 0.4 }),
    );
    g.roundRect(14, player.y, padW, padH, 4).fill({ color: 0x00f7ff });
    g.roundRect(W - 14 - padW, cpu.y, padW, padH, 4).fill({ color: 0xff2e97 });
    g.circle(ball.x, ball.y, ball.r).fill({ color: 0xffffff });
  };

  const point = (player1: boolean): void => {
    if (player1) pScore++;
    else cScore++;
    bestRally = Math.max(bestRally, rally);
    rally = 0;
    trail.length = 0;
    ctx.hud.setScore(pScore);
    setLabel();
    ctx.audio.sfx(player1 ? 'coin' : 'hit');
    if (pScore >= WIN || cScore >= WIN) {
      over = true;
      ctx.gameOver(pScore * 100 + (pScore > cScore ? 500 : 0), {
        won: pScore > cScore ? 1 : 0,
        rally: bestRally,
      });
      return;
    }
    serve(!player1);
  };

  return {
    update(dt) {
      if (over) return;
      const ax = ctx.input.axis().y;
      if (ax) player.y = clamp(player.y + ax * 420 * dt, 0, H - padH);

      // CPU AI: track ball with capped speed + slight lag; gets faster as player scores more
      const target = ball.y - padH / 2;
      const cpuSpeed = 200 + Math.min(pScore, 8) * 15;
      cpu.y += clamp(target - cpu.y, -cpuSpeed * dt, cpuSpeed * dt);
      cpu.y = clamp(cpu.y, 0, H - padH);

      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      trail.push({ x: ball.x, y: ball.y });
      if (trail.length > 8) trail.shift();
      if (ball.y < ball.r) {
        ball.y = ball.r;
        ball.vy = Math.abs(ball.vy);
      } else if (ball.y > H - ball.r) {
        ball.y = H - ball.r;
        ball.vy = -Math.abs(ball.vy);
      }

      // paddle hits
      if (ball.vx < 0 && ball.x - ball.r < 24 && ball.y > player.y && ball.y < player.y + padH) {
        ball.x = 24 + ball.r;
        const hit = (ball.y - (player.y + padH / 2)) / (padH / 2);
        const sp = Math.min(560, Math.hypot(ball.vx, ball.vy) * 1.05);
        ball.vx = Math.abs(sp * 0.8);
        ball.vy = hit * sp * 0.7;
        rally++;
        if (rally % 5 === 0) ctx.hud.toast(`RALLY x${rally}`);
        ctx.audio.sfx('blip');
      } else if (
        ball.vx > 0 &&
        ball.x + ball.r > W - 24 &&
        ball.y > cpu.y &&
        ball.y < cpu.y + padH
      ) {
        ball.x = W - 24 - ball.r;
        const hit = (ball.y - (cpu.y + padH / 2)) / (padH / 2);
        const sp = Math.min(560, Math.hypot(ball.vx, ball.vy) * 1.05);
        ball.vx = -Math.abs(sp * 0.8);
        ball.vy = hit * sp * 0.7;
        rally++;
        ctx.audio.sfx('blip');
      }

      if (ball.x < -20) point(false);
      else if (ball.x > W + 20) point(true);
      draw();
    },
    destroy() {
      offPtr();
      layer.destroy({ children: true });
    },
  };
}
