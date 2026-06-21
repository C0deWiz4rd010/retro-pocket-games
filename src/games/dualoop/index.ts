import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

/**
 * Dualoop — an original two-ring orbit dodger. A light orbits the core on one of two
 * concentric rings. Arc barriers sweep toward it; tap to swap rings and slip past, grab the
 * glowing orbs, and survive as the orbit speeds up. Twists: a dodge combo, a shield pickup,
 * and rising speed zones.
 */
const CYAN = 0x22d3ee;
const PINK = 0xff2e97;
const GOLD = 0xffd200;
const GREEN = 0x3ddc84;

interface Barrier { a: number; half: number; ring: 0 | 1; scored: boolean }
interface Orb { a: number; ring: 0 | 1; taken: boolean; shield: boolean }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: number }

const norm = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const cx = W / 2;
  const cy = H / 2;
  const R = [Math.min(W, H) * 0.2, Math.min(W, H) * 0.33] as const;

  const layer = new Container();
  const g = new Graphics();
  layer.addChild(g);
  ctx.stage.addChild(layer);

  const barriers: Barrier[] = [];
  const orbs: Orb[] = [];
  const sparks: Spark[] = [];
  let dotA = -Math.PI / 2;
  let track: 0 | 1 = 1;
  let speed = 1.7;
  let score = 0;
  let lives = 3;
  let combo = 0;
  let zone = 1;
  let shield = false;
  let spawnAcc = 0;
  let over = false;

  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  const setLabel = (): void => ctx.hud.setLabel(`${shield ? '🛡 ' : ''}ZONE ${zone}`);
  setLabel();

  const swap = (): void => { track = track === 0 ? 1 : 0; ctx.audio.sfx('blip'); };
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a' || a === 'b' || a === 'up' || a === 'down' || a === 'left' || a === 'right') swap();
  });
  const offTap = ctx.input.on('tap', swap);

  const burst = (x: number, y: number, color: number, n = 10): void => {
    for (let i = 0; i < n; i++) {
      const a = ctx.rng.next() * Math.PI * 2;
      const s = 40 + ctx.rng.next() * 130;
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6, color });
    }
  };

  const spawn = (): void => {
    const ring = (ctx.rng.next() < 0.5 ? 0 : 1) as 0 | 1;
    barriers.push({ a: norm(dotA + 2.4 + ctx.rng.next() * 0.8), half: 0.3 + ctx.rng.next() * 0.25, ring, scored: false });
    if (ctx.rng.next() < 0.6) {
      const oring = (ctx.rng.next() < 0.5 ? 0 : 1) as 0 | 1;
      orbs.push({ a: norm(dotA + 1.6 + ctx.rng.next() * 1.2), ring: oring, taken: false, shield: ctx.rng.next() < 0.14 });
    }
  };

  const pos = (a: number, r: number): { x: number; y: number } => ({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });

  const draw = (): void => {
    g.clear();
    g.rect(0, 0, W, H).fill({ color: 0x05060f });
    g.circle(cx, cy, R[0]).stroke({ width: 2, color: 0x1b2440 });
    g.circle(cx, cy, R[1]).stroke({ width: 2, color: 0x1b2440 });
    g.circle(cx, cy, 12).fill({ color: 0x9aa0ff });
    // barriers
    for (const b of barriers) {
      const r = R[b.ring];
      g.arc(cx, cy, r, b.a - b.half, b.a + b.half).stroke({ width: 13, color: PINK, alpha: 0.9 });
    }
    // orbs
    for (const o of orbs) {
      if (o.taken) continue;
      const p = pos(o.a, R[o.ring]);
      g.circle(p.x, p.y, 8).fill({ color: o.shield ? GREEN : GOLD });
    }
    // sparks
    for (const s of sparks) g.circle(s.x, s.y, 3 * Math.min(1, s.life * 2)).fill({ color: s.color, alpha: Math.min(1, s.life * 2) });
    // dot
    const dp = pos(dotA, R[track]);
    if (shield) g.circle(dp.x, dp.y, 14).stroke({ width: 2, color: GREEN, alpha: 0.7 });
    g.circle(dp.x, dp.y, 9).fill({ color: CYAN });
    g.circle(dp.x, dp.y, 4).fill({ color: 0xffffff, alpha: 0.6 });
  };

  return {
    update(dt) {
      if (over) return;
      dotA = norm(dotA + speed * dt);
      score += Math.floor(dt * 10 * zone);
      const nz = 1 + Math.floor(score / 1400);
      if (nz > zone) { zone = nz; speed = 1.7 + zone * 0.18; ctx.hud.toast(`ZONE ${zone}`); ctx.audio.sfx('powerup'); setLabel(); }

      spawnAcc += dt;
      if (spawnAcc >= Math.max(0.5, 1.1 - zone * 0.05)) { spawnAcc = 0; spawn(); }

      // barriers: collision on the dot's ring, score the dodge once swept past
      for (let i = barriers.length - 1; i >= 0; i--) {
        const b = barriers[i]!;
        const rel = norm(b.a - dotA);
        if (b.ring === track && Math.abs(rel) < b.half && !b.scored) {
          // collision
          b.scored = true;
          const dp = pos(dotA, R[track]);
          if (shield) {
            shield = false;
            ctx.audio.sfx('powerup');
            ctx.hud.toast('SHIELD ABSORBED');
            burst(dp.x, dp.y, GREEN, 14);
            setLabel();
          } else {
            combo = 0;
            lives--;
            ctx.hud.setLives(lives);
            ctx.audio.sfx('hit');
            ctx.fx.screenShake(7, 0.16);
            burst(dp.x, dp.y, PINK, 16);
            if (lives <= 0) { over = true; ctx.audio.sfx('explosion'); ctx.gameOver(score, { zone }); return; }
          }
        } else if (rel < -0.45) {
          // swept past without contact → dodged
          if (!b.scored) {
            combo++;
            const mult = 1 + Math.floor(combo / 6);
            score += 40 * mult;
            if (combo >= 6 && combo % 6 === 0) ctx.fx.floatingText(`COMBO x${mult}`, cx, cy - R[1] - 16, GOLD);
          }
          barriers.splice(i, 1);
        }
      }

      // orbs: collect on matching ring as the dot passes
      for (let i = orbs.length - 1; i >= 0; i--) {
        const o = orbs[i]!;
        const rel = norm(o.a - dotA);
        if (!o.taken && o.ring === track && Math.abs(rel) < 0.16) {
          o.taken = true;
          const p = pos(o.a, R[o.ring]);
          if (o.shield) { shield = true; ctx.hud.toast('SHIELD'); setLabel(); }
          else score += 80 * zone;
          ctx.audio.sfx(o.shield ? 'powerup' : 'coin');
          burst(p.x, p.y, o.shield ? GREEN : GOLD, 8);
          orbs.splice(i, 1);
        } else if (rel < -0.5) orbs.splice(i, 1);
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]!;
        s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
        if (s.life <= 0) sparks.splice(i, 1);
      }

      ctx.hud.setScore(score);
      draw();
    },
    destroy() {
      offDown();
      offTap();
      layer.destroy({ children: true });
    },
  };
}
