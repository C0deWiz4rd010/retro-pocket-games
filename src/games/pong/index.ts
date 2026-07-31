import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import { clamp } from '@utils/math';

type PowerKind = 'grow' | 'shrinkcpu' | 'slow';
interface Capsule { x: number; y: number; kind: PowerKind; vy: number }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: number }

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const basePadH = 70;
  const padW = 10;
  const player = { y: H / 2 - basePadH / 2, h: basePadH, vy: 0, prevY: H / 2 - basePadH / 2 };
  const cpu = { y: H / 2 - basePadH / 2, h: basePadH };
  const ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 7 };
  let pScore = 0;
  let cScore = 0;
  let over = false;
  let rally = 0;
  let bestRally = 0;
  let overdrive = false;
  let shake = 0;
  let growT = 0;
  let shrinkT = 0;
  let slowT = 0;
  let capsuleTimer = 3;
  const trail: { x: number; y: number }[] = [];
  const capsules: Capsule[] = [];
  const sparks: Spark[] = [];
  const WIN = 11;

  const POWER: Record<PowerKind, { color: number; label: string }> = {
    grow: { color: 0x3ddc84, label: 'PADDLE+' },
    shrinkcpu: { color: 0xffd200, label: 'CPU-' },
    slow: { color: 0x42a5f5, label: 'SLOW BALL' },
  };

  const serve = (toPlayer: boolean): void => {
    ball.x = W / 2;
    ball.y = H / 2;
    const speed = 300;
    ball.vx = (toPlayer ? -1 : 1) * speed;
    ball.vy = (ctx.rng.next() * 2 - 1) * speed * 0.5;
    overdrive = false;
  };
  serve(ctx.rng.next() < 0.5);

  const setLabel = (): void => ctx.hud.setLabel(`YOU ${pScore} : ${cScore} CPU`);
  ctx.hud.setScore(0);
  setLabel();

  const offPtr = ctx.input.on('pointermove', ({ y }) => {
    player.y = clamp(y - player.h / 2, 0, H - player.h);
  });

  const burst = (x: number, y: number, color: number, n = 8): void => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ctx.rng.next();
      const s = 60 + ctx.rng.next() * 120;
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, color });
    }
  };

  const draw = (): void => {
    g.clear();
    // net
    for (let y = 0; y < H; y += 24) g.rect(W / 2 - 1, y, 2, 12).fill({ color: 0xffffff, alpha: 0.3 });
    // score pips
    for (let i = 0; i < WIN; i++) {
      g.circle(W / 2 - 90 + i * 8, 14, 3).fill({ color: i < pScore ? 0x00f7ff : 0xffffff, alpha: i < pScore ? 1 : 0.15 });
      g.circle(W / 2 + 18 + i * 8, 14, 3).fill({ color: i < cScore ? 0xff2e97 : 0xffffff, alpha: i < cScore ? 1 : 0.15 });
    }
    // capsules
    for (const c of capsules) {
      const col = POWER[c.kind].color;
      g.roundRect(c.x - 9, c.y - 6, 18, 12, 4).fill({ color: col, alpha: 0.85 });
      g.roundRect(c.x - 9, c.y - 6, 18, 12, 4).stroke({ width: 1.5, color: 0xffffff, alpha: 0.6 });
    }
    // trail
    trail.forEach((t, i) =>
      g
        .circle(t.x, t.y, ball.r * (0.3 + (i / trail.length) * 0.6))
        .fill({ color: overdrive ? 0xff4d4d : 0x00f7ff, alpha: (i / trail.length) * 0.45 }),
    );
    // paddles (glow if buffed)
    const pGlow = growT > 0;
    g.roundRect(14, player.y, padW, player.h, 4).fill({ color: pGlow ? 0x9bffce : 0x00f7ff });
    if (pGlow) g.roundRect(12, player.y - 2, padW + 4, player.h + 4, 5).stroke({ width: 2, color: 0x3ddc84, alpha: 0.6 });
    g.roundRect(W - 14 - padW, cpu.y, padW, cpu.h, 4).fill({ color: 0xff2e97 });
    // ball
    if (overdrive) g.circle(ball.x, ball.y, ball.r + 4).fill({ color: 0xff4d4d, alpha: 0.4 });
    g.circle(ball.x, ball.y, ball.r).fill({ color: overdrive ? 0xffd6d6 : 0xffffff });
    // sparks
    for (const s of sparks) g.circle(s.x, s.y, 3 * s.life).fill({ color: s.color, alpha: s.life });
  };

  const point = (player1: boolean): void => {
    if (player1) pScore++;
    else cScore++;
    bestRally = Math.max(bestRally, rally);
    rally = 0;
    trail.length = 0;
    capsules.length = 0;
    growT = shrinkT = slowT = 0;
    player.h = cpu.h = basePadH;
    shake = 0.4;
    burst(player1 ? W - 20 : 20, ball.y, player1 ? 0x00f7ff : 0xff2e97, 14);
    ctx.hud.setScore(pScore);
    setLabel();
    ctx.audio.sfx(player1 ? 'coin' : 'hit');
    if (pScore >= WIN || cScore >= WIN) {
      over = true;
      ctx.gameOver(pScore * 100 + (pScore > cScore ? 500 : 0) + bestRally * 10, {
        won: pScore > cScore ? 1 : 0,
        rally: bestRally,
      });
      return;
    }
    serve(!player1);
  };

  const collect = (kind: PowerKind): void => {
    if (kind === 'grow') {
      growT = 8;
      player.h = basePadH + 34;
    } else if (kind === 'shrinkcpu') {
      shrinkT = 8;
      cpu.h = basePadH - 26;
    } else {
      slowT = 6;
    }
    ctx.audio.sfx('powerup');
    ctx.hud.toast(POWER[kind].label);
  };

  return {
    update(dt) {
      if (over) return;

      // timers
      if (growT > 0 && (growT -= dt) <= 0) player.h = basePadH;
      if (shrinkT > 0 && (shrinkT -= dt) <= 0) cpu.h = basePadH;
      if (slowT > 0) slowT -= dt;
      if (shake > 0) shake = Math.max(0, shake - dt * 2);

      const ax = ctx.input.axis().y;
      if (ax) player.y = clamp(player.y + ax * 420 * dt, 0, H - player.h);
      player.vy = (player.y - player.prevY) / Math.max(dt, 1e-4);
      player.prevY = player.y;

      // CPU AI: track ball with capped speed + slight lag; faster as player scores more
      const target = ball.y - cpu.h / 2;
      const cpuSpeed = 200 + Math.min(pScore, 8) * 15;
      cpu.y += clamp(target - cpu.y, -cpuSpeed * dt, cpuSpeed * dt);
      cpu.y = clamp(cpu.y, 0, H - cpu.h);

      const speedMul = slowT > 0 ? 0.62 : 1;
      ball.x += ball.vx * dt * speedMul;
      ball.y += ball.vy * dt * speedMul;
      trail.push({ x: ball.x, y: ball.y });
      if (trail.length > 8) trail.shift();
      if (ball.y < ball.r) {
        ball.y = ball.r;
        ball.vy = Math.abs(ball.vy);
      } else if (ball.y > H - ball.r) {
        ball.y = H - ball.r;
        ball.vy = -Math.abs(ball.vy);
      }

      // capsule spawn + motion
      capsuleTimer -= dt;
      if (capsuleTimer <= 0 && capsules.length < 2) {
        capsuleTimer = 4 + ctx.rng.next() * 3;
        const kinds: PowerKind[] = ['grow', 'shrinkcpu', 'slow'];
        capsules.push({
          x: W / 2 + (ctx.rng.next() * 80 - 40),
          y: 40 + ctx.rng.next() * (H - 80),
          kind: kinds[Math.floor(ctx.rng.next() * kinds.length)]!,
          vy: ctx.rng.next() < 0.5 ? 40 : -40,
        });
      }
      for (let i = capsules.length - 1; i >= 0; i--) {
        const c = capsules[i]!;
        c.y += c.vy * dt;
        if (c.y < 24 || c.y > H - 24) c.vy *= -1;
        if (Math.abs(c.x - ball.x) < 12 + ball.r && Math.abs(c.y - ball.y) < 9 + ball.r) {
          collect(c.kind);
          burst(c.x, c.y, POWER[c.kind].color, 10);
          capsules.splice(i, 1);
        }
      }

      // paddle hits
      const onHit = (paddleY: number, h: number, paddleVy: number, dir: 1 | -1, edge: number): void => {
        ball.x = edge;
        const hit = (ball.y - (paddleY + h / 2)) / (h / 2);
        const sp = Math.min(overdrive ? 720 : 580, Math.hypot(ball.vx, ball.vy) * 1.06);
        ball.vx = dir * Math.abs(sp * 0.8);
        ball.vy = hit * sp * 0.7 + paddleVy * 0.22; // Feature: spin from paddle motion
        rally++;
        if (rally >= 6 && !overdrive) {
          overdrive = true;
          ctx.hud.toast('OVERDRIVE!');
          ctx.audio.sfx('powerup');
        }
        if (rally % 5 === 0) ctx.hud.toast(`RALLY x${rally}`);
        shake = overdrive ? 0.35 : 0.18;
        burst(ball.x, ball.y, dir > 0 ? 0x00f7ff : 0xff2e97, 6);
        ctx.audio.sfx('blip');
      };

      if (ball.vx < 0 && ball.x - ball.r < 24 && ball.y > player.y && ball.y < player.y + player.h) {
        onHit(player.y, player.h, player.vy, 1, 24 + ball.r);
      } else if (ball.vx > 0 && ball.x + ball.r > W - 24 && ball.y > cpu.y && ball.y < cpu.y + cpu.h) {
        onHit(cpu.y, cpu.h, 0, -1, W - 24 - ball.r);
      }

      if (ball.x < -20) point(false);
      else if (ball.x > W + 20) point(true);

      // sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]!;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= dt * 2;
        if (s.life <= 0) sparks.splice(i, 1);
      }

      // screen shake
      const rmS = document.documentElement.classList.contains('a11y-reduced-motion') ? 0 : shake;
      layer.position.set(
        rmS > 0 ? (ctx.rng.next() * 2 - 1) * rmS * 10 : 0,
        rmS > 0 ? (ctx.rng.next() * 2 - 1) * rmS * 10 : 0,
      );

      draw();
    },
    destroy() {
      offPtr();
      layer.destroy({ children: true });
    },
  };
}
