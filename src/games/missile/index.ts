import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

interface Incoming {
  x: number;
  y: number;
  tx: number;
  ty: number;
  vx: number;
  vy: number;
  mirv: number; // Feature: remaining splits
  splitY: number;
}
interface Crate { x: number; y: number; vy: number } // Feature: ammo crate
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: number }
interface Counter {
  x: number;
  y: number;
  tx: number;
  ty: number;
  vx: number;
  vy: number;
}
interface Blast {
  x: number;
  y: number;
  r: number;
  max: number;
  growing: boolean;
  kills: number;
}

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const groundY = H - 30;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const bgG = new Graphics();
  const g = new Graphics();
  layer.addChild(bgG, g);

  const stars: { x: number; y: number; s: number }[] = [];
  for (let i = 0; i < 40; i++) stars.push({ x: ctx.rng.next() * W, y: ctx.rng.next() * groundY * 0.85, s: ctx.rng.next() * 1.3 + 0.4 });
  bgG.rect(0, 0, W, H).fill({ color: 0x05060f });
  for (const s of stars) bgG.circle(s.x, s.y, s.s).fill({ color: 0xffffff, alpha: 0.12 + s.s * 0.18 });

  const cities = [0.16, 0.32, 0.48, 0.64, 0.8].map((f) => ({ x: f * W, alive: true }));
  const battery = { x: W / 2, y: groundY, ammo: 10 };
  const incoming: Incoming[] = [];
  const particles: Particle[] = [];
  let counters: Counter[] = [];
  let blasts: Blast[] = [];
  let crate: Crate | null = null;
  let crateTimer = 10;
  let score = 0;
  let wave = 1;
  let over = false;
  let spawnAcc = 0;
  let toSpawn = 6;
  let shake = 0;

  const burst = (x: number, y: number, color: number, n = 8): void => {
    for (let i = 0; i < n; i++) {
      const a = ctx.rng.next() * Math.PI * 2;
      const s = 40 + ctx.rng.next() * 100;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, color });
    }
  };

  ctx.hud.setScore(0);
  ctx.hud.setLabel('WAVE 1 • AMMO 10');

  const updateLabel = (): void => ctx.hud.setLabel(`WAVE ${wave} • AMMO ${battery.ammo}`);

  const fireAt = (tx: number, ty: number): void => {
    if (over || battery.ammo <= 0) return;
    battery.ammo--;
    updateLabel();
    const ang = Math.atan2(ty - battery.y, tx - battery.x);
    const sp = 420;
    counters.push({ x: battery.x, y: battery.y, tx, ty, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp });
    ctx.audio.sfx('shoot');
  };
  const offTap = ctx.input.on('tap', ({ x, y }) => fireAt(x, y));

  const launchMissile = (x: number, y: number, mirv: number): void => {
    const targets = [...cities.filter((c) => c.alive).map((c) => c.x), battery.x];
    const tx = ctx.rng.pick(targets);
    const ty = groundY;
    const ang = Math.atan2(ty - y, tx - x);
    const sp = 40 + wave * 6;
    incoming.push({ x, y, tx, ty, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, mirv, splitY: groundY * (0.4 + ctx.rng.next() * 0.2) });
  };
  const spawnIncoming = (): void => {
    // Feature: from wave 3, some missiles are MIRVs that split mid-flight
    const mirv = wave >= 3 && ctx.rng.next() < 0.35 ? 1 + Math.floor(ctx.rng.next() * 2) : 0;
    launchMissile(ctx.rng.next() * W, 0, mirv);
  };

  const draw = (): void => {
    g.clear();
    g.rect(0, groundY, W, H - groundY).fill({ color: 0x2a1a0a });
    cities.forEach((c) => {
      if (c.alive) {
        g.roundRect(c.x - 14, groundY - 16, 28, 16, 3).fill({ color: 0x42a5f5 });
        g.rect(c.x - 10, groundY - 24, 6, 8).fill({ color: 0x42a5f5 });
        g.rect(c.x + 4, groundY - 24, 6, 8).fill({ color: 0x42a5f5 });
      }
    });
    g.poly([battery.x, battery.y - 18, battery.x - 12, battery.y, battery.x + 12, battery.y]).fill({ color: 0x3ddc84 });
    incoming.forEach((m) => {
      g.moveTo(m.x - m.vx * 0.06, m.y - m.vy * 0.06).lineTo(m.x, m.y).stroke({ width: 2, color: 0xff4d4d });
      g.circle(m.x, m.y, 3).fill({ color: 0xffd200 });
    });
    counters.forEach((m) => {
      g.moveTo(battery.x, battery.y).lineTo(m.x, m.y).stroke({ width: 1, color: 0x00f7ff, alpha: 0.25 });
      g.circle(m.x, m.y, 2.5).fill({ color: 0x00f7ff });
    });
    blasts.forEach((b) => g.circle(b.x, b.y, b.r).fill({ color: b.kills >= 2 ? 0xfff6b0 : 0xffd27f, alpha: 0.6 }));
    if (crate) {
      g.roundRect(crate.x - 9, crate.y - 7, 18, 14, 2).fill({ color: 0x3ddc84 });
      g.roundRect(crate.x - 9, crate.y - 7, 18, 14, 2).stroke({ width: 1.5, color: 0xffffff, alpha: 0.7 });
    }
    for (const p of particles) g.circle(p.x, p.y, 3 * Math.min(1, p.life * 2)).fill({ color: p.color, alpha: Math.min(1, p.life * 2) });
  };

  return {
    update(dt) {
      if (over) return;
      spawnAcc += dt;
      if (spawnAcc > 1.2 && toSpawn > 0) {
        spawnAcc = 0;
        toSpawn--;
        spawnIncoming();
      }

      // counter missiles → detonate at target
      counters.forEach((m) => {
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        if ((m.vy < 0 && m.y <= m.ty) || (m.vy > 0 && m.y >= m.ty) || Math.hypot(m.x - m.tx, m.y - m.ty) < 8) {
          blasts.push({ x: m.x, y: m.y, r: 4, max: 34, growing: true, kills: 0 });
          ctx.audio.sfx('explosion');
        }
      });
      counters = counters.filter(
        (m) => !((m.vy < 0 && m.y <= m.ty) || (m.vy > 0 && m.y >= m.ty) || Math.hypot(m.x - m.tx, m.y - m.ty) < 8),
      );

      // blasts grow then shrink, destroy incoming inside radius
      blasts.forEach((b) => {
        if (b.growing) {
          b.r += 80 * dt;
          if (b.r >= b.max) b.growing = false;
        } else b.r -= 50 * dt;
      });
      for (let i = incoming.length - 1; i >= 0; i--) {
        const m = incoming[i]!;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        // MIRV split
        if (m.mirv > 0 && m.y >= m.splitY) {
          const children = m.mirv;
          m.mirv = 0;
          for (let k = 0; k < children; k++) launchMissile(m.x, m.y, 0);
          burst(m.x, m.y, 0xff7b00, 6);
        }
        let hitBlast: Blast | null = null;
        for (const b of blasts) {
          if (Math.hypot(m.x - b.x, m.y - b.y) < b.r) {
            hitBlast = b;
            break;
          }
        }
        if (hitBlast) {
          incoming.splice(i, 1);
          hitBlast.kills++;
          // Feature: chain combo — each extra kill from one blast is worth more
          const pts = 25 * hitBlast.kills;
          score += pts;
          if (hitBlast.kills >= 2) ctx.hud.toast(`COMBO x${hitBlast.kills}! +${pts}`);
          burst(m.x, m.y, 0xffd200, 7);
          ctx.hud.setScore(score);
          continue;
        }
        if (m.y >= groundY) {
          incoming.splice(i, 1);
          shake = 0.5;
          burst(m.x, groundY, 0xff4d4d, 12);
          ctx.audio.sfx('hit');
          // destroy nearest city / battery
          const city = cities.find((c) => c.alive && Math.abs(c.x - m.x) < 18);
          if (city) city.alive = false;
        }
      }
      blasts = blasts.filter((b) => b.r > 0);

      // Feature: ammo crate — intercept it for bonus ammo
      crateTimer -= dt;
      if (!crate && crateTimer <= 0) {
        crate = { x: 30 + ctx.rng.next() * (W - 60), y: 0, vy: 35 };
        crateTimer = 14 + ctx.rng.next() * 8;
      }
      if (crate) {
        crate.y += crate.vy * dt;
        let popped = false;
        for (const b of blasts) if (Math.hypot(crate.x - b.x, crate.y - b.y) < b.r) popped = true;
        if (popped) {
          battery.ammo += 6;
          score += 100;
          ctx.hud.setScore(score);
          ctx.hud.toast('+6 AMMO');
          burst(crate.x, crate.y, 0x3ddc84, 12);
          ctx.audio.sfx('powerup');
          updateLabel();
          crate = null;
        } else if (crate.y >= groundY) {
          crate = null;
        }
      }

      // particles + shake
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }
      if (shake > 0) shake = Math.max(0, shake - dt * 2);

      // wave clear
      if (toSpawn === 0 && incoming.length === 0 && counters.length === 0 && blasts.length === 0) {
        if (!cities.some((c) => c.alive)) {
          over = true;
          ctx.gameOver(score, { wave });
          return;
        }
        wave++;
        toSpawn = 5 + wave;
        battery.ammo = 10 + wave;
        score += cities.filter((c) => c.alive).length * 50 + battery.ammo * 5;
        ctx.hud.setScore(score);
        ctx.audio.sfx('powerup');
        ctx.hud.toast(`WAVE ${wave}`);
        updateLabel();
      }

      if (!cities.some((c) => c.alive) && incoming.length === 0) {
        over = true;
        ctx.gameOver(score, { wave });
        return;
      }
      layer.position.set(shake > 0 ? (ctx.rng.next() * 2 - 1) * shake * 7 : 0, shake > 0 ? (ctx.rng.next() * 2 - 1) * shake * 7 : 0);
      draw();
    },
    destroy() {
      offTap();
      layer.destroy({ children: true });
    },
  };
}
