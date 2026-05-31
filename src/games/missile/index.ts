import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

interface Incoming {
  x: number;
  y: number;
  tx: number;
  ty: number;
  vx: number;
  vy: number;
}
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
}

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const groundY = H - 30;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const cities = [0.16, 0.32, 0.48, 0.64, 0.8].map((f) => ({ x: f * W, alive: true }));
  const battery = { x: W / 2, y: groundY, ammo: 10 };
  const incoming: Incoming[] = [];
  let counters: Counter[] = [];
  let blasts: Blast[] = [];
  let score = 0;
  let wave = 1;
  let over = false;
  let spawnAcc = 0;
  let toSpawn = 6;

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

  const spawnIncoming = (): void => {
    const x = ctx.rng.next() * W;
    const targets = [...cities.filter((c) => c.alive).map((c) => c.x), battery.x];
    const tx = ctx.rng.pick(targets);
    const ty = groundY;
    const ang = Math.atan2(ty, tx - x);
    const sp = 40 + wave * 6;
    incoming.push({ x, y: 0, tx, ty, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp });
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
    counters.forEach((m) => g.circle(m.x, m.y, 2.5).fill({ color: 0x00f7ff }));
    blasts.forEach((b) => g.circle(b.x, b.y, b.r).fill({ color: 0xfff6b0, alpha: 0.6 }));
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
          blasts.push({ x: m.x, y: m.y, r: 4, max: 34, growing: true });
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
        let destroyed = false;
        for (const b of blasts) {
          if (Math.hypot(m.x - b.x, m.y - b.y) < b.r) {
            destroyed = true;
            break;
          }
        }
        if (destroyed) {
          incoming.splice(i, 1);
          score += 25;
          ctx.hud.setScore(score);
          continue;
        }
        if (m.y >= groundY) {
          incoming.splice(i, 1);
          ctx.audio.sfx('hit');
          // destroy nearest city / battery
          const city = cities.find((c) => c.alive && Math.abs(c.x - m.x) < 18);
          if (city) city.alive = false;
        }
      }
      blasts = blasts.filter((b) => b.r > 0);

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
      draw();
    },
    destroy() {
      offTap();
      layer.destroy({ children: true });
    },
  };
}
