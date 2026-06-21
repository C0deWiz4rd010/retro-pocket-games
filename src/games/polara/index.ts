import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

/**
 * Polara — an original polarity-defense game. A core at the centre has a polarity (red or
 * blue). Charged particles streak inward; match the core's polarity to a particle's charge
 * to absorb it safely. A mismatch breaks through and costs a life. Flip fast, read the colours,
 * survive. Three twists: an absorb combo multiplier, a shield pickup, and rising danger zones.
 */
const RED = 0xff4d4d;
const BLUE = 0x38bdf8;
const GREEN = 0x3ddc84;

type Kind = 'red' | 'blue' | 'shield';
interface Particle { x: number; y: number; vx: number; vy: number; kind: Kind; alive: boolean }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: number }

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const cx = W / 2;
  const cy = H / 2;
  const coreR = 26;
  const ringR = 46;

  const layer = new Container();
  const g = new Graphics();
  layer.addChild(g);
  ctx.stage.addChild(layer);

  const particles: Particle[] = [];
  const sparks: Spark[] = [];
  let polarity: 'red' | 'blue' = 'red';
  let score = 0;
  let lives = 3;
  let combo = 0;
  let zone = 1;
  let shield = false;
  let t = 0;
  let spawnAcc = 0;
  let over = false;

  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  const setLabel = (): void => ctx.hud.setLabel(`${polarity === 'red' ? '🔴' : '🔵'} ${shield ? '🛡 ' : ''}ZONE ${zone}`);
  setLabel();

  const flip = (): void => {
    polarity = polarity === 'red' ? 'blue' : 'red';
    ctx.audio.sfx('blip');
    setLabel();
  };
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a' || a === 'b' || a === 'up' || a === 'left' || a === 'right' || a === 'down') flip();
  });
  const offTap = ctx.input.on('tap', flip);

  const burst = (x: number, y: number, color: number, n = 10): void => {
    for (let i = 0; i < n; i++) {
      const a = ctx.rng.next() * Math.PI * 2;
      const s = 40 + ctx.rng.next() * 130;
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6, color });
    }
  };

  const spawn = (): void => {
    const a = ctx.rng.next() * Math.PI * 2;
    const r = Math.max(W, H) * 0.62;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    const speed = 70 + zone * 16 + ctx.rng.next() * 40;
    const aim = Math.atan2(cy - y, cx - x);
    const roll = ctx.rng.next();
    const kind: Kind = roll > 0.92 && !shield ? 'shield' : ctx.rng.next() < 0.5 ? 'red' : 'blue';
    particles.push({ x, y, vx: Math.cos(aim) * speed, vy: Math.sin(aim) * speed, kind, alive: true });
  };

  const colorOf = (k: Kind): number => (k === 'red' ? RED : k === 'blue' ? BLUE : GREEN);

  const draw = (): void => {
    g.clear();
    g.rect(0, 0, W, H).fill({ color: 0x05060f });
    // faint orbit rings
    for (let r = ringR + 40; r < Math.max(W, H); r += 70) g.circle(cx, cy, r).stroke({ width: 1, color: 0x1b2440, alpha: 0.5 });
    // sparks
    for (const s of sparks) g.circle(s.x, s.y, 3 * Math.min(1, s.life * 2)).fill({ color: s.color, alpha: Math.min(1, s.life * 2) });
    // particles + incoming charge trails
    for (const p of particles) {
      const col = colorOf(p.kind);
      g.moveTo(p.x - p.vx * 0.08, p.y - p.vy * 0.08).lineTo(p.x, p.y).stroke({ width: 2, color: col, alpha: 0.4 });
      g.circle(p.x, p.y, p.kind === 'shield' ? 9 : 8).fill({ color: col });
      if (p.kind === 'shield') g.circle(p.x, p.y, 5).fill({ color: 0x07160d });
    }
    // shield aura
    if (shield) g.circle(cx, cy, ringR + 6).stroke({ width: 2, color: GREEN, alpha: 0.5 + Math.sin(t * 8) * 0.2 });
    // ring (current polarity colour) + core
    g.circle(cx, cy, ringR).stroke({ width: 4, color: polarity === 'red' ? RED : BLUE, alpha: 0.85 });
    g.circle(cx, cy, coreR).fill({ color: polarity === 'red' ? RED : BLUE });
    g.circle(cx, cy, coreR * 0.5).fill({ color: 0xffffff, alpha: 0.25 });
  };

  return {
    update(dt) {
      if (over) return;
      t += dt;
      score += Math.floor(dt * 12 * zone);
      const nz = 1 + Math.floor(score / 1500);
      if (nz > zone) { zone = nz; ctx.hud.toast(`ZONE ${zone} · x${zone}`); ctx.audio.sfx('powerup'); setLabel(); }

      spawnAcc += dt;
      if (spawnAcc >= Math.max(0.45, 1.1 - zone * 0.06)) { spawnAcc = 0; spawn(); }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const d = Math.hypot(p.x - cx, p.y - cy);
        if (d <= ringR) {
          particles.splice(i, 1);
          if (p.kind === 'shield') {
            shield = true;
            ctx.hud.toast('SHIELD');
            ctx.audio.sfx('powerup');
            burst(p.x, p.y, GREEN, 12);
            setLabel();
          } else if (p.kind === polarity) {
            // matched → absorbed safely
            combo++;
            const mult = 1 + Math.floor(combo / 5);
            score += 60 * mult;
            if (combo >= 5 && combo % 5 === 0) ctx.fx.floatingText(`COMBO x${mult}`, p.x, p.y, 0xffd200);
            ctx.audio.sfx('coin');
            burst(cx + (p.x - cx) * 0.6, cy + (p.y - cy) * 0.6, colorOf(p.kind), 8);
          } else {
            // mismatch → breach
            if (shield) {
              shield = false;
              ctx.audio.sfx('powerup');
              ctx.hud.toast('SHIELD ABSORBED');
              burst(cx, cy, GREEN, 14);
              setLabel();
            } else {
              combo = 0;
              lives--;
              ctx.hud.setLives(lives);
              ctx.audio.sfx('hit');
              ctx.fx.screenShake(7, 0.16);
              burst(cx, cy, colorOf(p.kind), 16);
              if (lives <= 0) { over = true; ctx.audio.sfx('explosion'); ctx.gameOver(score, { zone }); return; }
            }
          }
        }
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
