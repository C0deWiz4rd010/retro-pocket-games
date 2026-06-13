import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import { clamp } from '@utils/math';

const BRICK_COLORS = [0xff4d4d, 0xff7b00, 0xffd200, 0x3ddc84, 0x00f7ff];

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
interface Brick {
  x: number;
  y: number;
  c: number;
  hp: number;
}
type PowerKind = 'multi' | 'wide' | 'slow' | 'life' | 'laser';
interface Drop {
  x: number;
  y: number;
  kind: PowerKind;
}

interface Laser {
  x: number;
  y: number;
}

const POWER_META: Record<PowerKind, { color: number; label: string }> = {
  multi: { color: 0x00f7ff, label: 'MULTIBALL' },
  wide: { color: 0x3ddc84, label: 'WIDE PADDLE' },
  slow: { color: 0xffd200, label: 'SLOW' },
  life: { color: 0xff2e97, label: '+1 LIFE' },
  laser: { color: 0xff4d4d, label: 'LASER!' },
};

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const cols = 7;
  const brickW = (W - 20) / cols;
  const brickH = 18;
  const pad = { w: 70, h: 12, x: W / 2 - 35, y: H - 40, baseW: 70, wideT: 0 };
  let balls: Ball[] = [];
  let drops: Drop[] = [];
  let bricks: Brick[] = [];
  const lasers: Laser[] = [];
  let score = 0;
  let lives = 3;
  let level = 1;
  let over = false;
  let stuck = true;
  let slowT = 0;
  let laserT = 0;

  const buildBricks = (): void => {
    bricks = [];
    const rows = Math.min(3 + level, 6);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const hp = r === 0 && level > 2 ? 2 : 1;
        bricks.push({ x: 10 + c * brickW, y: 60 + r * (brickH + 6), c: BRICK_COLORS[r % BRICK_COLORS.length]!, hp });
      }
  };

  const resetBall = (): void => {
    stuck = true;
    balls = [{ x: pad.x + pad.w / 2, y: pad.y - 8, vx: 0, vy: 0 }];
  };

  const launch = (): void => {
    if (!stuck) return;
    const speed = 280 + level * 18;
    const b = balls[0]!;
    b.vx = (ctx.rng.next() < 0.5 ? -1 : 1) * speed * 0.5;
    b.vy = -speed;
    stuck = false;
    ctx.audio.sfx('blip');
  };

  buildBricks();
  resetBall();
  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('TAP TO LAUNCH');

  const offPtr = ctx.input.on('pointermove', ({ x }) => {
    pad.x = clamp(x - pad.w / 2, 0, W - pad.w);
    if (stuck && balls[0]) balls[0].x = pad.x + pad.w / 2;
  });
  const offTap = ctx.input.on('tap', () => launch());
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a') launch();
  });

  const maybeDrop = (x: number, y: number): void => {
    if (ctx.rng.next() > 0.16) return;
    const kinds: PowerKind[] = ['multi', 'wide', 'slow', 'life', 'laser'];
    drops.push({ x, y, kind: ctx.rng.pick(kinds) });
  };

  const applyPower = (kind: PowerKind): void => {
    ctx.audio.sfx('powerup');
    ctx.hud.toast(POWER_META[kind].label);
    if (kind === 'multi') {
      const extra: Ball[] = [];
      for (const b of balls) {
        const sp = Math.hypot(b.vx, b.vy) || 320;
        extra.push({ x: b.x, y: b.y, vx: sp * 0.4, vy: -Math.abs(sp * 0.9) });
        extra.push({ x: b.x, y: b.y, vx: -sp * 0.4, vy: -Math.abs(sp * 0.9) });
      }
      balls.push(...extra.slice(0, 4));
    } else if (kind === 'wide') {
      pad.wideT = 10;
      pad.w = pad.baseW * 1.6;
    } else if (kind === 'slow') {
      slowT = 7;
    } else if (kind === 'life') {
      lives++;
      ctx.hud.setLives(lives);
    } else if (kind === 'laser') {
      laserT = 10;
    }
  };

  const draw = (): void => {
    g.clear();
    bricks.forEach((b) =>
      g.roundRect(b.x, b.y, brickW - 4, brickH, 3).fill({ color: b.hp > 1 ? 0xffffff : b.c }),
    );
    drops.forEach((d) => {
      g.roundRect(d.x - 9, d.y - 6, 18, 12, 3).fill({ color: POWER_META[d.kind].color });
    });
    const padColor = laserT > 0 ? 0xff4d4d : pad.wideT > 0 ? 0x3ddc84 : 0x00f7ff;
    g.roundRect(pad.x, pad.y, pad.w, pad.h, 6).fill({ color: padColor });
    // laser cannons visual when active
    if (laserT > 0) {
      g.rect(pad.x + 3, pad.y - 5, 4, 6).fill({ color: 0xff4d4d });
      g.rect(pad.x + pad.w - 7, pad.y - 5, 4, 6).fill({ color: 0xff4d4d });
    }
    lasers.forEach((l) => g.rect(l.x - 2, l.y, 4, 12).fill({ color: 0xff4d4d, alpha: 0.9 }));
    balls.forEach((b) => g.circle(b.x, b.y, 6).fill({ color: 0xffffff }));
  };

  return {
    update(dt) {
      if (over) return;
      const sdt = dt * (slowT > 0 ? 0.6 : 1);
      if (slowT > 0) slowT -= dt;
      if (laserT > 0) {
        laserT -= dt;
        // auto-fire lasers from paddle edges
        if (Math.floor(laserT * 3) !== Math.floor((laserT + dt) * 3)) {
          lasers.push({ x: pad.x + 5, y: pad.y - 6 });
          lasers.push({ x: pad.x + pad.w - 5, y: pad.y - 6 });
          ctx.audio.sfx('shoot');
        }
      }
      // move lasers
      lasers.forEach((l) => (l.y -= 540 * dt));
      for (let li = lasers.length - 1; li >= 0; li--) {
        const l = lasers[li]!;
        if (l.y < -12) { lasers.splice(li, 1); continue; }
        let hit = false;
        for (let bi = 0; bi < bricks.length && !hit; bi++) {
          const b = bricks[bi]!;
          if (l.x > b.x && l.x < b.x + brickW && l.y > b.y && l.y < b.y + brickH) {
            b.hp--;
            if (b.hp <= 0) { bricks.splice(bi, 1); score += 10 * level; ctx.hud.setScore(score); maybeDrop(b.x + brickW / 2, b.y); }
            lasers.splice(li, 1);
            hit = true;
            ctx.audio.sfx('hit');
          }
        }
      }
      if (pad.wideT > 0) {
        pad.wideT -= dt;
        if (pad.wideT <= 0) pad.w = pad.baseW;
      }

      const moveX = ctx.input.axis().x;
      if (moveX) pad.x = clamp(pad.x + moveX * 360 * dt, 0, W - pad.w);

      if (stuck) {
        if (balls[0]) balls[0].x = pad.x + pad.w / 2;
        draw();
        return;
      }

      for (const ball of balls) {
        ball.x += ball.vx * sdt;
        ball.y += ball.vy * sdt;
        if (ball.x < 6) {
          ball.x = 6;
          ball.vx = Math.abs(ball.vx);
        } else if (ball.x > W - 6) {
          ball.x = W - 6;
          ball.vx = -Math.abs(ball.vx);
        }
        if (ball.y < 6) {
          ball.y = 6;
          ball.vy = Math.abs(ball.vy);
        }
        if (
          ball.vy > 0 &&
          ball.y + 6 >= pad.y &&
          ball.y < pad.y + pad.h &&
          ball.x >= pad.x &&
          ball.x <= pad.x + pad.w
        ) {
          const hit = (ball.x - (pad.x + pad.w / 2)) / (pad.w / 2);
          const speed = Math.hypot(ball.vx, ball.vy);
          ball.vx = hit * speed * 0.8;
          ball.vy = -Math.abs(speed * 0.7) - 40;
          ctx.audio.sfx('blip');
        }
        for (let i = 0; i < bricks.length; i++) {
          const b = bricks[i]!;
          if (ball.x > b.x && ball.x < b.x + brickW && ball.y > b.y && ball.y < b.y + brickH) {
            ball.vy = -ball.vy;
            b.hp--;
            if (b.hp <= 0) {
              bricks.splice(i, 1);
              score += 10 * level;
              ctx.hud.setScore(score);
              maybeDrop(b.x + brickW / 2, b.y);
            }
            ctx.audio.sfx('hit');
            break;
          }
        }
      }

      balls = balls.filter((b) => b.y <= H + 20);
      if (balls.length === 0) {
        lives--;
        ctx.hud.setLives(lives);
        ctx.audio.sfx('explosion');
        if (lives <= 0) {
          over = true;
          ctx.gameOver(score, { level });
          return;
        }
        resetBall();
      }

      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]!;
        d.y += 120 * dt;
        if (d.y > H) {
          drops.splice(i, 1);
          continue;
        }
        if (d.y > pad.y && d.x > pad.x && d.x < pad.x + pad.w) {
          drops.splice(i, 1);
          applyPower(d.kind);
        }
      }

      if (!bricks.length) {
        level++;
        ctx.hud.setLabel(`LEVEL ${level}`);
        ctx.audio.sfx('powerup');
        drops = [];
        buildBricks();
        resetBall();
      }
      draw();
    },
    destroy() {
      offPtr();
      offTap();
      offDown();
      layer.destroy({ children: true });
    },
  };
}
