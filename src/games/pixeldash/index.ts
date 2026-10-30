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
  const ceilY = ground - 206; // the tunnel's ceiling: gravity can pin you to either surface
  const { layer, g, sparks } = makeLayer(ctx);
  // y is the foot position: on the floor the body extends up from it, on the ceiling it hangs down.
  const runner = { x: W * 0.22, y: ground, vy: 0, duck: false };
  let gs = 1; // gravity sign: 1 = floor, -1 = ceiling
  let flipCd = 0;
  const obstacles: {
    x: number;
    y: number;
    w: number;
    h: number;
    kind: 'spike' | 'block' | 'drone';
    side: 1 | -1; // 1 = stands on the floor, -1 = hangs from the ceiling
  }[] = [];
  const coins: { x: number; y: number; hit: boolean }[] = [];
  // Feature: floating shield / magnet pickups
  const pickups: { x: number; y: number; kind: 'shield' | 'magnet' }[] = [];
  let t = 0;
  let score = 0;
  let lives = 3;
  let invuln = 0;
  let jumpsLeft = 2;
  let speed = 255;
  let spawn = 0.4;
  let over = false;
  let shieldHits = 0; // Feature: shield absorbs a hit
  let magnet = 0; // Feature: magnet attracts coins
  let zone = 1; // Feature: distance zones with a rising multiplier

  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('B FLIPS GRAVITY');

  const bodyH = (): number => (runner.duck && gs > 0 && runner.y >= ground - 1 ? 26 : 42);
  /** Switch gravity. The body keeps its centre, so the flip reads as a smooth turn-over. */
  const flip = (): void => {
    if (flipCd > 0) return;
    const rh = bodyH();
    const cy = gs > 0 ? runner.y - rh / 2 : runner.y + rh / 2;
    gs = gs > 0 ? -1 : 1;
    runner.y = gs > 0 ? cy + rh / 2 : cy - rh / 2;
    runner.vy = gs * 120;
    flipCd = 0.3;
    jumpsLeft = Math.max(jumpsLeft, 1);
    ctx.audio.sfx('powerup');
    burst(sparks, ctx.rng, runner.x, cy, VIOLET, 14, 130);
  };
  const jump = (): void => {
    if (jumpsLeft > 0) {
      runner.vy = -790 * gs;
      jumpsLeft--;
      ctx.audio.sfx('jump');
      burst(sparks, ctx.rng, runner.x - 10, runner.y, jumpsLeft === 1 ? CYAN : GOLD, 8, 70);
    }
  };
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a' || a === 'up') jump();
    if (a === 'b' || a === 'right') flip();
    if (a === 'down') runner.duck = true;
  });
  const offUp = ctx.input.on('up', (a) => {
    if (a === 'down') runner.duck = false;
  });
  const offTap = ctx.input.on('tap', jump);

  const spawnSet = (): void => {
    const side: 1 | -1 = ctx.rng.next() < 0.5 ? 1 : -1;
    const kind = ctx.rng.pick(['spike', 'block', 'drone'] as const);
    const h = kind === 'drone' ? 18 : kind === 'spike' ? 24 : 34;
    // floor hazards sit on the floor; ceiling hazards hang from the ceiling; drones float mid-air
    const y =
      kind === 'drone'
        ? (ground + ceilY) / 2 - h / 2 + (side > 0 ? 40 : -40)
        : side > 0
          ? ground - h + 8
          : ceilY - 8;
    obstacles.push({ x: W + 20, y, w: kind === 'spike' ? 26 : 30, h, kind, side });
    // coins sit on the surface the player should be flipping to
    const arcY = side > 0 ? ceilY + 56 : ground - 56;
    for (let i = 0; i < 3; i++)
      coins.push({ x: W + 86 + i * 24, y: arcY + Math.sin(i / 2) * 18, hit: false });
    if (ctx.rng.next() < 0.2)
      pickups.push({
        x: W + 140,
        y: (ground + ceilY) / 2 + (ctx.rng.next() - 0.5) * 90,
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
    // tunnel ceiling with a hazard-stripe rail
    g.rect(0, 0, W, ceilY).fill({ color: 0x0b0e1c, alpha: 0.93 });
    g.rect(0, ceilY - 3, W, 3).fill({ color: VIOLET });
    for (let x = -((t * 120) % 28); x < W; x += 28)
      g.poly([x, ceilY - 10, x + 14, ceilY - 10, x + 22, ceilY - 3, x + 8, ceilY - 3]).fill({
        color: GOLD,
        alpha: 0.25,
      });
    for (const c of coins) {
      if (c.hit) continue;
      const p = 1 + Math.sin(t * 7 + c.x) * 0.14;
      g.circle(c.x, c.y, 7 * p).fill({ color: GOLD });
      g.circle(c.x - 2, c.y - 2, 2).fill({ color: WHITE, alpha: 0.7 });
    }
    for (const o of obstacles) {
      if (o.kind === 'spike') {
        // spikes point away from the surface they are attached to
        const tipY = o.side > 0 ? o.y : o.y + o.h;
        const baseY = o.side > 0 ? o.y + o.h : o.y;
        g.moveTo(o.x, baseY)
          .lineTo(o.x + o.w / 2, tipY)
          .lineTo(o.x + o.w, baseY)
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
    const rh = bodyH();
    const rx = runner.x - 13;
    const ry = gs > 0 ? runner.y - rh : runner.y;
    if (shieldHits > 0 || magnet > 0)
      g.circle(runner.x, ry + rh / 2, rh * 0.7).stroke({
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
    // legs stick out on the side that touches the surface
    const legY = gs > 0 ? runner.y : runner.y - (10 + Math.abs(leg));
    g.rect(rx + 3, legY, 6, 10 + leg * gs).fill({ color: BLUE });
    g.rect(rx + 16, legY, 6, 10 - leg * gs).fill({ color: BLUE });
    if (flipCd > 0.18)
      g.circle(runner.x, ry + rh / 2, 26 * (flipCd / 0.3)).stroke({
        width: 2,
        color: VIOLET,
        alpha: 0.7,
      });
    drawSparks(g, sparks);
  }

  return {
    update(dt) {
      if (over) return;
      t += dt;
      updateSparks(sparks, dt);
      invuln = Math.max(0, invuln - dt);
      flipCd = Math.max(0, flipCd - dt);
      magnet = Math.max(0, magnet - dt);
      speed += dt * 7;
      const runMult = zone; // zone multiplier
      score += Math.floor(dt * 22 * runMult);
      // Feature: distance zones
      const newZone = 1 + Math.floor(score / 4000);
      if (newZone > zone) {
        zone = newZone;
        ctx.hud.toast(`ZONE ${zone} · x${zone}`);
        ctx.audio.sfx('powerup');
      }
      runner.vy += 2200 * dt * gs;
      runner.y += runner.vy * dt;
      if (gs > 0) {
        if (runner.y >= ground) {
          runner.y = ground;
          runner.vy = 0;
          jumpsLeft = 2;
        } else if (runner.y - bodyH() < ceilY) {
          runner.y = ceilY + bodyH();
          runner.vy = Math.max(0, runner.vy);
        }
      } else {
        if (runner.y <= ceilY) {
          runner.y = ceilY;
          runner.vy = 0;
          jumpsLeft = 2;
        } else if (runner.y + bodyH() > ground) {
          runner.y = ground - bodyH();
          runner.vy = Math.min(0, runner.vy);
        }
      }
      spawn -= dt;
      if (spawn <= 0) {
        spawn = Math.max(0.62, 1.1 - score / 12000) + ctx.rng.next() * 0.35;
        spawnSet();
      }
      const scrollV = speed;
      for (const o of obstacles) o.x -= scrollV * dt;
      for (const c of coins) c.x -= scrollV * dt;
      for (const pk of pickups) pk.x -= scrollV * dt;
      const rh = bodyH();
      const cy = gs > 0 ? runner.y - rh / 2 : runner.y + rh / 2; // body centre
      // Feature: magnet pulls nearby coins toward the runner
      if (magnet > 0) {
        for (const c of coins) {
          if (c.hit) continue;
          if (Math.hypot(c.x - runner.x, c.y - cy) < 150) {
            c.x += (runner.x - c.x) * Math.min(1, dt * 8);
            c.y += (cy - c.y) * Math.min(1, dt * 8);
          }
        }
      }
      for (const c of coins) {
        if (!c.hit && Math.hypot(c.x - runner.x, c.y - cy) < 20) {
          c.hit = true;
          score += 90;
          ctx.audio.sfx('coin');
          burst(sparks, ctx.rng, c.x, c.y, GOLD, 10, 110);
        }
      }
      // pickup collection
      for (let i = pickups.length - 1; i >= 0; i--) {
        const pk = pickups[i]!;
        if (Math.hypot(pk.x - runner.x, pk.y - cy) < 24) {
          pickups.splice(i, 1);
          if (pk.kind === 'shield') {
            shieldHits = 1;
            ctx.hud.toast('SHIELD');
          } else {
            magnet = 6;
            ctx.hud.toast('MAGNET');
          }
          ctx.audio.sfx('powerup');
          burst(sparks, ctx.rng, runner.x, cy, pk.kind === 'shield' ? CYAN : VIOLET, 14, 120);
        } else if (pk.x < -40) pickups.splice(i, 1);
      }
      for (const o of obstacles) {
        if (invuln <= 0 && boxHit(runner.x - 12, cy - rh / 2, 24, rh, o.x, o.y, o.w, o.h)) {
          o.x = -80;
          invuln = 1.15;
          ctx.fx.screenShake(8, 0.18);
          if (shieldHits > 0) {
            // Feature: shield absorbs the hit instead of losing a life
            shieldHits--;
            ctx.audio.sfx('powerup');
            ctx.hud.toast('SHIELD BLOCKED');
            burst(sparks, ctx.rng, runner.x, cy, CYAN, 18, 150);
            continue;
          }
          lives--;
          ctx.hud.setLives(lives);
          ctx.audio.sfx('hit');
          burst(sparks, ctx.rng, runner.x, cy, PINK, 18, 150);
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
            : gs < 0
              ? `ZONE ${zone} · CEILING`
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
