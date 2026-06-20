import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import { clamp } from '@utils/math';

interface Meteor {
  x: number;
  y: number;
  r: number;
  vy: number;
  near?: boolean;
}
interface Pickup { x: number; y: number; vy: number; kind: 'shield' | 'slow' | 'coin' }

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const player = { x: W / 2, y: H - 50, r: 12 };
  let meteors: Meteor[] = [];
  let pickups: Pickup[] = []; // Feature: power-ups + coins
  const stars: { x: number; y: number; s: number }[] = [];
  for (let i = 0; i < 40; i++) stars.push({ x: ctx.rng.next() * W, y: ctx.rng.next() * H, s: ctx.rng.next() * 2 + 0.5 });
  let score = 0;
  let bonus = 0;
  let elapsed = 0;
  let spawnAcc = 0;
  let pickAcc = 0;
  let shield = false; // Feature: shield absorbs one hit
  let slowT = 0; // Feature: slow-motion
  let over = false;

  ctx.hud.setScore(0);
  ctx.hud.setLabel('DODGE!');

  const offPtr = ctx.input.on('pointermove', ({ x }) => {
    player.x = clamp(x, player.r, W - player.r);
  });

  const draw = (): void => {
    g.clear();
    stars.forEach((s) => g.circle(s.x, s.y, s.s).fill({ color: 0xffffff, alpha: 0.4 }));
    meteors.forEach((m) => {
      g.circle(m.x, m.y, m.r).fill({ color: 0xff7043 });
      g.circle(m.x - m.r * 0.3, m.y - m.r * 0.3, m.r * 0.4).fill({ color: 0xffd200, alpha: 0.6 });
    });
    pickups.forEach((p) => {
      const col = p.kind === 'shield' ? 0x3ddc84 : p.kind === 'slow' ? 0x00f7ff : 0xffd200;
      if (p.kind === 'coin') g.circle(p.x, p.y, 9).fill({ color: col });
      else { g.roundRect(p.x - 9, p.y - 9, 18, 18, 4).fill({ color: col }); g.roundRect(p.x - 9, p.y - 3, 18, 6, 2).fill({ color: 0x05060f, alpha: 0.5 }); }
    });
    if (slowT > 0) g.rect(0, 0, W, H).fill({ color: 0x00f7ff, alpha: 0.05 });
    if (shield) g.circle(player.x, player.y, player.r + 8).stroke({ width: 2, color: 0x3ddc84, alpha: 0.6 + Math.sin(elapsed * 10) * 0.2 });
    g.poly([player.x, player.y - player.r, player.x - player.r, player.y + player.r, player.x + player.r, player.y + player.r]).fill({ color: 0x00f7ff });
  };

  return {
    update(dt) {
      if (over) return;
      elapsed += dt;
      if (slowT > 0) slowT -= dt;
      score = Math.floor(elapsed * 10) + bonus;
      ctx.hud.setScore(score);

      const ax = ctx.input.axis().x;
      if (ax) player.x = clamp(player.x + ax * 320 * dt, player.r, W - player.r);

      stars.forEach((s) => {
        s.y += s.s * 30 * dt;
        if (s.y > H) s.y = 0;
      });

      const slow = slowT > 0 ? 0.45 : 1;
      spawnAcc += dt;
      const rate = Math.max(0.2, 0.7 - elapsed * 0.01);
      if (spawnAcc >= rate) {
        spawnAcc = 0;
        const r = 8 + ctx.rng.next() * 16;
        meteors.push({ x: ctx.rng.next() * W, y: -r, r, vy: 120 + ctx.rng.next() * 120 + elapsed * 4 });
      }
      // spawn pickups + coins
      pickAcc += dt;
      if (pickAcc >= 2.4) {
        pickAcc = 0;
        const roll = ctx.rng.next();
        const kind: Pickup['kind'] = roll > 0.8 ? 'shield' : roll > 0.6 ? 'slow' : 'coin';
        pickups.push({ x: 20 + ctx.rng.next() * (W - 40), y: -16, vy: 120, kind });
      }

      for (const m of meteors) {
        m.y += m.vy * slow * dt;
        const d = Math.hypot(m.x - player.x, m.y - player.y);
        if (d < m.r + player.r * 0.7) {
          if (shield) { shield = false; m.y = H + 99; ctx.audio.sfx('powerup'); ctx.fx.screenShake(5, 0.12); continue; }
          over = true;
          ctx.audio.sfx('explosion');
          ctx.gameOver(score, { time: Math.floor(elapsed) });
          return;
        }
        // Feature: near-miss bonus
        if (!m.near && d < m.r + player.r + 14 && m.y > player.y - 10) {
          m.near = true;
          bonus += 25;
          ctx.fx.floatingText('NEAR +25', player.x, player.y - 24, 0x00f7ff);
        }
      }
      meteors = meteors.filter((m) => m.y < H + 30);
      // pickups
      for (let i = pickups.length - 1; i >= 0; i--) {
        const p = pickups[i]!;
        p.y += p.vy * dt;
        if (p.y > H + 20) { pickups.splice(i, 1); continue; }
        if (Math.hypot(p.x - player.x, p.y - player.y) < player.r + 12) {
          pickups.splice(i, 1);
          if (p.kind === 'shield') { shield = true; ctx.hud.toast('SHIELD'); }
          else if (p.kind === 'slow') { slowT = 5; ctx.hud.toast('SLOW-MO'); }
          else { bonus += 100; ctx.fx.floatingText('+100', p.x, p.y, 0xffd200); }
          ctx.audio.sfx(p.kind === 'coin' ? 'coin' : 'powerup');
        }
      }
      draw();
    },
    destroy() {
      offPtr();
      layer.destroy({ children: true });
    },
  };
}
