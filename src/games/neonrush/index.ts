import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action } from '@core/InputManager';
import { burst, clamp, drawBackdrop, drawSparks, type Spark, updateSparks } from '@games/_shared/juice';

type Hazard = { x: number; lane: number; kind: 'block' | 'coin' | 'shield' | 'magnet'; wobble: number };

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  const g = new Graphics();
  layer.addChild(g);
  ctx.stage.addChild(layer);

  const lanes = [W * 0.28, W * 0.5, W * 0.72];
  const roadTop = 88;
  const roadBottom = H - 84;
  const sparks: Spark[] = [];
  const hazards: Hazard[] = [];
  let lane = 1;
  let targetLane = 1;
  let px = lanes[lane]!;
  let score = 0;
  let lives = 3;
  let combo = 0;
  let shield = 0;
  let magnet = 0; // Feature: magnet auto-collects coins
  let zone = 1; // Feature: zone score multiplier
  let spawn = 0;
  let speed = 185;
  let t = 0;
  let over = false;

  ctx.hud.setScore(score);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('NEON RUN');

  const spawnHazard = (): void => {
    const roll = ctx.rng.next();
    hazards.push({
      x: W + 28,
      lane: ctx.rng.int(0, 2),
      kind: roll > 0.93 ? 'magnet' : roll > 0.84 ? 'shield' : roll > 0.6 ? 'coin' : 'block',
      wobble: ctx.rng.next() * Math.PI * 2,
    });
  };

  const move = (dir: -1 | 1): void => {
    targetLane = clamp(targetLane + dir, 0, 2);
    ctx.audio.sfx('blip');
  };

  const offDown = ctx.input.on('down', (a: Action) => {
    if (over) return;
    if (a === 'left') move(-1);
    else if (a === 'right') move(1);
    else if (a === 'a' || a === 'up') shield = Math.max(shield, 0.18);
  });
  const offSwipe = ctx.input.on('swipe', (d) => {
    if (d === 'left') move(-1);
    if (d === 'right') move(1);
  });

  function draw(): void {
    g.clear();
    drawBackdrop(g, W, H, t, 0x16316e, 0x050511);
    g.roundRect(W * 0.16, roadTop, W * 0.68, roadBottom - roadTop, 18)
      .fill({ color: 0x090a1a, alpha: 0.88 })
      .stroke({ width: 2, color: 0x00f7ff, alpha: 0.28 });
    for (const x of lanes) {
      g.rect(x - 1, roadTop, 2, roadBottom - roadTop).fill({ color: 0xffffff, alpha: 0.08 });
      for (let y = roadTop + ((t * speed) % 48); y < roadBottom; y += 48) {
        g.roundRect(x - 2, y, 4, 18, 2).fill({ color: 0x00f7ff, alpha: 0.35 });
      }
    }
    for (const h of hazards) {
      const y = lanes[h.lane]!;
      if (h.kind === 'block') {
        g.roundRect(h.x - 15, y - 18, 30, 36, 6).fill({ color: 0xff2d75 }).stroke({ width: 2, color: 0xffffff, alpha: 0.25 });
        g.rect(h.x - 9, y - 4, 18, 8).fill({ color: 0x240012, alpha: 0.55 });
      } else if (h.kind === 'coin') {
        g.circle(h.x, y + Math.sin(t * 7 + h.wobble) * 4, 12).fill({ color: 0xffd200 });
        g.circle(h.x, y + Math.sin(t * 7 + h.wobble) * 4, 6).fill({ color: 0x5c3b00, alpha: 0.35 });
      } else if (h.kind === 'shield') {
        g.circle(h.x, y, 13).fill({ color: 0x3ddc84 });
        g.circle(h.x, y, 7).fill({ color: 0x07160d });
      } else {
        g.roundRect(h.x - 11, y - 11, 22, 22, 4).fill({ color: 0xc084fc });
        g.rect(h.x - 11, y - 4, 22, 8).fill({ color: 0x1a0730, alpha: 0.6 });
      }
    }
    const py = lanes[lane]!;
    g.roundRect(px - 16, py - 22, 32, 44, 8).fill({ color: shield > 0 ? 0x93c5fd : 0x00f7ff });
    g.roundRect(px - 8, py - 14, 16, 18, 5).fill({ color: 0x070715, alpha: 0.7 });
    g.circle(px - 8, py + 19, 4).fill({ color: 0xff80ab });
    g.circle(px + 8, py + 19, 4).fill({ color: 0xff80ab });
    if (shield > 0) g.circle(px, py, 28).stroke({ width: 3, color: 0x93c5fd, alpha: 0.55 + Math.sin(t * 18) * 0.18 });
    if (magnet > 0) g.circle(px, py, 34).stroke({ width: 2, color: 0xc084fc, alpha: 0.5 + Math.sin(t * 12) * 0.2 });
    drawSparks(g, sparks);
  }

  return {
    update(dt) {
      if (over) return;
      t += dt;
      updateSparks(sparks, dt);
      lane += (targetLane - lane) * Math.min(1, dt * 12);
      px += (lanes[targetLane]! - px) * Math.min(1, dt * 14);
      shield = Math.max(0, shield - dt);
      magnet = Math.max(0, magnet - dt);
      speed += dt * 3.8;
      // Feature: zone multiplier rises with score
      const nz = 1 + Math.floor(score / 4000);
      if (nz > zone) { zone = nz; ctx.hud.toast(`ZONE ${zone} · x${zone}`); ctx.audio.sfx('powerup'); }
      spawn -= dt;
      if (spawn <= 0) {
        spawn = Math.max(0.36, 0.86 - score / 9000);
        spawnHazard();
      }
      const playerY = lanes[targetLane]!;
      for (let i = hazards.length - 1; i >= 0; i--) {
        const h = hazards[i]!;
        h.x -= speed * dt;
        const hy = lanes[h.lane]!;
        if (h.x < -40) {
          hazards.splice(i, 1);
          if (h.kind === 'block') score += 8;
          continue;
        }
        // Feature: magnet auto-collects coins in any lane
        if (magnet > 0 && h.kind === 'coin' && Math.abs(h.x - px) < 46) {
          hazards.splice(i, 1);
          const pts = (60 + combo * 8) * zone;
          score += pts;
          combo++;
          ctx.audio.sfx('coin');
          burst(sparks, ctx.rng, h.x, hy, 0xffd200, 8, 90);
          continue;
        }
        if (Math.abs(h.x - px) < 25 && Math.abs(hy - playerY) < 26) {
          hazards.splice(i, 1);
          if (h.kind === 'block') {
            if (shield > 0) {
              score += 80;
              combo++;
              ctx.audio.sfx('powerup');
              burst(sparks, ctx.rng, px, playerY, 0x93c5fd, 18, 150);
            } else {
              lives--;
              combo = 0;
              ctx.hud.setLives(lives);
              ctx.audio.sfx('hit');
              ctx.fx.screenShake(6, 0.14);
              if (lives <= 0) {
                over = true;
                ctx.gameOver(score, { combo, speed: Math.round(speed) });
              }
            }
          } else {
            const pts = (h.kind === 'coin' ? 60 + combo * 8 : 120) * zone;
            score += pts;
            combo++;
            if (h.kind === 'shield') shield = 4;
            if (h.kind === 'magnet') { magnet = 7; ctx.hud.toast('MAGNET'); }
            const col = h.kind === 'coin' ? 0xffd200 : h.kind === 'magnet' ? 0xc084fc : 0x3ddc84;
            ctx.fx.floatingText(`+${pts}`, px, playerY - 32, col);
            ctx.audio.sfx(h.kind === 'coin' ? 'coin' : 'powerup');
            burst(sparks, ctx.rng, px, playerY, col);
          }
        }
      }
      score += Math.floor(dt * 18 * zone);
      ctx.hud.setScore(score);
      ctx.hud.setLabel(magnet > 0 ? `MAGNET ${Math.ceil(magnet)}` : shield > 0 ? `SHIELD ${Math.ceil(shield)}` : `COMBO ${combo} · Z${zone}`);
      draw();
    },
    destroy() {
      offDown();
      offSwipe();
      layer.destroy({ children: true });
    },
  };
}

