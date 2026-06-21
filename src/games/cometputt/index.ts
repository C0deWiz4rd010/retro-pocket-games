import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

/**
 * Comet Putt — an original gravity mini-golf. Tap where you want to aim and the comet is
 * flung that way; gravity, walls and neon bumpers do the rest. Sink it in the glowing ring to
 * score. Twists: collectible stars, a fewer-strokes par bonus, and bouncy bumpers. A shared
 * clock keeps every hole tense.
 */
interface Star { x: number; y: number; taken: boolean }
interface Bumper { x: number; y: number; r: number; flash: number }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: number }

const GOLD = 0xffd200;
const CYAN = 0x22d3ee;

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const wall = 8;
  const groundY = H - 40;

  const layer = new Container();
  const g = new Graphics();
  layer.addChild(g);
  ctx.stage.addChild(layer);

  const ball = { x: W * 0.2, y: groundY - 10, vx: 0, vy: 0, r: 9, moving: false };
  let hole = { x: W * 0.78, y: H * 0.4 };
  const stars: Star[] = [];
  const bumpers: Bumper[] = [];
  const sparks: Spark[] = [];
  let score = 0;
  let strokes = 0;
  let holeNo = 1;
  let time = 70;
  let over = false;
  let t = 0;

  ctx.hud.setScore(0);
  const setLabel = (): void => ctx.hud.setLabel(`HOLE ${holeNo} · ${strokes} strokes`);
  setLabel();

  const burst = (x: number, y: number, color: number, n = 10): void => {
    for (let i = 0; i < n; i++) {
      const a = ctx.rng.next() * Math.PI * 2;
      const s = 40 + ctx.rng.next() * 130;
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6, color });
    }
  };

  const layoutHole = (): void => {
    hole = { x: W * (0.45 + ctx.rng.next() * 0.4), y: H * (0.2 + ctx.rng.next() * 0.4) };
    stars.length = 0;
    for (let i = 0; i < 3; i++) stars.push({ x: 40 + ctx.rng.next() * (W - 80), y: 80 + ctx.rng.next() * (H * 0.55), taken: false });
    bumpers.length = 0;
    const nb = 1 + Math.floor(holeNo / 2);
    for (let i = 0; i < Math.min(3, nb); i++) bumpers.push({ x: 60 + ctx.rng.next() * (W - 120), y: H * (0.35 + ctx.rng.next() * 0.3), r: 18, flash: 0 });
    strokes = 0;
    setLabel();
  };
  layoutHole();

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (over || ball.moving) return;
    const dx = x - ball.x, dy = y - ball.y;
    const power = Math.min(720, Math.hypot(dx, dy) * 2.4);
    const a = Math.atan2(dy, dx);
    ball.vx = Math.cos(a) * power;
    ball.vy = Math.sin(a) * power;
    ball.moving = true;
    strokes++;
    setLabel();
    ctx.audio.sfx('shoot');
  });

  const sink = (): void => {
    const parBonus = Math.max(0, 500 - (strokes - 1) * 120);
    const timeBonus = Math.floor(time * 8);
    score += 300 + parBonus + timeBonus;
    time = Math.min(90, time + 8);
    ctx.hud.setScore(score);
    ctx.hud.toast(strokes <= 1 ? `HOLE IN ONE! +${300 + parBonus}` : `SUNK! +${300 + parBonus}`);
    ctx.audio.sfx('levelup');
    burst(hole.x, hole.y, GOLD, 18);
    ctx.fx.screenShake(5, 0.14);
    holeNo++;
    ball.vx = ball.vy = 0;
    ball.moving = false;
    layoutHole();
  };

  const draw = (): void => {
    g.clear();
    g.rect(0, 0, W, H).fill({ color: 0x071a12 });
    // arena walls + ground
    g.rect(0, 0, W, wall).fill({ color: 0x123b2a });
    g.rect(0, H - wall, W, wall).fill({ color: 0x123b2a });
    g.rect(0, 0, wall, H).fill({ color: 0x123b2a });
    g.rect(W - wall, 0, wall, H).fill({ color: 0x123b2a });
    g.rect(0, groundY, W, 2).fill({ color: 0x3ddc84, alpha: 0.4 });
    // bumpers
    for (const b of bumpers) {
      g.circle(b.x, b.y, b.r).fill({ color: b.flash > 0 ? 0xffffff : 0xff2e97 });
      g.circle(b.x, b.y, b.r * 0.5).fill({ color: GOLD });
    }
    // stars
    for (const s of stars) { if (!s.taken) g.star(s.x, s.y, 5, 9, 4).fill({ color: GOLD }); }
    // hole
    const hr = 16 + Math.sin(t * 5) * 2;
    g.circle(hole.x, hole.y, hr).stroke({ width: 3, color: CYAN });
    g.circle(hole.x, hole.y, hr * 0.5).fill({ color: CYAN, alpha: 0.35 });
    // aim hint when at rest
    if (!ball.moving && !over) g.circle(ball.x, ball.y, ball.r + 6 + Math.sin(t * 6) * 2).stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });
    // sparks
    for (const s of sparks) g.circle(s.x, s.y, 3 * Math.min(1, s.life * 2)).fill({ color: s.color, alpha: Math.min(1, s.life * 2) });
    // ball
    g.circle(ball.x, ball.y, ball.r).fill({ color: 0xf8fafc });
    g.circle(ball.x - 3, ball.y - 3, 3).fill({ color: CYAN, alpha: 0.6 });
  };

  return {
    update(dt) {
      if (over) return;
      t += dt;
      time -= dt;
      if (time <= 0) { over = true; ctx.audio.sfx('gameover'); ctx.gameOver(score, { holes: holeNo - 1 }); return; }
      ctx.hud.setLabel(`HOLE ${holeNo} · ${strokes} · ${Math.ceil(time)}s`);

      for (const b of bumpers) if (b.flash > 0) b.flash -= dt;

      if (ball.moving) {
        ball.vy += 900 * dt;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        // walls
        if (ball.x < wall + ball.r) { ball.x = wall + ball.r; ball.vx = Math.abs(ball.vx) * 0.72; }
        if (ball.x > W - wall - ball.r) { ball.x = W - wall - ball.r; ball.vx = -Math.abs(ball.vx) * 0.72; }
        if (ball.y < wall + ball.r) { ball.y = wall + ball.r; ball.vy = Math.abs(ball.vy) * 0.72; }
        if (ball.y > groundY - ball.r) { ball.y = groundY - ball.r; ball.vy = -Math.abs(ball.vy) * 0.62; ball.vx *= 0.86; }
        // bumpers
        for (const b of bumpers) {
          const d = Math.hypot(ball.x - b.x, ball.y - b.y);
          if (d < b.r + ball.r) {
            const nx = (ball.x - b.x) / d, ny = (ball.y - b.y) / d;
            ball.x = b.x + nx * (b.r + ball.r);
            ball.y = b.y + ny * (b.r + ball.r);
            const sp = Math.max(260, Math.hypot(ball.vx, ball.vy));
            ball.vx = nx * sp; ball.vy = ny * sp;
            b.flash = 0.15;
            ctx.audio.sfx('blip');
            burst(ball.x, ball.y, 0xff2e97, 5);
          }
        }
        // stars
        for (const s of stars) {
          if (!s.taken && Math.hypot(ball.x - s.x, ball.y - s.y) < ball.r + 11) {
            s.taken = true;
            score += 100;
            ctx.hud.setScore(score);
            ctx.audio.sfx('coin');
            burst(s.x, s.y, GOLD, 6);
          }
        }
        // hole
        if (Math.hypot(ball.x - hole.x, ball.y - hole.y) < 14 && Math.hypot(ball.vx, ball.vy) < 520) { sink(); return; }
        // rest
        if (Math.hypot(ball.vx, ball.vy) < 28 && ball.y > groundY - ball.r - 2) { ball.moving = false; ball.vx = 0; ball.vy = 0; }
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]!;
        s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 200 * dt; s.life -= dt;
        if (s.life <= 0) sparks.splice(i, 1);
      }

      draw();
    },
    destroy() {
      offTap();
      layer.destroy({ children: true });
    },
  };
}
