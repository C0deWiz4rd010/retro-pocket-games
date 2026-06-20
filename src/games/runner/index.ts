import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

interface Obstacle {
  x: number;
  w: number;
  h: number;
  air: boolean;
}

interface Coin {
  x: number;
  y: number;
  collected: boolean;
}

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const groundY = H - 80;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const GRAV = 2200;
  const JUMP = -780;

  const runner = { x: W * 0.22, y: groundY, vy: 0, h: 34, ducking: false };
  let obstacles: Obstacle[] = [];
  let coins: Coin[] = [];
  const powerups: { x: number; y: number }[] = []; // Feature: shield power-up
  let coinPulse = 0;
  let speed = 280;
  let dist = 0;
  let bonus = 0;
  let spawnX = W;
  let over = false;
  let legPhase = 0;
  let jumpsLeft = 2; // Feature: double jump
  let shield = false;
  let invuln = 0;
  let combo = 0; // Feature: coin combo multiplier
  let comboTimer = 0;

  ctx.hud.setScore(0);
  ctx.hud.setLabel('JUMP = A (x2)');

  const onGround = (): boolean => runner.y >= groundY - 0.5;

  const jump = (): void => {
    if (jumpsLeft > 0) {
      runner.vy = JUMP * (jumpsLeft === 2 ? 1 : 0.85);
      jumpsLeft--;
      ctx.audio.sfx('jump');
    }
  };
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a' || a === 'up') jump();
    else if (a === 'down') runner.ducking = true;
  });
  const offUp = ctx.input.on('up', (a) => {
    if (a === 'down') runner.ducking = false;
  });
  const offTap = ctx.input.on('tap', jump);

  const spawn = (): void => {
    const air = ctx.rng.next() < 0.3;
    obstacles.push({ x: spawnX, w: 16 + ctx.rng.next() * 16, h: air ? 24 : 26 + ctx.rng.next() * 24, air });
    // spawn a coin cluster ~60% of the time, between obstacles
    if (ctx.rng.next() < 0.6) {
      const cy = groundY - 40 - (air ? 0 : ctx.rng.next() * 20);
      const count = 1 + Math.floor(ctx.rng.next() * 3);
      for (let i = 0; i < count; i++) coins.push({ x: spawnX + 60 + i * 22, y: cy, collected: false });
    }
    if (!shield && ctx.rng.next() < 0.08) powerups.push({ x: spawnX + 90, y: groundY - 60 - ctx.rng.next() * 30 });
  };
  spawn();

  const draw = (): void => {
    g.clear();
    g.rect(0, groundY + 18, W, H - groundY).fill({ color: 0x1a2a1a });
    g.rect(0, groundY + 18, W, 3).fill({ color: 0x9ccc65 });
    // coins
    for (const c of coins) {
      if (c.collected) continue;
      const pulse = 0.9 + 0.1 * Math.sin(coinPulse * 6 + c.x);
      g.circle(c.x, c.y, 7 * pulse).fill({ color: 0xffd200 });
      g.circle(c.x, c.y, 4 * pulse).fill({ color: 0xfff6b0 });
    }
    // power-ups
    for (const p of powerups) { g.circle(p.x, p.y, 11).stroke({ width: 3, color: 0x3ddc84 }); g.circle(p.x, p.y, 5).fill({ color: 0x3ddc84 }); }
    // runner
    const h = runner.ducking && onGround() ? runner.h * 0.5 : runner.h;
    const ry = runner.y - h;
    if (shield || invuln > 0) g.circle(runner.x, runner.y - h / 2, h * 0.8).stroke({ width: 2, color: 0x3ddc84, alpha: 0.6 });
    g.roundRect(runner.x - 10, ry, 20, h, 4).fill({ color: 0x9ccc65 });
    // legs
    if (onGround()) {
      const lp = Math.sin(legPhase) * 6;
      g.rect(runner.x - 8, runner.y, 5, 8 + lp).fill({ color: 0x9ccc65 });
      g.rect(runner.x + 3, runner.y, 5, 8 - lp).fill({ color: 0x9ccc65 });
    }
    obstacles.forEach((o) => {
      const y = o.air ? groundY - 50 : groundY - o.h + 18;
      g.roundRect(o.x, y, o.w, o.h, 3).fill({ color: 0xff4d4d });
    });
  };

  return {
    update(dt) {
      if (over) return;
      legPhase += dt * 14;
      coinPulse += dt;
      speed += dt * 6;
      dist += speed * dt;
      if (invuln > 0) invuln -= dt;
      if (comboTimer > 0) comboTimer -= dt; else combo = 0;
      ctx.hud.setScore(Math.floor(dist / 10) + bonus);

      runner.vy += GRAV * dt;
      runner.y += runner.vy * dt;
      if (runner.y > groundY) {
        runner.y = groundY;
        runner.vy = 0;
        jumpsLeft = 2; // reset double jump on landing
      }

      obstacles.forEach((o) => (o.x -= speed * dt));
      coins.forEach((c) => (c.x -= speed * dt));
      powerups.forEach((p) => (p.x -= speed * dt));
      spawnX = W + 20;
      const last = obstacles[obstacles.length - 1];
      if (!last || last.x < W - (140 + ctx.rng.next() * 160)) spawn();
      obstacles = obstacles.filter((o) => o.x > -40);
      coins = coins.filter((c) => c.x > -20);

      // collect coins (Feature: combo multiplier)
      for (const c of coins) {
        if (c.collected) continue;
        if (Math.abs(runner.x - c.x) < 14 && Math.abs((runner.y - runner.h / 2) - c.y) < 18) {
          c.collected = true;
          combo++;
          comboTimer = 1.6;
          const mult = 1 + Math.floor(combo / 5);
          bonus += 20 * mult;
          if (combo >= 5 && combo % 5 === 0) ctx.fx.floatingText(`COMBO x${mult}`, runner.x, runner.y - 50, 0xffd200);
          ctx.audio.sfx('coin');
        }
      }
      // power-up pickups
      for (let i = powerups.length - 1; i >= 0; i--) {
        const p = powerups[i]!;
        if (p.x < -20) { powerups.splice(i, 1); continue; }
        if (Math.abs(runner.x - p.x) < 16 && Math.abs((runner.y - runner.h / 2) - p.y) < 24) {
          powerups.splice(i, 1);
          shield = true;
          ctx.hud.toast('SHIELD');
          ctx.audio.sfx('powerup');
        }
      }

      const rh = runner.ducking && onGround() ? runner.h * 0.5 : runner.h;
      for (const o of obstacles) {
        const oy = o.air ? groundY - 50 : groundY - o.h + 18;
        const oh = o.h;
        if (
          runner.x + 10 > o.x &&
          runner.x - 10 < o.x + o.w &&
          runner.y > oy &&
          runner.y - rh < oy + oh
        ) {
          if (shield && invuln <= 0) {
            shield = false;
            invuln = 1;
            o.x = -999;
            combo = 0;
            ctx.audio.sfx('powerup');
            ctx.fx.screenShake(6, 0.14);
            break;
          }
          if (invuln > 0) continue;
          over = true;
          ctx.audio.sfx('explosion');
          ctx.gameOver(Math.floor(dist / 10) + bonus, { dist: Math.floor(dist) });
          return;
        }
      }
      draw();
    },
    destroy() {
      offDown();
      offUp();
      offTap();
      layer.destroy({ children: true });
    },
  };
}
