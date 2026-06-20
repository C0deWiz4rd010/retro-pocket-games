import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import { wrap } from '@utils/math';

interface Platform {
  x: number;
  y: number;
  w: number;
  kind: 'normal' | 'moving' | 'break';
  vx: number;
  used: boolean;
}
interface Coin { x: number; y: number; taken: boolean }
interface Monster { x: number; y: number; alive: boolean }
interface Bullet { x: number; y: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: number }

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const bgG = new Graphics();
  const g = new Graphics();
  layer.addChild(bgG, g);

  const GRAV = 1400;
  const JUMP = -620;
  const SPRING = -1000;
  const PW = 56;

  const player = { x: W / 2, y: H - 120, vx: 0, vy: JUMP, r: 14, squash: 0 };
  let platforms: Platform[] = [];
  let springs: { x: number; y: number }[] = [];
  let coins: Coin[] = [];
  let monsters: Monster[] = [];
  let jetpacks: { x: number; y: number }[] = [];
  const bullets: Bullet[] = [];
  const particles: Particle[] = [];
  const stars: { x: number; y: number; s: number }[] = [];
  for (let i = 0; i < 40; i++) stars.push({ x: ctx.rng.next() * W, y: ctx.rng.next() * H, s: ctx.rng.next() * 1.4 + 0.4 });
  let height = 0;
  let camY = 0;
  let over = false;
  let best = H;
  let jetT = 0; // Feature: jetpack boost timer
  let coinScore = 0;

  const addPlatform = (y: number): void => {
    const kindRoll = ctx.rng.next();
    const kind: Platform['kind'] = kindRoll < 0.15 ? 'break' : kindRoll < 0.35 ? 'moving' : 'normal';
    const x = ctx.rng.next() * (W - PW);
    const p: Platform = { x, y, w: PW, kind, vx: kind === 'moving' ? (ctx.rng.next() < 0.5 ? -60 : 60) : 0, used: false };
    platforms.push(p);
    if (ctx.rng.next() < 0.12) springs.push({ x: x + PW / 2, y: y - 8 });
    if (ctx.rng.next() < 0.22) coins.push({ x: x + PW / 2, y: y - 34, taken: false });
    if (ctx.rng.next() < 0.05) jetpacks.push({ x: x + PW / 2, y: y - 14 });
    if (height > 30 && ctx.rng.next() < 0.08) monsters.push({ x: x + PW / 2, y: y - 24, alive: true });
  };

  // initial platforms
  for (let y = H - 40; y > -H; y -= 70) addPlatform(y);
  // ensure a platform under the player
  platforms.push({ x: W / 2 - PW / 2, y: H - 60, w: PW, kind: 'normal', vx: 0, used: false });

  ctx.hud.setScore(0);
  ctx.hud.setLabel('TILT / ◀ ▶ · TAP=SHOOT');

  const burst = (x: number, y: number, color: number, n = 8): void => {
    for (let i = 0; i < n; i++) {
      const a = ctx.rng.next() * Math.PI * 2;
      const s = 40 + ctx.rng.next() * 90;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, color });
    }
  };

  const shoot = (): void => {
    if (over) return;
    bullets.push({ x: player.x, y: player.y - player.r });
    ctx.audio.sfx('shoot');
  };
  const offTap = ctx.input.on('tap', shoot);
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a') shoot();
  });

  const updateScore = (): void => ctx.hud.setScore(Math.max(0, height) + coinScore);

  const draw = (): void => {
    bgG.clear();
    bgG.rect(0, 0, W, H).fill({ color: 0x0a0a18 });
    for (const s of stars) {
      const sy = (s.y - camY * 0.3) % H;
      bgG.circle(s.x, (sy + H) % H, s.s).fill({ color: 0xffffff, alpha: 0.1 + s.s * 0.15 });
    }
    g.clear();
    platforms.forEach((p) => {
      const col = p.kind === 'break' ? 0xff7b00 : p.kind === 'moving' ? 0x00f7ff : 0x3ddc84;
      g.roundRect(p.x, p.y - camY, p.w, 12, 4).fill({ color: col, alpha: p.used && p.kind === 'break' ? 0.2 : 1 });
    });
    springs.forEach((s) => g.rect(s.x - 6, s.y - camY - 6, 12, 8).fill({ color: 0xffd200 }));
    jetpacks.forEach((j) => {
      g.roundRect(j.x - 6, j.y - camY - 8, 12, 16, 3).fill({ color: 0xff2e97 });
      g.poly([j.x - 4, j.y - camY + 8, j.x + 4, j.y - camY + 8, j.x, j.y - camY + 14]).fill({ color: 0xffd200 });
    });
    coins.forEach((c) => {
      if (c.taken) return;
      g.circle(c.x, c.y - camY, 7).fill({ color: 0xffd200 });
      g.circle(c.x, c.y - camY, 3.5).fill({ color: 0xfff0a0 });
    });
    monsters.forEach((m) => {
      if (!m.alive) return;
      g.roundRect(m.x - 12, m.y - camY - 10, 24, 20, 6).fill({ color: 0xb14cff });
      g.circle(m.x - 5, m.y - camY - 2, 3).fill({ color: 0xffffff });
      g.circle(m.x + 5, m.y - camY - 2, 3).fill({ color: 0xffffff });
    });
    bullets.forEach((b) => g.circle(b.x, b.y - camY, 4).fill({ color: 0xffffff }));
    for (const p of particles) g.circle(p.x, p.y - camY, 3 * Math.min(1, p.life * 2)).fill({ color: p.color, alpha: Math.min(1, p.life * 2) });
    // doodler with squash + jet flame
    const sq = player.squash;
    if (jetT > 0) g.poly([player.x - 6, player.y - camY + player.r, player.x + 6, player.y - camY + player.r, player.x, player.y - camY + player.r + 18]).fill({ color: 0xff7b00, alpha: 0.8 });
    g.ellipse(player.x, player.y - camY, player.r * (1 - sq * 0.3), player.r * (1 + sq * 0.3)).fill({ color: 0x9bffce });
    g.circle(player.x + 4, player.y - camY - 4, 3).fill({ color: 0x101018 });
  };

  return {
    update(dt) {
      if (over) return;
      const ax = ctx.input.axis().x;
      player.vx = ax * 280;
      if (jetT > 0) {
        jetT -= dt;
        player.vy = -780;
        if (ctx.rng.next() < 0.6) particles.push({ x: player.x, y: player.y + player.r, vx: (ctx.rng.next() - 0.5) * 40, vy: 120, life: 0.4, color: 0xff7b00 });
      } else {
        player.vy += GRAV * dt;
      }
      if (player.squash > 0) player.squash = Math.max(0, player.squash - dt * 4);
      player.x = wrap(player.x + player.vx * dt, W);
      player.y += player.vy * dt;

      // particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }

      // bullets travel up; hit monsters
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i]!;
        b.y -= 520 * dt;
        if (b.y - camY < -20) { bullets.splice(i, 1); continue; }
        for (const m of monsters) {
          if (m.alive && Math.abs(b.x - m.x) < 14 && Math.abs(b.y - m.y) < 14) {
            m.alive = false;
            bullets.splice(i, 1);
            coinScore += 50;
            updateScore();
            burst(m.x, m.y, 0xb14cff, 10);
            ctx.audio.sfx('explosion');
            break;
          }
        }
      }

      // platform movement
      platforms.forEach((p) => {
        if (p.kind === 'moving') {
          p.x += p.vx * dt;
          if (p.x < 0 || p.x > W - p.w) p.vx *= -1;
        }
      });

      // coin pickup
      for (const c of coins) {
        if (!c.taken && Math.abs(player.x - c.x) < 16 && Math.abs(player.y - c.y) < 16) {
          c.taken = true;
          coinScore += 20;
          updateScore();
          burst(c.x, c.y, 0xffd200, 6);
          ctx.audio.sfx('coin');
        }
      }
      // jetpack pickup
      for (let i = jetpacks.length - 1; i >= 0; i--) {
        const j = jetpacks[i]!;
        if (Math.abs(player.x - j.x) < 18 && Math.abs(player.y - j.y) < 18) {
          jetpacks.splice(i, 1);
          jetT = 1.6;
          ctx.audio.sfx('powerup');
          ctx.hud.toast('JETPACK!');
        }
      }
      // monster collision (lethal unless jetpacking)
      if (jetT <= 0) {
        for (const m of monsters) {
          if (m.alive && Math.abs(player.x - m.x) < player.r + 10 && Math.abs(player.y - m.y) < player.r + 8) {
            over = true;
            ctx.audio.sfx('gameover');
            ctx.gameOver(Math.max(0, height) + coinScore, { height });
            return;
          }
        }
      }

      // landing (only when falling)
      if (player.vy > 0) {
        for (const p of platforms) {
          if (
            player.x > p.x &&
            player.x < p.x + p.w &&
            player.y + player.r > p.y &&
            player.y + player.r < p.y + 18 &&
            !(p.kind === 'break' && p.used)
          ) {
            player.vy = JUMP;
            player.squash = 1;
            ctx.audio.sfx('jump');
            if (p.kind === 'break') p.used = true;
            break;
          }
        }
        for (const s of springs) {
          if (Math.abs(player.x - s.x) < 14 && player.y + player.r > s.y && player.y + player.r < s.y + 14) {
            player.vy = SPRING;
            player.squash = 1;
            ctx.audio.sfx('powerup');
          }
        }
      }

      // camera follows upward
      if (player.y - camY < H * 0.4) camY = player.y - H * 0.4;
      if (player.y < best) {
        best = player.y;
        height = Math.floor((H - 60 - best) / 10);
        updateScore();
      }

      // recycle off-screen entities, spawn new platforms above
      platforms = platforms.filter((p) => p.y - camY < H + 40);
      springs = springs.filter((s) => s.y - camY < H + 40);
      coins = coins.filter((c) => c.y - camY < H + 40);
      jetpacks = jetpacks.filter((j) => j.y - camY < H + 40);
      monsters = monsters.filter((m) => m.y - camY < H + 40);
      const topMost = Math.min(...platforms.map((p) => p.y));
      if (topMost - camY > -40) addPlatform(topMost - 70);

      // death: fall off the bottom
      if (player.y - camY > H + 30) {
        over = true;
        ctx.audio.sfx('gameover');
        ctx.gameOver(Math.max(0, height) + coinScore, { height });
        return;
      }
      draw();
    },
    destroy() {
      offTap();
      offDown();
      layer.destroy({ children: true });
    },
  };
}
