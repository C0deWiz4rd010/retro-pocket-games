import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import { clamp } from '@utils/math';

interface Segment {
  col: number;
  row: number;
  dir: number; // 1 right, -1 left
  head: boolean;
}
interface Spider { x: number; y: number; vx: number; vy: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: number }

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const cols = 14;
  const cell = Math.floor(W / cols);
  const rows = Math.floor(H / cell);
  const ox = (W - cols * cell) / 2;
  const playerBandRows = 4;

  const layer = new Container();
  layer.position.set(ox, 0);
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const mushrooms = new Uint8Array(cols * rows);
  const mIdx = (c: number, r: number): number => r * cols + c;
  for (let i = 0; i < cols * rows * 0.12; i++) {
    const c = ctx.rng.int(0, cols - 1);
    const r = ctx.rng.int(1, rows - playerBandRows - 1);
    mushrooms[mIdx(c, r)] = 3;
  }

  let segments: Segment[] = [];
  const spawnCentipede = (len: number): void => {
    segments = [];
    for (let i = 0; i < len; i++) segments.push({ col: -i, row: 0, dir: 1, head: i === 0 });
  };

  const player = { col: Math.floor(cols / 2), row: rows - 1 };
  const bullets: { x: number; y: number }[] = [];
  const particles: Particle[] = [];
  let spider: Spider | null = null;
  let spiderTimer = 8;
  let doubleT = 0; // Feature: double-shot power-up
  let powerDrop: { x: number; y: number } | null = null;
  let score = 0;
  let lives = 3;
  let over = false;
  let moveAcc = 0;
  let level = 1;
  let shake = 0;

  const setLabel = (): void => ctx.hud.setLabel(`DEFEND · L${level}${doubleT > 0 ? ' ⋔' : ''}`);
  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  setLabel();

  const burst = (x: number, y: number, color: number, n = 8): void => {
    for (let i = 0; i < n; i++) {
      const a = ctx.rng.next() * Math.PI * 2;
      const s = 40 + ctx.rng.next() * 90;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.55, color });
    }
  };

  const loseLife = (): void => {
    lives--;
    shake = 0.5;
    burst(player.col * cell + cell / 2, player.row * cell + cell / 2, 0x00f7ff, 16);
    ctx.hud.setLives(lives);
    ctx.audio.sfx('hit');
    if (lives <= 0) {
      over = true;
      ctx.gameOver(score, { level });
    } else {
      spawnCentipede(10 + level);
      spider = null;
    }
  };
  spawnCentipede(10);

  const fire = (): void => {
    if (over) return;
    const max = doubleT > 0 ? 2 : 1;
    if (bullets.length >= max) return;
    bullets.push({ x: player.col * cell + cell / 2, y: player.row * cell });
    ctx.audio.sfx('shoot');
  };
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a') fire();
  });
  const offTap = ctx.input.on('tap', fire);

  const stepCentipede = (): void => {
    for (const s of segments) {
      let nc = s.col + s.dir;
      const blockedMush = nc >= 0 && nc < cols && mushrooms[mIdx(nc, s.row)]! > 0;
      if (nc < 0 || nc >= cols || blockedMush) {
        s.dir *= -1;
        s.row = Math.min(rows - 1, s.row + 1);
        nc = s.col + s.dir;
      }
      s.col = clamp(nc, 0, cols - 1);
    }
    if (segments.some((s) => s.row >= rows - 1)) loseLife();
  };

  const draw = (): void => {
    g.clear();
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const hp = mushrooms[mIdx(c, r)]!;
        if (hp > 0)
          g.roundRect(c * cell + 2, r * cell + 2, cell - 4, cell - 4, 4).fill({ color: 0x8bc34a, alpha: 0.4 + hp * 0.15 });
      }
    // particles
    for (const p of particles) g.circle(p.x, p.y, 3 * Math.min(1, p.life * 2)).fill({ color: p.color, alpha: Math.min(1, p.life * 2) });
    // power drop
    if (powerDrop) {
      g.roundRect(powerDrop.x - 8, powerDrop.y - 6, 16, 12, 3).fill({ color: 0xffd200 });
      g.roundRect(powerDrop.x - 8, powerDrop.y - 6, 16, 12, 3).stroke({ width: 1, color: 0xffffff, alpha: 0.6 });
    }
    segments.forEach((s) => {
      g.circle(s.col * cell + cell / 2, s.row * cell + cell / 2, cell * 0.4).fill({ color: s.head ? 0xff2e97 : 0xffd200 });
    });
    // spider
    if (spider) {
      g.circle(spider.x, spider.y, cell * 0.36).fill({ color: 0xb14cff });
      for (let k = -1; k <= 1; k += 2) {
        g.moveTo(spider.x, spider.y).lineTo(spider.x + k * cell * 0.5, spider.y - cell * 0.3).stroke({ width: 2, color: 0xb14cff });
        g.moveTo(spider.x, spider.y).lineTo(spider.x + k * cell * 0.5, spider.y + cell * 0.3).stroke({ width: 2, color: 0xb14cff });
      }
    }
    g.roundRect(player.col * cell + 3, player.row * cell + 3, cell - 6, cell - 6, 4).fill({ color: 0x00f7ff });
    bullets.forEach((b) => g.rect(b.x - 2, b.y, 4, 10).fill({ color: 0xffffff }));
  };

  return {
    update(dt) {
      if (over) return;
      const ax = ctx.input.axis();
      if (ax.x) player.col = clamp(player.col + Math.sign(ax.x), 0, cols - 1);
      if (ax.y) player.row = clamp(player.row + Math.sign(ax.y), rows - playerBandRows, rows - 1);

      if (doubleT > 0 && (doubleT -= dt) <= 0) setLabel();
      if (shake > 0) shake = Math.max(0, shake - dt * 2);

      // particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }

      // Feature: spider — roams the lower band, eats mushrooms, lethal on contact
      spiderTimer -= dt;
      if (!spider && spiderTimer <= 0) {
        spider = { x: ctx.rng.next() < 0.5 ? 0 : W - ox * 2, y: (rows - playerBandRows) * cell, vx: (ctx.rng.next() < 0.5 ? 1 : -1) * 90, vy: 90 };
        spiderTimer = 12 + ctx.rng.next() * 8;
      }
      if (spider) {
        spider.x += spider.vx * dt;
        spider.y += spider.vy * dt;
        const bandTop = (rows - playerBandRows) * cell;
        if (spider.y < bandTop || spider.y > rows * cell - cell / 2) spider.vy *= -1;
        if (spider.x < 0 || spider.x > cols * cell) spider.vx *= -1;
        const sc = Math.floor(spider.x / cell);
        const sr = Math.floor(spider.y / cell);
        if (sc >= 0 && sc < cols && sr >= 0 && sr < rows && mushrooms[mIdx(sc, sr)]! > 0 && ctx.rng.next() < 0.1) mushrooms[mIdx(sc, sr)] = 0;
        // contact with player
        if (Math.abs(spider.x - (player.col * cell + cell / 2)) < cell * 0.7 && Math.abs(spider.y - (player.row * cell + cell / 2)) < cell * 0.7) {
          spider = null;
          loseLife();
          if (over) return;
        }
      }

      // power drop falls + pickup
      if (powerDrop) {
        powerDrop.y += 110 * dt;
        if (powerDrop.y > rows * cell) powerDrop = null;
        else if (Math.abs(powerDrop.x - (player.col * cell + cell / 2)) < cell && Math.abs(powerDrop.y - (player.row * cell + cell / 2)) < cell) {
          doubleT = 12;
          powerDrop = null;
          ctx.audio.sfx('powerup');
          ctx.hud.toast('DOUBLE SHOT');
          setLabel();
        }
      }

      moveAcc += dt;
      const interval = Math.max(0.08, 0.22 - level * 0.01);
      if (moveAcc >= interval) {
        moveAcc = 0;
        stepCentipede();
        if (over) return;
      }

      for (let bi = bullets.length - 1; bi >= 0; bi--) {
        const bullet = bullets[bi]!;
        bullet.y -= 480 * dt;
        // spider hit
        if (spider && Math.hypot(bullet.x - spider.x, bullet.y - spider.y) < cell * 0.5) {
          score += 300;
          ctx.hud.setScore(score);
          ctx.hud.toast('SPIDER +300');
          burst(spider.x, spider.y, 0xb14cff, 14);
          if (!powerDrop && ctx.rng.next() < 0.5) powerDrop = { x: spider.x, y: spider.y };
          spider = null;
          bullets.splice(bi, 1);
          ctx.audio.sfx('explosion');
          continue;
        }
        const bc = Math.floor(bullet.x / cell);
        const br = Math.floor(bullet.y / cell);
        const hitIdx = segments.findIndex((s) => s.col === bc && s.row === br);
        if (hitIdx >= 0) {
          const seg = segments[hitIdx]!;
          mushrooms[mIdx(seg.col, seg.row)] = 2;
          burst(seg.col * cell + cell / 2, seg.row * cell + cell / 2, 0xffd200, 8);
          segments.splice(hitIdx, 1);
          if (segments[hitIdx]) segments[hitIdx]!.head = true;
          bullets.splice(bi, 1);
          score += 10;
          ctx.hud.setScore(score);
          ctx.audio.sfx('explosion');
        } else if (br >= 0 && br < rows && bc >= 0 && bc < cols && mushrooms[mIdx(bc, br)]! > 0) {
          mushrooms[mIdx(bc, br)]!--;
          if (mushrooms[mIdx(bc, br)] === 0) score += 1;
          bullets.splice(bi, 1);
          ctx.audio.sfx('blip');
        } else if (bullet.y < 0) {
          bullets.splice(bi, 1);
        }
      }

      if (segments.length === 0) {
        level++;
        setLabel();
        ctx.hud.toast(`LEVEL ${level}`);
        ctx.audio.sfx('powerup');
        spawnCentipede(10 + level);
      }
      const rmS = document.documentElement.classList.contains('a11y-reduced-motion') ? 0 : shake;
      layer.position.set(ox + (rmS > 0 ? (ctx.rng.next() * 2 - 1) * rmS * 6 : 0), rmS > 0 ? (ctx.rng.next() * 2 - 1) * rmS * 6 : 0);
      draw();
    },
    destroy() {
      offDown();
      offTap();
      layer.destroy({ children: true });
    },
  };
}
