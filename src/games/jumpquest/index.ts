import type { Game, GameContext } from '@core/types';
import { burst, drawSparks, updateSparks } from '@kits/arcade/juice';
import { CYAN, PINK, GOLD, GREEN, WHITE, makeLayer, backdrop } from '@kits/arcade/concept';

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const { layer, g, sparks } = makeLayer(ctx);
  const player = { x: W * 0.2, y: H - 120, vx: 0, vy: 0, grounded: false };
  const plats: {
    x: number;
    y: number;
    w: number;
    moving: boolean;
    vx: number;
    spring: boolean;
    breakable: boolean;
    broken: number;
  }[] = [];
  const gems: { x: number; y: number; hit: boolean }[] = [];
  const enemies: { x: number; y: number; dir: number }[] = [];
  // Feature: jetpack / shield pickups
  const pickups: { x: number; y: number; kind: 'jet' | 'shield' }[] = [];
  let cam = 0;
  let top = H - 80;
  let score = 0;
  let t = 0;
  let over = false;
  let jet = 0; // Feature: jetpack boost
  let shield = 0; // Feature: shield absorbs one enemy hit
  ctx.hud.setScore(0);
  ctx.hud.setLabel('CLIMB');
  for (let y = H - 64; y > -1200; y -= 76) {
    const x = 28 + ctx.rng.next() * (W - 96);
    const moving = ctx.rng.next() < 0.26;
    const breakable = !moving && ctx.rng.next() < 0.18; // Feature: crumbling platforms
    plats.push({
      x,
      y,
      w: 62 + ctx.rng.next() * 34,
      moving,
      vx: moving ? ctx.rng.pick([-55, 55]) : 0,
      spring: !breakable && ctx.rng.next() < 0.16,
      breakable,
      broken: 0,
    });
    if (ctx.rng.next() < 0.56)
      gems.push({ x: x + 20 + ctx.rng.next() * 34, y: y - 22, hit: false });
    if (ctx.rng.next() < 0.18) enemies.push({ x: x + 16, y: y - 20, dir: ctx.rng.pick([-1, 1]) });
    if (ctx.rng.next() < 0.1)
      pickups.push({ x: x + 30, y: y - 30, kind: ctx.rng.next() < 0.5 ? 'jet' : 'shield' });
  }
  const jump = (): void => {
    if (player.grounded) {
      player.vy = -720;
      player.grounded = false;
      ctx.audio.sfx('jump');
    }
  };
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a' || a === 'up') jump();
  });
  const offTap = ctx.input.on('tap', jump);
  function draw(): void {
    g.clear();
    backdrop(g, W, H, t, H * 0.7);
    for (const p of plats) {
      const y = p.y - cam;
      if (y < -30 || y > H + 30) continue;
      const col = p.breakable ? 0xff7b00 : p.moving ? CYAN : GREEN;
      const alpha = p.breakable && p.broken > 0 ? Math.max(0.15, p.broken) : 1;
      g.roundRect(p.x, y, p.w, 14, 5).fill({ color: col, alpha });
      g.rect(p.x + 8, y + 3, p.w - 16, 2).fill({ color: WHITE, alpha: 0.26 });
      if (p.spring) g.rect(p.x + p.w / 2 - 10, y - 4, 20, 5).fill({ color: GOLD });
    }
    for (const pk of pickups) {
      const y = pk.y - cam;
      if (y < -20 || y > H + 20) continue;
      if (pk.kind === 'jet') {
        g.roundRect(pk.x - 7, y - 9, 14, 18, 3).fill({ color: PINK });
        g.poly([pk.x - 4, y + 9, pk.x + 4, y + 9, pk.x, y + 15]).fill({ color: GOLD });
      } else {
        g.circle(pk.x, y, 10).stroke({ width: 3, color: CYAN });
        g.circle(pk.x, y, 4).fill({ color: CYAN, alpha: 0.8 });
      }
    }
    for (const gem of gems) {
      if (gem.hit) continue;
      const y = gem.y - cam;
      g.moveTo(gem.x, y - 9)
        .lineTo(gem.x + 9, y)
        .lineTo(gem.x, y + 9)
        .lineTo(gem.x - 9, y)
        .closePath()
        .fill({ color: GOLD });
    }
    for (const e of enemies) {
      g.roundRect(e.x - 12, e.y - cam - 10, 24, 20, 5).fill({ color: PINK });
      g.circle(e.x - 5, e.y - cam - 2, 2).fill({ color: WHITE });
      g.circle(e.x + 5, e.y - cam - 2, 2).fill({ color: WHITE });
    }
    const py = player.y - cam;
    if (shield > 0) g.circle(player.x, py - 12, 26).stroke({ width: 2, color: CYAN, alpha: 0.6 });
    if (jet > 0)
      g.poly([
        player.x - 6,
        py + 4,
        player.x + 6,
        py + 4,
        player.x,
        py + 14 + Math.sin(t * 30) * 4,
      ]).fill({ color: GOLD });
    g.roundRect(player.x - 12, py - 28, 24, 32, 6).fill({ color: jet > 0 ? GOLD : 0x7dd3fc });
    g.roundRect(player.x - 8, py - 22, 16, 12, 4).fill({ color: 0xffd1a8 });
    drawSparks(g, sparks);
  }
  return {
    update(dt) {
      if (over) return;
      t += dt;
      updateSparks(sparks, dt);
      player.vx = ctx.input.axis().x * 235;
      jet = Math.max(0, jet - dt);
      if (jet > 0)
        player.vy = -640; // Feature: jetpack thrust
      else player.vy += 1700 * dt;
      player.x += player.vx * dt;
      if (player.x < -12) player.x = W + 12;
      if (player.x > W + 12) player.x = -12;
      player.y += player.vy * dt;
      player.grounded = false;
      for (const p of plats) {
        if (p.moving) {
          p.x += p.vx * dt;
          if (p.x < 8 || p.x + p.w > W - 8) p.vx *= -1;
        }
        // Feature: crumbling platforms collapse after being stood on
        if (p.breakable && p.broken > 0) {
          p.broken -= dt * 1.5;
          if (p.broken <= 0) {
            p.y = 99999;
            continue;
          }
        }
        if (
          jet <= 0 &&
          player.vy > 0 &&
          player.x > p.x &&
          player.x < p.x + p.w &&
          player.y > p.y - 4 &&
          player.y < p.y + 18
        ) {
          player.y = p.y - 2;
          if (p.spring) {
            player.vy = -860;
            score += 60;
            ctx.audio.sfx('powerup');
            ctx.fx.floatingText('SPRING', player.x, player.y - cam - 24, GOLD);
            burst(sparks, ctx.rng, player.x, player.y - cam, GOLD, 10, 110);
          } else {
            player.vy = 0;
            if (p.breakable && p.broken <= 0) {
              p.broken = 1;
              ctx.audio.sfx('blip');
            }
          }
          player.grounded = true;
        }
      }
      // pickup collection
      for (let i = pickups.length - 1; i >= 0; i--) {
        const pk = pickups[i]!;
        if (Math.hypot(pk.x - player.x, pk.y - (player.y - 12)) < 22) {
          pickups.splice(i, 1);
          if (pk.kind === 'jet') {
            jet = 1.4;
            ctx.hud.toast('JETPACK!');
          } else {
            shield = 1;
            ctx.hud.toast('SHIELD');
          }
          ctx.audio.sfx('powerup');
          burst(
            sparks,
            ctx.rng,
            player.x,
            player.y - cam,
            pk.kind === 'jet' ? GOLD : CYAN,
            12,
            120,
          );
        }
      }
      for (const gem of gems) {
        if (!gem.hit && Math.hypot(gem.x - player.x, gem.y - (player.y - 18)) < 20) {
          gem.hit = true;
          score += 120;
          ctx.audio.sfx('coin');
          burst(sparks, ctx.rng, gem.x, gem.y - cam, GOLD, 9, 100);
        }
      }
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i]!;
        e.x += e.dir * 35 * dt;
        if (e.x < 18 || e.x > W - 18) e.dir *= -1;
        if (Math.abs(e.x - player.x) < 22 && Math.abs(e.y - player.y) < 26) {
          if (jet > 0 || (player.vy > 80 && player.y < e.y - 4)) {
            enemies.splice(i, 1);
            if (jet <= 0) player.vy = -520;
            score += 220;
            ctx.audio.sfx('explosion');
            ctx.fx.floatingText('+220', e.x, e.y - cam - 18, GOLD);
            burst(sparks, ctx.rng, e.x, e.y - cam, PINK, 13, 110);
          } else if (shield > 0) {
            shield = 0;
            enemies.splice(i, 1);
            player.vy = -520;
            ctx.audio.sfx('powerup');
            ctx.hud.toast('SHIELD BLOCKED');
            burst(sparks, ctx.rng, e.x, e.y - cam, CYAN, 14, 120);
          } else {
            over = true;
            ctx.fx.screenShake(8, 0.16);
            ctx.gameOver(score, { height: Math.max(0, Math.round((H - top) / 10)) });
          }
        }
      }
      if (player.y < top) {
        top = player.y;
        score += 1;
      }
      cam += (player.y - H * 0.46 - cam) * Math.min(1, dt * 4);
      if (player.y - cam > H + 40) {
        over = true;
        ctx.gameOver(score);
      }
      ctx.hud.setScore(score);
      ctx.hud.setLabel(jet > 0 ? `JETPACK ${jet.toFixed(1)}` : shield > 0 ? 'SHIELD' : 'CLIMB');
      draw();
    },
    destroy() {
      offDown();
      offTap();
      layer.destroy({ children: true });
    },
  };
}
