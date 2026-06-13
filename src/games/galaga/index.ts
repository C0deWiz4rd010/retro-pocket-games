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

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const player = { x: W / 2, w: 30, y: H - 40 };
  let bullets: { x: number; y: number }[] = [];
  let eBullets: { x: number; y: number; vx: number; vy: number }[] = [];
  let enemies: Enemy[] = [];
  let score = 0;
  let lives = 3;
  let wave = 1;
  let over = false;
  let swayT = 0;
  let fireAcc = 0;
  let diveAcc = 0;

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
    if (over || bullets.length >= 2) return;
    bullets.push({ x: player.x, y: player.y - 12 });
    ctx.audio.sfx('shoot');
  };
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a') fire();
  });
  const offTap = ctx.input.on('tap', fire);

  const aliveCount = (): number => enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0);

  const draw = (): void => {
    g.clear();
    enemies.forEach((e) => {
      if (!e.alive) return;
      const col = e.boss ? 0xff2e97 : 0x42a5f5;
      g.roundRect(e.x - 11, e.y - 9, 22, 18, 4).fill({ color: col });
      g.rect(e.x - 7, e.y - 13, 4, 5).fill({ color: col });
      g.rect(e.x + 3, e.y - 13, 4, 5).fill({ color: col });
    });
    g.poly([player.x, player.y - 12, player.x - player.w / 2, player.y + 8, player.x + player.w / 2, player.y + 8]).fill({
      color: 0x00f7ff,
    });
    bullets.forEach((b) => g.rect(b.x - 2, b.y, 4, 12).fill({ color: 0xffffff }));
    eBullets.forEach((b) => g.rect(b.x - 2, b.y, 4, 10).fill({ color: 0xff4d4d }));
  };

  return {
    update(dt) {
      if (over) return;
      const ax = ctx.input.axis().x;
      if (ax) player.x = clamp(player.x + ax * 280 * dt, player.w / 2, W - player.w / 2);

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
            score += e.boss ? 150 : e.diving ? 100 : 50;
            ctx.hud.setScore(score);
            ctx.audio.sfx('explosion');
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
          lives--;
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
          lives--;
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
        ctx.hud.setLabel(`WAVE ${wave}`);
        ctx.audio.sfx('powerup');
        buildWave();
      }
      draw();
    },
    destroy() {
      offDown();
      offTap();
      layer.destroy({ children: true });
    },
  };
}
