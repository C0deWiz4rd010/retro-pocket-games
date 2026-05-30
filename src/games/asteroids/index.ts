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

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const ship = { x: W / 2, y: H / 2, a: -Math.PI / 2, vx: 0, vy: 0, thrust: false, inv: 0 };
  let bullets: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  let roids: Roid[] = [];
  let score = 0;
  let lives = 3;
  let wave = 1;
  let over = false;
  let saucer: { x: number; y: number; dir: number; fire: number } | null = null;
  let saucerTimer = 18;
  let eBullets: { x: number; y: number; vx: number; vy: number; life: number }[] = [];

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

  const fire = (): void => {
    if (over) return;
    bullets.push({
      x: ship.x + Math.cos(ship.a) * 14,
      y: ship.y + Math.sin(ship.a) * 14,
      vx: Math.cos(ship.a) * 460 + ship.vx,
      vy: Math.sin(ship.a) * 460 + ship.vy,
      life: 1.1,
    });
    ctx.audio.sfx('shoot');
  };
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'b' || a === 'a') fire();
  });

  const respawn = (): void => {
    ship.x = W / 2;
    ship.y = H / 2;
    ship.vx = 0;
    ship.vy = 0;
    ship.a = -Math.PI / 2;
    ship.inv = 2;
  };

  const draw = (): void => {
    g.clear();
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
      }
      ship.vx *= 0.99;
      ship.vy *= 0.99;
      ship.x = wrap(ship.x + ship.vx * dt, W);
      ship.y = wrap(ship.y + ship.vy * dt, H);
      if (ship.inv > 0) ship.inv -= dt;

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
            saucer = null;
            break;
          }
        }
      }
      if (ship.inv <= 0) {
        for (const b of eBullets) {
          if (Math.hypot(b.x - ship.x, b.y - ship.y) < 9) {
            lives--;
            ctx.hud.setLives(lives);
            ctx.audio.sfx('hit');
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
            if (r.size > 1) {
              roids.push(makeRoid(r.x, r.y, r.size - 1, ctx.rng), makeRoid(r.x, r.y, r.size - 1, ctx.rng));
            }
            break;
          }
        }
      }

      // ship vs roid
      if (ship.inv <= 0) {
        for (const r of roids) {
          if (Math.hypot(ship.x - r.x, ship.y - r.y) < r.r + 8) {
            lives--;
            ctx.hud.setLives(lives);
            ctx.audio.sfx('hit');
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
        ctx.hud.setLabel(`WAVE ${wave}`);
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
