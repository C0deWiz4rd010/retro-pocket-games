import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import { clamp } from '@utils/math';

interface Enemy {
  x: number;
  y: number;
  hx: number; // home x in formation
  hy: number;
  alive: boolean;
  diving: boolean;
  t: number;
  boss: boolean;
}

type PowerKind = 'dual' | 'rapid' | 'shield';
interface Drop { x: number; y: number; kind: PowerKind }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: number }
const POWER: Record<PowerKind, { color: number; label: string }> = {
  dual: { color: 0xffd200, label: 'DUAL FIGHTER' },
  rapid: { color: 0x00f7ff, label: 'RAPID FIRE' },
  shield: { color: 0x3ddc84, label: 'SHIELD' },
};

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const bgG = new Graphics();
  const g = new Graphics();
  layer.addChild(bgG, g);

  const stars: { x: number; y: number; s: number }[] = [];
  for (let i = 0; i < 45; i++) stars.push({ x: ctx.rng.next() * W, y: ctx.rng.next() * H, s: ctx.rng.next() * 1.4 + 0.4 });

  const player = { x: W / 2, w: 30, y: H - 40 };
  let bullets: { x: number; y: number }[] = [];
  let eBullets: { x: number; y: number; vx: number; vy: number }[] = [];
  let enemies: Enemy[] = [];
  const drops: Drop[] = [];
  const particles: Particle[] = [];
  let score = 0;
  let lives = 3;
  let wave = 1;
  let over = false;
  let swayT = 0;
  let fireAcc = 0;
  let pFireAcc = 0;
  let diveAcc = 0;
  let dualT = 0; // Feature: dual fighter
  let rapidT = 0; // Feature: rapid fire
  let shield = false; // Feature: shield
  let streak = 0;
  let streakTimer = 0;
  let shake = 0;

  const burst = (x: number, y: number, color: number, n = 10): void => {
    for (let i = 0; i < n; i++) {
      const a = ctx.rng.next() * Math.PI * 2;
      const s = 40 + ctx.rng.next() * 140;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6, color });
    }
  };
  const setLabel = (): void => {
    const buffs = [dualT > 0 ? '⋔' : '', rapidT > 0 ? '⚡' : '', shield ? '🛡' : ''].join('');
    ctx.hud.setLabel(`WAVE ${wave}${buffs ? '  ' + buffs : ''}`);
  };

  const buildWave = (): void => {
    enemies = [];
    const cols = 8;
    const rowsN = 4;
    const gapX = (W - 60) / cols;
    for (let r = 0; r < rowsN; r++)
      for (let c = 0; c < cols; c++) {
        const hx = 40 + c * gapX;
        const hy = 60 + r * 30;
        enemies.push({ x: hx, y: -40 - r * 20, hx, hy, alive: true, diving: false, t: 0, boss: r === 0 });
      }
  };
  buildWave();

  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('WAVE 1');

  const fire = (): void => {
    if (over) return;
    const max = rapidT > 0 ? 5 : dualT > 0 ? 4 : 2;
    if (bullets.length >= max) return;
    if (dualT > 0) {
      bullets.push({ x: player.x - 10, y: player.y - 12 }, { x: player.x + 10, y: player.y - 12 });
    } else {
      bullets.push({ x: player.x, y: player.y - 12 });
    }
    ctx.audio.sfx('shoot');
  };
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a') fire();
  });
  const offTap = ctx.input.on('tap', fire);

  const collect = (kind: PowerKind): void => {
    if (kind === 'dual') dualT = 12;
    else if (kind === 'rapid') rapidT = 10;
    else shield = true;
    ctx.audio.sfx('powerup');
    ctx.hud.toast(POWER[kind].label);
    setLabel();
  };

  const aliveCount = (): number => enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0);

  const drawBg = (): void => {
    bgG.clear();
    bgG.rect(0, 0, W, H).fill({ color: 0x05060f });
    for (const s of stars) bgG.circle(s.x, s.y, s.s).fill({ color: 0xffffff, alpha: 0.1 + s.s * 0.2 });
  };
  drawBg();

  const draw = (): void => {
    g.clear();
    // particles
    for (const p of particles) g.circle(p.x, p.y, 3 * Math.min(1, p.life * 2)).fill({ color: p.color, alpha: Math.min(1, p.life * 2) });
    // drops
    drops.forEach((d) => {
      g.roundRect(d.x - 8, d.y - 6, 16, 12, 3).fill({ color: POWER[d.kind].color });
      g.roundRect(d.x - 8, d.y - 6, 16, 12, 3).stroke({ width: 1, color: 0xffffff, alpha: 0.6 });
    });
    enemies.forEach((e) => {
      if (!e.alive) return;
      const col = e.boss ? 0xff2e97 : 0x42a5f5;
      g.roundRect(e.x - 11, e.y - 9, 22, 18, 4).fill({ color: col });
      g.rect(e.x - 7, e.y - 13, 4, 5).fill({ color: col });
      g.rect(e.x + 3, e.y - 13, 4, 5).fill({ color: col });
    });
    if (shield) g.circle(player.x, player.y - 2, 22).stroke({ width: 2, color: 0x3ddc84, alpha: 0.6 });
    const drawShip = (sx: number): void => {
      g.poly([sx, player.y - 12, sx - player.w / 2, player.y + 8, sx + player.w / 2, player.y + 8]).fill({ color: 0x00f7ff });
    };
    drawShip(player.x);
    if (dualT > 0) {
      drawShip(player.x - 24);
      drawShip(player.x + 24);
    }
    bullets.forEach((b) => g.rect(b.x - 2, b.y, 4, 12).fill({ color: 0xffffff }));
    eBullets.forEach((b) => g.rect(b.x - 2, b.y, 4, 10).fill({ color: 0xff4d4d }));
  };

  return {
    update(dt) {
      if (over) return;
      const ax = ctx.input.axis().x;
      if (ax) player.x = clamp(player.x + ax * 280 * dt, player.w / 2, W - player.w / 2);

      if (dualT > 0 && (dualT -= dt) <= 0) setLabel();
      if (rapidT > 0 && (rapidT -= dt) <= 0) setLabel();
      if (rapidT > 0) { pFireAcc += dt; if (pFireAcc > 0.12) { pFireAcc = 0; fire(); } }
      if (shake > 0) shake = Math.max(0, shake - dt * 2);
      if (streakTimer > 0 && (streakTimer -= dt) <= 0) streak = 0;

      // starfield drift
      for (const s of stars) { s.y += s.s * 12 * dt; if (s.y > H) { s.y = 0; s.x = ctx.rng.next() * W; } }
      // particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }
      // drops fall + pickup
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]!;
        d.y += 110 * dt;
        if (d.y > H) { drops.splice(i, 1); continue; }
        if (Math.abs(d.x - player.x) < player.w / 2 + 6 && d.y > player.y - 10) { collect(d.kind); drops.splice(i, 1); }
      }

      swayT += dt;
      const sway = Math.sin(swayT * 1.5) * 14;

      enemies.forEach((e) => {
        if (!e.alive) return;
        if (!e.diving) {
          e.x += (e.hx + sway - e.x) * Math.min(1, dt * 4);
          e.y += (e.hy - e.y) * Math.min(1, dt * 4);
        } else {
          e.t += dt;
          // curved arc: home in on player using gradual steering
          const dx = player.x - e.x;
          const targetVx = dx * 2.5;
          e.x += (targetVx - (e.x - e.hx)) * Math.min(1, dt * 2.5);
          e.y += (140 + wave * 12) * dt;
          e.x += Math.sin(e.t * 4) * 80 * dt;
          if (e.y > H + 20) {
            e.diving = false;
            e.y = -20;
            e.t = 0;
          }
        }
      });

      diveAcc += dt;
      if (diveAcc > 1.4) {
        diveAcc = 0;
        const candidates = enemies.filter((e) => e.alive && !e.diving);
        if (candidates.length) {
          const e = ctx.rng.pick(candidates);
          e.diving = true;
          e.t = 0;
        }
      }

      fireAcc += dt;
      if (fireAcc > 0.7) {
        fireAcc = 0;
        const divers = enemies.filter((e) => e.alive && e.diving);
        if (divers.length) {
          const e = ctx.rng.pick(divers);
          const ang = Math.atan2(player.y - e.y, player.x - e.x);
          eBullets.push({ x: e.x, y: e.y, vx: Math.cos(ang) * 180, vy: Math.sin(ang) * 180 + 120 });
        }
      }

      bullets.forEach((b) => (b.y -= 560 * dt));
      bullets = bullets.filter((b) => b.y > -12);
      for (const e of enemies) {
        if (!e.alive) continue;
        for (let j = bullets.length - 1; j >= 0; j--) {
          const b = bullets[j]!;
          if (Math.abs(b.x - e.x) < 13 && Math.abs(b.y - e.y) < 12) {
            e.alive = false;
            bullets.splice(j, 1);
            streak++;
            streakTimer = 2.5;
            const base = e.boss ? 150 : e.diving ? 100 : 50;
            score += base + (streak >= 3 ? streak * 10 : 0);
            ctx.hud.setScore(score);
            if (streak >= 3 && streak % 3 === 0) ctx.hud.toast(`STREAK x${streak}`);
            burst(e.x, e.y, e.boss ? 0xff2e97 : 0x42a5f5, e.boss ? 16 : 10);
            shake = Math.max(shake, e.boss ? 0.35 : 0.15);
            ctx.audio.sfx('explosion');
            // Feature: bosses drop power-ups
            if (e.boss && ctx.rng.next() < 0.5) {
              const kinds: PowerKind[] = ['dual', 'rapid', 'shield'];
              drops.push({ x: e.x, y: e.y, kind: ctx.rng.pick(kinds) });
            }
            break;
          }
        }
      }

      eBullets.forEach((b) => {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      });
      eBullets = eBullets.filter((b) => b.y < H + 10);
      for (let i = eBullets.length - 1; i >= 0; i--) {
        const b = eBullets[i]!;
        if (Math.abs(b.x - player.x) < player.w / 2 && b.y > player.y - 10 && b.y < player.y + 8) {
          eBullets.splice(i, 1);
          if (shield) {
            shield = false;
            burst(player.x, player.y, 0x3ddc84, 12);
            ctx.audio.sfx('powerup');
            ctx.hud.toast('SHIELD DOWN');
            setLabel();
            continue;
          }
          lives--;
          streak = 0;
          shake = 0.5;
          burst(player.x, player.y, 0x00f7ff, 14);
          ctx.hud.setLives(lives);
          ctx.audio.sfx('hit');
          if (lives <= 0) {
            over = true;
            ctx.gameOver(score, { wave });
            return;
          }
        }
      }
      for (const e of enemies) {
        if (e.alive && e.diving && Math.abs(e.x - player.x) < player.w / 2 && Math.abs(e.y - player.y) < 16) {
          e.alive = false;
          burst(e.x, e.y, 0x42a5f5, 10);
          if (shield) {
            shield = false;
            ctx.audio.sfx('powerup');
            ctx.hud.toast('SHIELD DOWN');
            setLabel();
            continue;
          }
          lives--;
          streak = 0;
          shake = 0.5;
          ctx.hud.setLives(lives);
          ctx.audio.sfx('hit');
          if (lives <= 0) {
            over = true;
            ctx.gameOver(score, { wave });
            return;
          }
        }
      }

      if (aliveCount() === 0) {
        wave++;
        setLabel();
        ctx.hud.toast(`WAVE ${wave}`);
        ctx.audio.sfx('powerup');
        buildWave();
      }
      layer.position.set(shake > 0 ? (ctx.rng.next() * 2 - 1) * shake * 7 : 0, shake > 0 ? (ctx.rng.next() * 2 - 1) * shake * 7 : 0);
      draw();
    },
    destroy() {
      offDown();
      offTap();
      layer.destroy({ children: true });
    },
  };
}
