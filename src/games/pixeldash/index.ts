import type { Game, GameContext } from '@core/types';
import { burst, drawSparks, updateSparks } from '@kits/arcade/juice';
import {
  CYAN,
  PINK,
  GOLD,
  BLUE,
  VIOLET,
  WHITE,
  makeLayer,
  backdrop,
  city,
  boxHit,
} from '@kits/arcade/concept';

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const ground = H - 74;
  const { layer, g, sparks } = makeLayer(ctx);
  const runner = { x: W * 0.22, y: ground, vy: 0, duck: false };
  const obstacles: {
    x: number;
    y: number;
    w: number;
    h: number;
    kind: 'spike' | 'block' | 'drone';
  }[] = [];
  const coins: { x: number; y: number; hit: boolean }[] = [];
  // Feature: floating shield / magnet pickups
  const pickups: { x: number; y: number; kind: 'shield' | 'magnet' }[] = [];
  let t = 0;
  let score = 0;
  let lives = 3;
  let invuln = 0;
  let jumpsLeft = 2;
  let dash = 0;
  let dashCd = 0;
  let speed = 255;
  let spawn = 0.4;
  let over = false;
  let shieldHits = 0; // Feature: shield absorbs a hit
  let magnet = 0; // Feature: magnet attracts coins
  let zone = 1; // Feature: distance zones with a rising multiplier

  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('DOUBLE JUMP');

  const jump = (): void => {
    if (jumpsLeft > 0) {
      runner.vy = -790;
      jumpsLeft--;
      ctx.audio.sfx('jump');
      burst(sparks, ctx.rng, runner.x - 10, runner.y, jumpsLeft === 1 ? CYAN : GOLD, 8, 70);
    }
  };
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a' || a === 'up') jump();
    if ((a === 'b' || a === 'right') && dashCd <= 0) {
      dash = 0.42;
      dashCd = 2.6;
      ctx.hud.toast('DASH!');
      ctx.audio.sfx('powerup');
      burst(sparks, ctx.rng, runner.x - 16, runner.y - 22, GOLD, 16, 140);
    }
    if (a === 'down') runner.duck = true;
  });
  const offUp = ctx.input.on('up', (a) => {
    if (a === 'down') runner.duck = false;
  });
  const offTap = ctx.input.on('tap', jump);

  const spawnSet = (): void => {
    const kind = ctx.rng.pick(['spike', 'block', 'drone'] as const);
    const h = kind === 'drone' ? 18 : kind === 'spike' ? 24 : 34;
    const y = kind === 'drone' ? ground - 78 : ground - h + 8;
    obstacles.push({ x: W + 20, y, w: kind === 'spike' ? 26 : 30, h, kind });
    const arcY = kind === 'drone' ? ground - 118 : ground - 52;
    for (let i = 0; i < 3; i++)
      coins.push({ x: W + 86 + i * 24, y: arcY - Math.sin(i / 2) * 22, hit: false });
    if (ctx.rng.next() < 0.2)
      pickups.push({
        x: W + 140,
        y: ground - 70 - ctx.rng.next() * 50,
        kind: ctx.rng.next() < 0.5 ? 'shield' : 'magnet',
      });
  };
  spawnSet();

  function draw(): void {
    g.clear();
    backdrop(g, W, H, t, ground + 10);
    city(g, W, H, t);
    g.rect(0, ground + 8, W, H - ground).fill({ color: 0x0d1020 });
    g.rect(0, ground + 8, W, 3).fill({ color: PINK });
    for (const c of coins) {
      if (c.hit) continue;
      const p = 1 + Math.sin(t * 7 + c.x) * 0.14;
      g.circle(c.x, c.y, 7 * p).fill({ color: GOLD });
      g.circle(c.x - 2, c.y - 2, 2).fill({ color: WHITE, alpha: 0.7 });
    }
    for (const o of obstacles) {
      if (o.kind === 'spike') {
        g.moveTo(o.x, o.y + o.h)
          .lineTo(o.x + o.w / 2, o.y)
          .lineTo(o.x + o.w, o.y + o.h)
          .closePath()
          .fill({ color: PINK })
          .stroke({ width: 2, color: WHITE, alpha: 0.28 });
      } else if (o.kind === 'drone') {
        g.roundRect(o.x, o.y, o.w, o.h, 5).fill({ color: VIOLET });
        g.circle(o.x + 6, o.y + o.h + 4, 4).fill({ color: CYAN });
        g.circle(o.x + o.w - 6, o.y + o.h + 4, 4).fill({ color: CYAN });
      } else {
        g.roundRect(o.x, o.y, o.w, o.h, 4).fill({ color: 0xff7b00 });
        g.rect(o.x + 5, o.y + 6, o.w - 10, 4).fill({ color: GOLD, alpha: 0.65 });
      }
    }
    for (const pk of pickups) {
      if (pk.kind === 'shield') {
        g.circle(pk.x, pk.y, 12).stroke({ width: 3, color: CYAN });
        g.circle(pk.x, pk.y, 5).fill({ color: CYAN, alpha: 0.8 });
      } else {
        g.roundRect(pk.x - 9, pk.y - 9, 18, 18, 4).fill({ color: VIOLET });
        g.rect(pk.x - 9, pk.y - 3, 18, 6).fill({ color: 0x160716, alpha: 0.6 });
      }
    }
    const rh = runner.duck && runner.y >= ground - 1 ? 26 : 42;
    const rx = runner.x - 13;
    const ry = runner.y - rh;
    if (shieldHits > 0 || magnet > 0)
      g.circle(runner.x, runner.y - rh / 2, rh * 0.7).stroke({
        width: 2,
        color: shieldHits > 0 ? CYAN : VIOLET,
        alpha: 0.5 + Math.sin(t * 8) * 0.2,
      });
    g.roundRect(rx, ry, 26, rh, 5).fill({
      color: invuln > 0 && Math.floor(t * 18) % 2 === 0 ? GOLD : 0xff7043,
    });
    g.roundRect(rx + 6, ry + 6, 18, 12, 4).fill({ color: 0xffd1a8 });
    g.rect(rx + 18, ry + 10, 4, 4).fill({ color: 0x101018 });
    const leg = Math.sin(t * 16) * 5;
    if (dash > 0) {
      g.roundRect(rx - 34, ry + 6, 28, rh - 6, 5).fill({ color: GOLD, alpha: 0.24 });
      g.roundRect(rx - 58, ry + 12, 20, rh - 16, 5).fill({ color: CYAN, alpha: 0.16 });
    }
    g.rect(rx + 3, runner.y, 6, 10 + leg).fill({ color: BLUE });
    g.rect(rx + 16, runner.y, 6, 10 - leg).fill({ color: BLUE });
    drawSparks(g, sparks);
  }

  return {
    update(dt) {
      if (over) return;
      t += dt;
      updateSparks(sparks, dt);
      invuln = Math.max(0, invuln - dt);
      dash = Math.max(0, dash - dt);
      dashCd = Math.max(0, dashCd - dt);
      magnet = Math.max(0, magnet - dt);
      speed += dt * 7;
      const runMult = (dash > 0 ? 1.55 : 1) * zone; // zone multiplier
      score += Math.floor(dt * 22 * runMult);
      // Feature: distance zones
      const newZone = 1 + Math.floor(score / 4000);
      if (newZone > zone) {
        zone = newZone;
        ctx.hud.toast(`ZONE ${zone} · x${zone}`);
        ctx.audio.sfx('powerup');
      }
      runner.vy += 2200 * dt;
      runner.y = Math.min(ground, runner.y + runner.vy * dt);
      if (runner.y >= ground) {
        runner.vy = 0;
        jumpsLeft = 2;
      }
      spawn -= dt;
      if (spawn <= 0) {
        spawn = Math.max(0.62, 1.1 - score / 12000) + ctx.rng.next() * 0.35;
        spawnSet();
      }
      const scrollV = speed * (dash > 0 ? 1.55 : 1);
      for (const o of obstacles) o.x -= scrollV * dt;
      for (const c of coins) c.x -= scrollV * dt;
      for (const pk of pickups) pk.x -= scrollV * dt;
      const rh = runner.duck && runner.y >= ground - 1 ? 26 : 42;
      // Feature: magnet pulls nearby coins toward the runner
      if (magnet > 0) {
        for (const c of coins) {
          if (c.hit) continue;
          if (Math.hypot(c.x - runner.x, c.y - (runner.y - rh / 2)) < 150) {
            c.x += (runner.x - c.x) * Math.min(1, dt * 8);
            c.y += (runner.y - rh / 2 - c.y) * Math.min(1, dt * 8);
          }
        }
      }
      for (const c of coins) {
        if (!c.hit && Math.hypot(c.x - runner.x, c.y - (runner.y - rh / 2)) < 20) {
          c.hit = true;
          score += 90;
          ctx.audio.sfx('coin');
          burst(sparks, ctx.rng, c.x, c.y, GOLD, 10, 110);
        }
      }
      // pickup collection
      for (let i = pickups.length - 1; i >= 0; i--) {
        const pk = pickups[i]!;
        if (Math.hypot(pk.x - runner.x, pk.y - (runner.y - rh / 2)) < 24) {
          pickups.splice(i, 1);
          if (pk.kind === 'shield') {
            shieldHits = 1;
            ctx.hud.toast('SHIELD');
          } else {
            magnet = 6;
            ctx.hud.toast('MAGNET');
          }
          ctx.audio.sfx('powerup');
          burst(
            sparks,
            ctx.rng,
            runner.x,
            runner.y - rh / 2,
            pk.kind === 'shield' ? CYAN : VIOLET,
            14,
            120,
          );
        } else if (pk.x < -40) pickups.splice(i, 1);
      }
      for (const o of obstacles) {
        if (invuln <= 0 && boxHit(runner.x - 12, runner.y - rh, 24, rh, o.x, o.y, o.w, o.h)) {
          o.x = -80;
          invuln = 1.15;
          ctx.fx.screenShake(8, 0.18);
          if (shieldHits > 0) {
            // Feature: shield absorbs the hit instead of losing a life
            shieldHits--;
            ctx.audio.sfx('powerup');
            ctx.hud.toast('SHIELD BLOCKED');
            burst(sparks, ctx.rng, runner.x, runner.y - rh / 2, CYAN, 18, 150);
            continue;
          }
          lives--;
          ctx.hud.setLives(lives);
          ctx.audio.sfx('hit');
          burst(sparks, ctx.rng, runner.x, runner.y - rh / 2, PINK, 18, 150);
          if (lives <= 0) {
            over = true;
            ctx.audio.sfx('explosion');
            ctx.gameOver(score, { speed: Math.round(speed), zone });
          }
        }
      }
      ctx.hud.setScore(score);
      ctx.hud.setLabel(
        magnet > 0
          ? `MAGNET ${Math.ceil(magnet)}`
          : shieldHits > 0
            ? 'SHIELD READY'
            : dash > 0
              ? 'DASH RUN'
              : `ZONE ${zone}`,
      );
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
