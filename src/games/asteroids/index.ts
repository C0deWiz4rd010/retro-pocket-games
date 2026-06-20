import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import { TAU, wrap } from '@utils/math';
import type { RNG } from '@utils/rng';

interface Roid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number; // 3 big, 2 med, 1 small
  r: number;
  verts: number[];
}

function makeRoid(x: number, y: number, size: number, rng: RNG): Roid {
  const r = size * 14;
  const n = 9;
  const verts: number[] = [];
  for (let i = 0; i < n; i++) verts.push(0.7 + rng.next() * 0.5);
  const a = rng.next() * TAU;
  const sp = (4 - size) * 22 + rng.next() * 20;
  return { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size, r, verts };
}

type PowerKind = 'shield' | 'triple' | 'life';
interface Power { x: number; y: number; vx: number; vy: number; kind: PowerKind; life: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: number }
const POWER: Record<PowerKind, { color: number; label: string }> = {
  shield: { color: 0x00f7ff, label: 'SHIELD' },
  triple: { color: 0xffd200, label: 'TRIPLE SHOT' },
  life: { color: 0xff2e97, label: '+1 LIFE' },
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
  for (let i = 0; i < 50; i++) stars.push({ x: ctx.rng.next() * W, y: ctx.rng.next() * H, s: ctx.rng.next() * 1.4 + 0.4 });
  bgG.rect(0, 0, W, H).fill({ color: 0x05060f });
  for (const s of stars) bgG.circle(s.x, s.y, s.s).fill({ color: 0xffffff, alpha: 0.1 + s.s * 0.2 });

  const ship = { x: W / 2, y: H / 2, a: -Math.PI / 2, vx: 0, vy: 0, thrust: false, inv: 0 };
  let bullets: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  let roids: Roid[] = [];
  const powers: Power[] = [];
  const particles: Particle[] = [];
  let score = 0;
  let lives = 3;
  let wave = 1;
  let over = false;
  let shieldT = 0; // Feature: shield power-up aura
  let tripleT = 0; // Feature: triple-shot power-up
  let saucer: { x: number; y: number; dir: number; fire: number } | null = null;
  let saucerTimer = 18;
  let eBullets: { x: number; y: number; vx: number; vy: number; life: number }[] = [];

  const invincible = (): boolean => ship.inv > 0 || shieldT > 0;
  const burst = (x: number, y: number, color: number, n = 10): void => {
    for (let i = 0; i < n; i++) {
      const a = ctx.rng.next() * TAU;
      const sp = 40 + ctx.rng.next() * 140;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6 + ctx.rng.next() * 0.4, color });
    }
  };
  const setLabel = (): void => {
    const buffs = [shieldT > 0 ? '🛡' : '', tripleT > 0 ? '⋔' : ''].join('');
    ctx.hud.setLabel(`WAVE ${wave}${buffs ? '  ' + buffs : ''}`);
  };
  const maybeDrop = (x: number, y: number, chance: number): void => {
    if (ctx.rng.next() > chance) return;
    const kinds: PowerKind[] = ['shield', 'triple', 'life'];
    const a = ctx.rng.next() * TAU;
    powers.push({ x, y, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30, kind: ctx.rng.pick(kinds), life: 9 });
  };

  const spawnWave = (): void => {
    roids = [];
    const count = 3 + wave;
    for (let i = 0; i < count; i++) {
      const edge = ctx.rng.next();
      roids.push(makeRoid(edge * W, ctx.rng.next() < 0.5 ? 0 : H, 3, ctx.rng));
    }
  };
  spawnWave();

  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('WAVE 1');

  const shoot = (ang: number): void => {
    bullets.push({
      x: ship.x + Math.cos(ang) * 14,
      y: ship.y + Math.sin(ang) * 14,
      vx: Math.cos(ang) * 460 + ship.vx,
      vy: Math.sin(ang) * 460 + ship.vy,
      life: 1.1,
    });
  };
  const fire = (): void => {
    if (over) return;
    if (tripleT > 0) {
      shoot(ship.a);
      shoot(ship.a - 0.22);
      shoot(ship.a + 0.22);
    } else {
      shoot(ship.a);
    }
    ctx.audio.sfx('shoot');
  };
  // Feature: hyperspace teleport — escape danger with a small misfire risk
  const hyperspace = (): void => {
    if (over) return;
    burst(ship.x, ship.y, 0xa8a0ff, 12);
    ship.x = ctx.rng.next() * W;
    ship.y = ctx.rng.next() * H;
    ship.vx = ship.vy = 0;
    ship.inv = 1.2;
    burst(ship.x, ship.y, 0xa8a0ff, 12);
    ctx.audio.sfx('powerup');
    // ~12% chance to rematerialize on top of a rock
    if (ctx.rng.next() < 0.12) {
      for (const r of roids) {
        if (Math.hypot(ship.x - r.x, ship.y - r.y) < r.r + 6) ctx.hud.toast('HYPERSPACE MISFIRE!');
      }
    }
  };
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a') fire();
    else if (a === 'b') hyperspace();
  });

  const respawn = (): void => {
    ship.x = W / 2;
    ship.y = H / 2;
    ship.vx = 0;
    ship.vy = 0;
    ship.a = -Math.PI / 2;
    ship.inv = 2;
  };

  const collect = (kind: PowerKind): void => {
    if (kind === 'shield') shieldT = 7;
    else if (kind === 'triple') tripleT = 9;
    else {
      lives++;
      ctx.hud.setLives(lives);
    }
    ctx.audio.sfx('coin');
    ctx.hud.toast(POWER[kind].label);
    setLabel();
  };

  const draw = (): void => {
    g.clear();
    // particles
    for (const p of particles) g.circle(p.x, p.y, 2.5 * Math.min(1, p.life * 2)).fill({ color: p.color, alpha: Math.min(1, p.life * 2) });
    // power-ups
    for (const pw of powers) {
      const flash = pw.life < 3 && Math.floor(pw.life * 6) % 2 === 0;
      if (!flash) {
        g.circle(pw.x, pw.y, 9).stroke({ width: 2, color: POWER[pw.kind].color });
        g.circle(pw.x, pw.y, 4).fill({ color: POWER[pw.kind].color });
      }
    }
    // shield aura
    if (shieldT > 0) g.circle(ship.x, ship.y, 18).stroke({ width: 2, color: 0x00f7ff, alpha: 0.4 + 0.3 * Math.sin(performance.now() / 100) });
    // ship
    if (!(ship.inv > 0 && Math.floor(ship.inv * 10) % 2 === 0)) {
      const tx = (lx: number, ly: number): [number, number] => [
        ship.x + lx * Math.cos(ship.a) - ly * Math.sin(ship.a),
        ship.y + lx * Math.sin(ship.a) + ly * Math.cos(ship.a),
      ];
      const [ax, ay] = tx(14, 0);
      const [bx, by] = tx(-10, -8);
      const [cx, cy] = tx(-6, 0);
      const [dx, dy] = tx(-10, 8);
      g.poly([ax, ay, bx, by, cx, cy, dx, dy]).stroke({ width: 2, color: 0xa8a0ff });
      if (ship.thrust) g.poly([cx, cy, ...tx(-18, 0)]).stroke({ width: 2, color: 0xff7b00 });
    }
    // roids
    roids.forEach((r) => {
      const path: number[] = [];
      r.verts.forEach((rr, i) => {
        const ang = (i / r.verts.length) * TAU;
        path.push(r.x + Math.cos(ang) * r.r * rr, r.y + Math.sin(ang) * r.r * rr);
      });
      g.poly(path).stroke({ width: 2, color: 0xcad0ff });
    });
    bullets.forEach((b) => g.circle(b.x, b.y, 2.5).fill({ color: 0xffffff }));
    eBullets.forEach((b) => g.circle(b.x, b.y, 2.5).fill({ color: 0xff4d4d }));
    if (saucer) {
      g.ellipse(saucer.x, saucer.y, 16, 7).stroke({ width: 2, color: 0xff2e97 });
      g.ellipse(saucer.x, saucer.y - 3, 8, 5).stroke({ width: 2, color: 0xff7b00 });
    }
  };

  return {
    update(dt) {
      if (over) return;
      // controls
      const ax = ctx.input.axis().x;
      ship.a += ax * 3.4 * dt;
      ship.thrust = ctx.input.isDown('a') || ctx.input.isDown('up');
      if (ship.thrust) {
        ship.vx += Math.cos(ship.a) * 240 * dt;
        ship.vy += Math.sin(ship.a) * 240 * dt;
        if (ctx.rng.next() < 0.3) ctx.audio.sfx('blip');
        // thruster particles
        const bx = ship.x - Math.cos(ship.a) * 12;
        const by = ship.y - Math.sin(ship.a) * 12;
        particles.push({ x: bx, y: by, vx: -Math.cos(ship.a) * 80 + (ctx.rng.next() - 0.5) * 40, vy: -Math.sin(ship.a) * 80 + (ctx.rng.next() - 0.5) * 40, life: 0.3, color: 0xff7b00 });
      }
      ship.vx *= 0.99;
      ship.vy *= 0.99;
      ship.x = wrap(ship.x + ship.vx * dt, W);
      ship.y = wrap(ship.y + ship.vy * dt, H);
      if (ship.inv > 0) ship.inv -= dt;
      if (shieldT > 0 && (shieldT -= dt) <= 0) setLabel();
      if (tripleT > 0 && (tripleT -= dt) <= 0) setLabel();

      // particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }

      // power-ups drift + pickup
      for (let i = powers.length - 1; i >= 0; i--) {
        const pw = powers[i]!;
        pw.x = wrap(pw.x + pw.vx * dt, W);
        pw.y = wrap(pw.y + pw.vy * dt, H);
        pw.life -= dt;
        if (pw.life <= 0) { powers.splice(i, 1); continue; }
        if (Math.hypot(pw.x - ship.x, pw.y - ship.y) < 16) {
          collect(pw.kind);
          powers.splice(i, 1);
        }
      }

      bullets.forEach((b) => {
        b.x = wrap(b.x + b.vx * dt, W);
        b.y = wrap(b.y + b.vy * dt, H);
        b.life -= dt;
      });
      bullets = bullets.filter((b) => b.life > 0);

      roids.forEach((r) => {
        r.x = wrap(r.x + r.vx * dt, W);
        r.y = wrap(r.y + r.vy * dt, H);
      });

      // hostile saucer: spawn, drift, and shoot toward the ship
      saucerTimer -= dt;
      if (!saucer && saucerTimer <= 0 && roids.length) {
        const d = ctx.rng.next() < 0.5 ? 1 : -1;
        saucer = { x: d > 0 ? 0 : W, y: 40 + ctx.rng.next() * (H - 80), dir: d, fire: 1.4 };
        saucerTimer = 22 + ctx.rng.next() * 12;
      }
      if (saucer) {
        saucer.x += saucer.dir * 90 * dt;
        saucer.y += Math.sin(performance.now() / 400) * 20 * dt;
        if (saucer.x < -20 || saucer.x > W + 20) saucer = null;
      }
      if (saucer) {
        saucer.fire -= dt;
        if (saucer.fire <= 0) {
          saucer.fire = 1.4;
          const ang = Math.atan2(ship.y - saucer.y, ship.x - saucer.x) + (ctx.rng.next() - 0.5) * 0.4;
          eBullets.push({ x: saucer.x, y: saucer.y, vx: Math.cos(ang) * 220, vy: Math.sin(ang) * 220, life: 2.4 });
          ctx.audio.sfx('shoot');
        }
      }
      eBullets.forEach((b) => {
        b.x = wrap(b.x + b.vx * dt, W);
        b.y = wrap(b.y + b.vy * dt, H);
        b.life -= dt;
      });
      eBullets = eBullets.filter((b) => b.life > 0);

      if (saucer) {
        for (let j = bullets.length - 1; j >= 0; j--) {
          const b = bullets[j]!;
          if (Math.hypot(b.x - saucer.x, b.y - saucer.y) < 16) {
            bullets.splice(j, 1);
            score += 200;
            ctx.hud.setScore(score);
            ctx.hud.toast('SAUCER +200');
            ctx.audio.sfx('explosion');
            burst(saucer.x, saucer.y, 0xff2e97, 16);
            maybeDrop(saucer.x, saucer.y, 0.6);
            saucer = null;
            break;
          }
        }
      }
      if (!invincible()) {
        for (const b of eBullets) {
          if (Math.hypot(b.x - ship.x, b.y - ship.y) < 9) {
            lives--;
            ctx.hud.setLives(lives);
            ctx.audio.sfx('hit');
            burst(ship.x, ship.y, 0xa8a0ff, 16);
            eBullets = [];
            if (lives <= 0) {
              over = true;
              ctx.gameOver(score, { wave });
              return;
            }
            respawn();
            break;
          }
        }
      }

      // bullet vs roid
      for (let i = roids.length - 1; i >= 0; i--) {
        const r = roids[i]!;
        for (let j = bullets.length - 1; j >= 0; j--) {
          const b = bullets[j]!;
          if (Math.hypot(b.x - r.x, b.y - r.y) < r.r) {
            bullets.splice(j, 1);
            roids.splice(i, 1);
            score += (4 - r.size) * 20;
            ctx.hud.setScore(score);
            ctx.audio.sfx('explosion');
            burst(r.x, r.y, 0xcad0ff, r.size * 5);
            maybeDrop(r.x, r.y, r.size === 1 ? 0.08 : 0.04);
            if (r.size > 1) {
              roids.push(makeRoid(r.x, r.y, r.size - 1, ctx.rng), makeRoid(r.x, r.y, r.size - 1, ctx.rng));
            }
            break;
          }
        }
      }

      // ship vs roid
      if (!invincible()) {
        for (const r of roids) {
          if (Math.hypot(ship.x - r.x, ship.y - r.y) < r.r + 8) {
            lives--;
            ctx.hud.setLives(lives);
            ctx.audio.sfx('hit');
            burst(ship.x, ship.y, 0xa8a0ff, 16);
            if (lives <= 0) {
              over = true;
              ctx.gameOver(score, { wave });
              return;
            }
            respawn();
            break;
          }
        }
      }

      if (!roids.length) {
        wave++;
        setLabel();
        ctx.hud.toast(`WAVE ${wave}`);
        ctx.audio.sfx('powerup');
        spawnWave();
      }
      draw();
    },
    destroy() {
      offDown();
      layer.destroy({ children: true });
    },
  };
}
