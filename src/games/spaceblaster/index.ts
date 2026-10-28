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
  const player = { x: W / 2, y: H - 64, cd: 0 };
  const bullets: { x: number; y: number; vx: number; vy: number; color: number }[] = [];
  const enemies: {
    x: number;
    y: number;
    hp: number;
    kind: 'bug' | 'rock' | 'saucer';
    phase: number;
  }[] = [];
  const eBullets: { x: number; y: number; vx: number; vy: number }[] = []; // Feature: enemy fire
  const drops: { x: number; y: number; kind: 'rapid' | 'bomb' }[] = []; // Feature: power-up drops
  let score = 0;
  let lives = 3;
  let shield = 0;
  let spawn = 0;
  let t = 0;
  let over = false;
  let rapid = 0; // Feature: rapid-fire power-up
  let streak = 0; // Feature: kill streak multiplier
  let eFire = 0;
  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('A LASER / B SPREAD');
  const fire = (spread = false): void => {
    if (player.cd > 0) return;
    player.cd = (spread ? 0.3 : 0.16) * (rapid > 0 ? 0.5 : 1);
    bullets.push({ x: player.x, y: player.y - 18, vx: 0, vy: -580, color: CYAN });
    if (spread) {
      bullets.push({ x: player.x - 9, y: player.y - 12, vx: -150, vy: -520, color: GOLD });
      bullets.push({ x: player.x + 9, y: player.y - 12, vx: 150, vy: -520, color: GOLD });
    }
    ctx.audio.sfx('shoot');
  };
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a') fire();
    if (a === 'b') fire(true);
  });
  const offTap = ctx.input.on('tap', () => fire());

  const spawnEnemy = (): void => {
    const kind = ctx.rng.pick(['bug', 'rock', 'saucer'] as const);
    enemies.push({
      x: 28 + ctx.rng.next() * (W - 56),
      y: -30,
      hp: kind === 'rock' ? 3 : kind === 'saucer' ? 2 : 1,
      kind,
      phase: ctx.rng.next() * 9,
    });
  };

  function draw(): void {
    g.clear();
    backdrop(g, W, H, t, H * 0.7);
    for (const e of enemies) {
      if (e.kind === 'rock') {
        g.moveTo(e.x - 16, e.y)
          .lineTo(e.x - 4, e.y - 15)
          .lineTo(e.x + 16, e.y - 7)
          .lineTo(e.x + 12, e.y + 15)
          .lineTo(e.x - 14, e.y + 13)
          .closePath()
          .fill({ color: 0x8fa3b8 })
          .stroke({ width: 2, color: WHITE, alpha: 0.25 });
      } else if (e.kind === 'saucer') {
        g.roundRect(e.x - 22, e.y - 8, 44, 16, 8).fill({ color: PINK });
        g.circle(e.x, e.y - 9, 10).fill({ color: VIOLET });
      } else {
        g.roundRect(e.x - 14, e.y - 10, 28, 20, 5).fill({ color: GREEN });
        g.rect(e.x - 18, e.y - 3, 36, 5).fill({ color: GREEN, alpha: 0.65 });
      }
    }
    for (const b of bullets) g.rect(b.x - 2, b.y - 9, 4, 16).fill({ color: b.color });
    for (const b of eBullets) g.rect(b.x - 2, b.y - 6, 4, 12).fill({ color: 0xff4d4d });
    for (const d of drops) {
      g.roundRect(d.x - 8, d.y - 8, 16, 16, 4).fill({ color: d.kind === 'rapid' ? GOLD : PINK });
      g.rect(d.x - 8, d.y - 2, 16, 4).fill({ color: 0x160716, alpha: 0.6 });
    }
    if (shield > 0)
      g.circle(player.x, player.y, 30 + Math.sin(t * 10) * 2).stroke({
        width: 3,
        color: CYAN,
        alpha: 0.75,
      });
    g.moveTo(player.x, player.y - 28)
      .lineTo(player.x + 20, player.y + 18)
      .lineTo(player.x, player.y + 8)
      .lineTo(player.x - 20, player.y + 18)
      .closePath()
      .fill({ color: CYAN });
    g.circle(player.x, player.y, 6).fill({ color: WHITE, alpha: 0.7 });
    drawSparks(g, sparks);
  }

  return {
    update(dt) {
      if (over) return;
      t += dt;
      updateSparks(sparks, dt);
      player.cd = Math.max(0, player.cd - dt);
      shield = Math.max(0, shield - dt);
      rapid = Math.max(0, rapid - dt);
      const ax = ctx.input.axis().x;
      player.x = clamp(player.x + ax * 310 * dt, 24, W - 24);
      if (ctx.input.isDown('b')) fire(true);
      else if (ctx.input.isDown('a')) fire();
      spawn -= dt;
      if (spawn <= 0) {
        spawn = Math.max(0.34, 0.8 - score / 16000);
        spawnEnemy();
      }
      // Feature: enemies fire back at the player
      eFire -= dt;
      if (eFire <= 0 && enemies.length) {
        eFire = Math.max(0.5, 1.4 - score / 20000);
        const shooter = enemies[ctx.rng.int(0, enemies.length - 1)]!;
        if (shooter.y > 0 && shooter.y < H * 0.7) {
          const ang = Math.atan2(player.y - shooter.y, player.x - shooter.x);
          eBullets.push({
            x: shooter.x,
            y: shooter.y,
            vx: Math.cos(ang) * 200,
            vy: Math.sin(ang) * 200 + 80,
          });
          ctx.audio.sfx('blip');
        }
      }
      for (let i = eBullets.length - 1; i >= 0; i--) {
        const b = eBullets[i]!;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.y > H + 20 || b.x < -20 || b.x > W + 20) {
          eBullets.splice(i, 1);
          continue;
        }
        if (boxHit(b.x - 3, b.y - 6, 6, 12, player.x - 16, player.y - 24, 32, 40)) {
          eBullets.splice(i, 1);
          ctx.fx.screenShake(7, 0.14);
          if (shield > 0) {
            shield = 0;
            ctx.audio.sfx('hit');
          } else {
            lives--;
            streak = 0;
            ctx.hud.setLives(lives);
            ctx.audio.sfx('hit');
            if (lives <= 0) {
              over = true;
              ctx.gameOver(score);
              return;
            }
          }
        }
      }
      // Feature: power-up drops fall and are collected
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]!;
        d.y += 120 * dt;
        if (d.y > H + 20) {
          drops.splice(i, 1);
          continue;
        }
        if (Math.abs(d.x - player.x) < 24 && Math.abs(d.y - player.y) < 28) {
          drops.splice(i, 1);
          if (d.kind === 'rapid') {
            rapid = 7;
            ctx.hud.toast('RAPID FIRE');
          } else {
            ctx.hud.toast('SMART BOMB!');
            ctx.fx.screenShake(10, 0.25);
            for (const e of enemies) {
              score += 50;
              burst(sparks, ctx.rng, e.x, e.y, GOLD, 8, 110);
            }
            enemies.length = 0;
            eBullets.length = 0;
          }
          ctx.audio.sfx('powerup');
        }
      }
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i]!;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.y < -20) bullets.splice(i, 1);
      }
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i]!;
        e.y += Math.min(75 + score * 0.014, 230) * dt;
        e.x += Math.sin(t * 2 + e.phase) * (e.kind === 'saucer' ? 80 : 22) * dt;
        if (e.y > H + 30) {
          enemies.splice(i, 1);
          if (shield > 0) {
            shield = 0;
            ctx.audio.sfx('hit');
            ctx.fx.screenShake(4, 0.1);
          } else {
            lives--;
            streak = 0;
            ctx.hud.setLives(lives);
          }
          if (lives <= 0) {
            over = true;
            ctx.gameOver(score);
            return;
          }
          continue;
        }
        if (boxHit(player.x - 16, player.y - 24, 32, 40, e.x - 18, e.y - 16, 36, 32)) {
          enemies.splice(i, 1);
          if (shield > 0) {
            shield = 0;
            ctx.audio.sfx('hit');
            burst(sparks, ctx.rng, player.x, player.y, CYAN, 18, 150);
          } else {
            lives--;
            streak = 0;
            ctx.hud.setLives(lives);
          }
          ctx.fx.screenShake(8, 0.16);
          if (lives <= 0) {
            over = true;
            ctx.gameOver(score);
            return;
          }
          continue;
        }
        for (let j = bullets.length - 1; j >= 0; j--) {
          const b = bullets[j]!;
          if (boxHit(b.x - 3, b.y - 9, 6, 18, e.x - 20, e.y - 18, 40, 36)) {
            bullets.splice(j, 1);
            e.hp--;
            burst(sparks, ctx.rng, e.x, e.y, e.kind === 'rock' ? WHITE : PINK, 8, 90);
            if (e.hp <= 0) {
              enemies.splice(i, 1);
              streak++;
              const mult = 1 + Math.floor(streak / 5);
              score += (e.kind === 'rock' ? 80 : e.kind === 'saucer' ? 160 : 60) * mult;
              if (streak > 0 && streak % 5 === 0)
                ctx.fx.floatingText(`STREAK x${streak} (${mult}x)`, e.x, e.y - 16, GOLD);
              if (e.kind === 'saucer') {
                shield = 5;
                ctx.hud.toast('SHIELD READY');
              }
              // Feature: drop a power-up
              if (ctx.rng.next() < 0.16)
                drops.push({ x: e.x, y: e.y, kind: ctx.rng.next() < 0.6 ? 'rapid' : 'bomb' });
              ctx.audio.sfx('explosion');
            } else ctx.audio.sfx('hit');
            break;
          }
        }
      }
      ctx.hud.setScore(score);
      ctx.hud.setLabel(
        rapid > 0
          ? `RAPID ${Math.ceil(rapid)}`
          : streak >= 5
            ? `STREAK x${streak}`
            : shield > 0
              ? `SHIELD ${Math.ceil(shield)}`
              : 'A LASER / B SPREAD',
      );
      draw();
    },
    destroy() {
      offDown();
      offTap();
      layer.destroy({ children: true });
    },
  };
}
