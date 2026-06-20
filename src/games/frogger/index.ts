import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action, Dir } from '@core/InputManager';

type MoverKind = 'car' | 'log' | 'turtle';
interface Mover {
  x: number;
  w: number;
  lane: number;
  speed: number;
  log: boolean; // rideable (log or surfaced turtle)
  kind: MoverKind;
  phase: number; // turtle dive phase offset
}
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: number }

const DIRS: Record<string, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const rows = 14;
  const cell = Math.floor(H / rows);
  const cols = Math.floor(W / cell);
  const ox = (W - cols * cell) / 2;

  const layer = new Container();
  layer.position.set(ox, 0);
  ctx.stage.addChild(layer);
  const bgG = new Graphics();
  const g = new Graphics();
  layer.addChild(bgG, g);

  const riverRows = [1, 2, 3, 4, 5];
  const roadRows = [7, 8, 9, 10, 11, 12];

  let level = 1;
  const movers: Mover[] = [];
  const buildMovers = (): void => {
    movers.length = 0;
    for (const lane of [...riverRows, ...roadRows]) {
      const isRiver = riverRows.includes(lane);
      const dir = lane % 2 === 0 ? 1 : -1;
      const speed = (0.8 + ctx.rng.next() * 1.4) * dir * cell * (1 + (level - 1) * 0.12);
      // Feature: some river lanes are diving turtles
      const turtle = isRiver && ctx.rng.next() < 0.4;
      const kind: MoverKind = isRiver ? (turtle ? 'turtle' : 'log') : 'car';
      const w = isRiver ? cell * (turtle ? 2 : 2 + Math.floor(ctx.rng.next() * 2)) : cell * 1.4;
      const count = 3;
      for (let i = 0; i < count; i++)
        movers.push({ x: (cols / count) * i * cell + ctx.rng.next() * cell, w, lane, speed, log: isRiver, kind, phase: ctx.rng.next() * Math.PI * 2 });
    }
  };
  buildMovers();

  const frog = { col: Math.floor(cols / 2), row: rows - 1, facing: 'up' as Dir };
  const homes = [false, false, false, false, false];
  const particles: Particle[] = [];
  let score = 0;
  let lives = 3;
  let frogX = frog.col * cell;
  let time = 30; // Feature: per-life countdown
  const maxTime = 30;
  let flySlot: number | null = null; // Feature: bonus fly in a home slot
  let flyTtl = 0;
  let t = 0;

  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('GET HOME · BEAT THE CLOCK');

  // A surfaced turtle is rideable; it submerges on a sine cycle.
  const surfaced = (m: Mover): boolean => m.kind !== 'turtle' || Math.sin(t * 1.6 + m.phase) > -0.4;

  const reset = (): void => {
    frog.col = Math.floor(cols / 2);
    frog.row = rows - 1;
    frog.facing = 'up';
    frogX = frog.col * cell;
    time = maxTime;
  };

  const burst = (cx: number, cy: number, color: number, n = 8): void => {
    for (let i = 0; i < n; i++) {
      const a = ctx.rng.next() * Math.PI * 2;
      const s = 30 + ctx.rng.next() * 70;
      particles.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6, color });
    }
  };

  const die = (): void => {
    lives--;
    ctx.hud.setLives(lives);
    burst(frogX + cell / 2, frog.row * cell + cell / 2, 0x9bffce, 12);
    ctx.audio.sfx('hit');
    if (lives <= 0) ctx.gameOver(score, { homes: homes.filter(Boolean).length, level });
    else reset();
  };

  const maybeSpawnFly = (): void => {
    if (flySlot !== null) return;
    const empties = homes.map((h, i) => (h ? -1 : i)).filter((i) => i >= 0);
    if (empties.length && ctx.rng.next() < 0.5) {
      flySlot = empties[Math.floor(ctx.rng.next() * empties.length)]!;
      flyTtl = 5;
    }
  };

  const hop = (a: Action | Dir): void => {
    const d = DIRS[a];
    if (!d) return;
    if (a === 'up' || a === 'down' || a === 'left' || a === 'right') frog.facing = a;
    frog.col = Math.max(0, Math.min(cols - 1, frog.col + d.x));
    frog.row = Math.max(0, Math.min(rows - 1, frog.row + d.y));
    frogX = frog.col * cell;
    if (d.y < 0) score += 2;
    ctx.audio.sfx('jump');
    ctx.hud.setScore(score);
  };
  const offDown = ctx.input.on('down', hop);
  const offSwipe = ctx.input.on('swipe', hop);

  const draw = (): void => {
    bgG.clear();
    for (let r = 0; r < rows; r++) {
      let col = 0x14141f;
      if (r === 0) col = 0x1d3b1d;
      else if (riverRows.includes(r)) col = 0x16335a;
      else if (roadRows.includes(r)) col = 0x1a1a22;
      else if (r === 6 || r === rows - 1) col = 0x24402a;
      bgG.rect(0, r * cell, cols * cell, cell).fill({ color: col });
      // water shimmer
      if (riverRows.includes(r)) {
        for (let x = 0; x < cols; x++) {
          const a = 0.05 + 0.05 * Math.sin(t * 2 + x + r);
          bgG.rect(x * cell, r * cell + cell * 0.4, cell, 2).fill({ color: 0x3a6ea5, alpha: a });
        }
      }
    }
    for (let i = 0; i < 5; i++) {
      const hx = (i + 0.5) * (cols / 5) * cell;
      bgG.roundRect(hx - cell * 0.4, 2, cell * 0.8, cell - 4, 4).fill({ color: homes[i] ? 0x3ddc84 : 0x0d1f0d });
      if (flySlot === i) bgG.circle(hx, cell / 2, cell * 0.18).fill({ color: 0xffd200 });
    }
    g.clear();
    movers.forEach((m) => {
      if (m.kind === 'turtle') {
        const up = surfaced(m);
        const segs = Math.round(m.w / cell);
        for (let s = 0; s < segs; s++) {
          g.circle(m.x + cell * (s + 0.5), m.lane * cell + cell / 2, cell * 0.38).fill({ color: up ? 0x2e9e6b : 0x16335a, alpha: up ? 1 : 0.35 });
        }
      } else {
        g.roundRect(m.x, m.lane * cell + 4, m.w, cell - 8, 5).fill({ color: m.kind === 'log' ? 0x8a5a2b : 0xff5252 });
        if (m.kind === 'car') g.rect(m.x + 4, m.lane * cell + cell * 0.3, m.w - 8, 3).fill({ color: 0xffd200, alpha: 0.7 });
      }
    });
    // particles
    particles.forEach((p) => g.circle(p.x, p.y, 3 * Math.min(1, p.life * 2)).fill({ color: p.color, alpha: Math.min(1, p.life * 2) }));
    // frog with eyes
    const fx = frogX + 4, fy = frog.row * cell + 4, fs = cell - 8;
    g.roundRect(fx, fy, fs, fs, 6).fill({ color: 0x9bffce });
    const ed = DIRS[frog.facing]!;
    const ecx = fx + fs / 2 + ed.x * fs * 0.2;
    const ecy = fy + fs / 2 + ed.y * fs * 0.2;
    g.circle(ecx - 3, ecy - 3, 2).fill({ color: 0x0a0a12 });
    g.circle(ecx + 3, ecy - 3, 2).fill({ color: 0x0a0a12 });
    // timer bar
    const tw = (cols * cell) * (time / maxTime);
    g.rect(0, rows * cell - 4, cols * cell, 4).fill({ color: 0x000000, alpha: 0.4 });
    g.rect(0, rows * cell - 4, tw, 4).fill({ color: time < 8 ? 0xff4d4d : 0x3ddc84 });
  };

  return {
    update(dt) {
      t += dt;
      time -= dt;
      if (time <= 0) {
        ctx.audio.sfx('explosion');
        return die();
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }

      if (flySlot !== null) {
        flyTtl -= dt;
        if (flyTtl <= 0 || homes[flySlot]) flySlot = null;
      } else if (ctx.rng.next() < dt * 0.25) {
        maybeSpawnFly();
      }

      movers.forEach((m) => {
        m.x += m.speed * dt;
        if (m.speed > 0 && m.x > cols * cell) m.x = -m.w;
        if (m.speed < 0 && m.x < -m.w) m.x = cols * cell;
      });

      if (riverRows.includes(frog.row)) {
        const ride = movers.find(
          (m) => m.log && surfaced(m) && m.lane === frog.row && frogX + cell / 2 > m.x && frogX + cell / 2 < m.x + m.w,
        );
        if (ride) {
          frogX += ride.speed * dt;
          if (frogX < -cell || frogX > cols * cell) return die();
          frog.col = Math.round(frogX / cell);
        } else {
          ctx.audio.sfx('explosion');
          return die();
        }
      } else if (roadRows.includes(frog.row)) {
        const hit = movers.some(
          (m) => !m.log && m.lane === frog.row && frogX + cell * 0.7 > m.x && frogX + cell * 0.3 < m.x + m.w,
        );
        if (hit) return die();
      } else if (frog.row === 0) {
        const slot = Math.floor((frogX / (cols * cell)) * 5);
        if (slot >= 0 && slot < 5 && !homes[slot]) {
          homes[slot] = true;
          let gained = 50 + Math.ceil(time) * 3; // Feature: time bonus
          if (flySlot === slot) {
            gained += 100;
            flySlot = null;
            ctx.hud.toast('FLY BONUS +100');
          }
          score += gained;
          ctx.hud.setScore(score);
          burst((slot + 0.5) * (cols / 5) * cell, cell / 2, 0x3ddc84, 14);
          ctx.audio.sfx('powerup');
          ctx.hud.toast(`HOME +${gained}`);
          if (homes.every(Boolean)) {
            ctx.audio.sfx('levelup');
            homes.fill(false);
            level++;
            score += 200;
            ctx.hud.toast(`LEVEL ${level}!`);
            buildMovers();
          }
          reset();
        } else {
          return die();
        }
      }
      draw();
    },
    destroy() {
      offDown();
      offSwipe();
      layer.destroy({ children: true });
    },
  };
}
