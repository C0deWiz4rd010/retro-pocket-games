import type { Game, GameContext } from '@core/types';
import { burst, clamp, drawSparks, updateSparks } from '@kits/arcade/juice';
import { CYAN, PINK, GOLD, GREEN, WHITE, makeLayer, backdrop } from '@kits/arcade/concept';

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const { layer, g, sparks } = makeLayer(ctx);
  const lanes = [W * 0.28, W * 0.5, W * 0.72];
  const items: {
    x: number;
    lane: number;
    kind: 'car' | 'coin' | 'boost' | 'shield';
    phase: number;
    scored?: boolean;
  }[] = [];
  let target = 1;
  let px = lanes[1]!;
  let speed = 235;
  let score = 0;
  let lives = 3;
  let boost = 0;
  let combo = 0;
  let comboTimer = 0;
  let spawn = 0;
  let t = 0;
  let over = false;
  let shieldHits = 0; // Feature: shield pickup absorbs one crash
  let gear = 1; // Feature: gear multiplier rises with distance
  let slowmo = 0; // Feature: near-miss slow-motion reward
  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('SHIFT LANES');
  const move = (d: -1 | 1): void => {
    target = clamp(target + d, 0, 2);
    ctx.audio.sfx('blip');
  };
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'left') move(-1);
    if (a === 'right') move(1);
    if (a === 'a' || a === 'up') boost = Math.max(boost, 0.45);
  });
  const offSwipe = ctx.input.on('swipe', (d) => {
    if (d === 'left') move(-1);
    if (d === 'right') move(1);
  });

  const spawnItem = (): void => {
    const r = ctx.rng.next();
    const kind = r > 0.94 ? 'shield' : r > 0.84 ? 'boost' : r > 0.56 ? 'coin' : 'car';
    items.push({ x: W + 35, lane: ctx.rng.int(0, 2), kind, phase: ctx.rng.next() * 9 });
  };

  function draw(): void {
    g.clear();
    backdrop(g, W, H, t, H * 0.42);
    g.moveTo(W * 0.32, H * 0.32)
      .lineTo(W * 0.68, H * 0.32)
      .lineTo(W - 24, H - 60)
      .lineTo(24, H - 60)
      .closePath()
      .fill({ color: 0x090a18, alpha: 0.94 })
      .stroke({ width: 2, color: CYAN, alpha: 0.35 });
    for (let i = 0; i < 22; i++) {
      const y = H * 0.34 + ((i * 42 + t * speed * (boost > 0 ? 1.8 : 1)) % (H * 0.58));
      const scale = (y - H * 0.32) / (H * 0.62);
      g.rect(W / 2 - 2, y, 4, 12 + scale * 26).fill({ color: WHITE, alpha: 0.08 + scale * 0.22 });
    }
    for (const item of items) {
      const y = lanes[item.lane]!;
      if (item.kind === 'coin') {
        g.circle(item.x, y + Math.sin(t * 8 + item.phase) * 4, 11).fill({ color: GOLD });
      } else if (item.kind === 'boost') {
        g.circle(item.x, y, 13).stroke({ width: 4, color: GREEN });
        g.rect(item.x - 4, y - 9, 8, 18).fill({ color: GREEN, alpha: 0.8 });
      } else if (item.kind === 'shield') {
        g.circle(item.x, y, 13).stroke({ width: 4, color: CYAN });
        g.circle(item.x, y, 6).fill({ color: CYAN, alpha: 0.8 });
      } else {
        g.roundRect(item.x - 17, y - 23, 34, 46, 7).fill({ color: PINK });
        g.rect(item.x - 10, y - 12, 20, 16).fill({ color: 0x160716, alpha: 0.65 });
        g.circle(item.x - 8, y + 22, 4).fill({ color: GOLD });
        g.circle(item.x + 8, y + 22, 4).fill({ color: GOLD });
      }
    }
    const y = lanes[target]!;
    if (shieldHits > 0)
      g.circle(px, y, 34 + Math.sin(t * 8) * 2).stroke({ width: 2, color: CYAN, alpha: 0.6 });
    g.roundRect(px - 16, y - 26, 32, 52, 8).fill({ color: boost > 0 ? GOLD : CYAN });
    g.roundRect(px - 9, y - 15, 18, 22, 6).fill({ color: 0x060817, alpha: 0.7 });
    g.circle(px - 10, y + 25, 4).fill({ color: PINK });
    g.circle(px + 10, y + 25, 4).fill({ color: PINK });
    if (boost > 0) g.rect(px - 10, y + 30, 20, 32).fill({ color: GOLD, alpha: 0.28 });
    drawSparks(g, sparks);
  }

  return {
    update(dt) {
      if (over) return;
      t += dt;
      updateSparks(sparks, dt);
      speed += dt * 4;
      boost = Math.max(0, boost - dt);
      slowmo = Math.max(0, slowmo - dt);
      comboTimer = Math.max(0, comboTimer - dt);
      if (comboTimer <= 0) combo = 0;
      // Feature: gear multiplier rises with distance
      const newGear = 1 + Math.floor(score / 6000);
      if (newGear > gear) {
        gear = newGear;
        ctx.hud.toast(`GEAR ${gear} · x${gear}`);
        ctx.audio.sfx('powerup');
      }
      px += (lanes[target]! - px) * Math.min(1, dt * 14);
      spawn -= dt;
      if (spawn <= 0) {
        spawn = Math.max(0.42, 0.9 - score / 15000);
        spawnItem();
      }
      const slowFactor = slowmo > 0 ? 0.45 : 1;
      const mult = boost > 0 ? 1.85 : 1;
      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i]!;
        item.x -= speed * mult * slowFactor * dt;
        if (item.x < -40) {
          items.splice(i, 1);
          continue;
        }
        if (Math.abs(item.x - px) < 27 && item.lane === target) {
          if (item.kind === 'car') {
            items.splice(i, 1);
            ctx.fx.screenShake(7, 0.16);
            if (shieldHits > 0) {
              shieldHits--;
              ctx.audio.sfx('powerup');
              ctx.hud.toast('SHIELD BLOCKED');
              burst(sparks, ctx.rng, px, lanes[target]!, CYAN, 16, 140);
            } else {
              combo = 0;
              lives--;
              ctx.hud.setLives(lives);
              ctx.audio.sfx('hit');
              if (lives <= 0) {
                over = true;
                ctx.gameOver(score, { speed: Math.round(speed), gear });
              }
            }
          } else {
            items.splice(i, 1);
            combo++;
            comboTimer = 2.4;
            const pts = ((item.kind === 'coin' ? 95 : 180) + combo * 12) * gear;
            score += pts;
            if (item.kind === 'boost') boost = 4;
            if (item.kind === 'shield') {
              shieldHits = 1;
              ctx.hud.toast('SHIELD');
            }
            if (combo >= 4) ctx.fx.floatingText(`COMBO x${combo}`, px, lanes[target]! - 36, GOLD);
            ctx.audio.sfx(item.kind === 'coin' ? 'coin' : 'powerup');
            burst(
              sparks,
              ctx.rng,
              px,
              lanes[target]!,
              item.kind === 'coin' ? GOLD : item.kind === 'shield' ? CYAN : GREEN,
              14,
              140,
            );
          }
        } else if (
          item.kind === 'car' &&
          !item.scored &&
          Math.abs(item.x - px) < 18 &&
          Math.abs(item.lane - target) === 1
        ) {
          item.scored = true;
          combo++;
          comboTimer = 2.4;
          slowmo = 0.5; // Feature: near-miss slow-motion reward
          score += ((boost > 0 ? 110 : 55) + combo * 10) * gear;
          ctx.fx.floatingText('NEAR MISS', px, lanes[target]! - 34, CYAN);
          burst(sparks, ctx.rng, px, lanes[target]!, CYAN, 7, 80);
        }
      }
      score += Math.floor(dt * 24 * mult * gear);
      ctx.hud.setScore(score);
      ctx.hud.setLabel(
        slowmo > 0
          ? 'NEAR MISS!'
          : boost > 0
            ? `BOOST ${Math.ceil(boost)}`
            : shieldHits > 0
              ? `SHIELD · GEAR ${gear}`
              : `GEAR ${gear}`,
      );
      draw();
    },
    destroy() {
      offDown();
      offSwipe();
      layer.destroy({ children: true });
    },
  };
}
