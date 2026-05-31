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

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const GRAV = 1400;
  const JUMP = -620;
  const SPRING = -1000;
  const PW = 56;

  const player = { x: W / 2, y: H - 120, vx: 0, vy: JUMP, r: 14 };
  let platforms: Platform[] = [];
  let springs: { x: number; y: number }[] = [];
  let height = 0;
  let camY = 0;
  let over = false;
  let best = H;

  const addPlatform = (y: number): void => {
    const kindRoll = ctx.rng.next();
    const kind: Platform['kind'] = kindRoll < 0.15 ? 'break' : kindRoll < 0.35 ? 'moving' : 'normal';
    const x = ctx.rng.next() * (W - PW);
    const p: Platform = { x, y, w: PW, kind, vx: kind === 'moving' ? (ctx.rng.next() < 0.5 ? -60 : 60) : 0, used: false };
    platforms.push(p);
    if (ctx.rng.next() < 0.12) springs.push({ x: x + PW / 2, y: y - 8 });
  };

  // initial platforms
  for (let y = H - 40; y > -H; y -= 70) addPlatform(y);
  // ensure a platform under the player
  platforms.push({ x: W / 2 - PW / 2, y: H - 60, w: PW, kind: 'normal', vx: 0, used: false });

  ctx.hud.setScore(0);
  ctx.hud.setLabel('TILT / ◀ ▶');

  const draw = (): void => {
    g.clear();
    platforms.forEach((p) => {
      const col = p.kind === 'break' ? 0xff7b00 : p.kind === 'moving' ? 0x00f7ff : 0x3ddc84;
      g.roundRect(p.x, p.y - camY, p.w, 12, 4).fill({ color: col, alpha: p.used && p.kind === 'break' ? 0.2 : 1 });
    });
    springs.forEach((s) => g.rect(s.x - 6, s.y - camY - 6, 12, 8).fill({ color: 0xffd200 }));
    // doodler
    g.circle(player.x, player.y - camY, player.r).fill({ color: 0x9bffce });
    g.circle(player.x + 4, player.y - camY - 4, 3).fill({ color: 0x101018 });
  };

  return {
    update(dt) {
      if (over) return;
      const ax = ctx.input.axis().x;
      player.vx = ax * 280;
      player.vy += GRAV * dt;
      player.x = wrap(player.x + player.vx * dt, W);
      player.y += player.vy * dt;

      // platform movement
      platforms.forEach((p) => {
        if (p.kind === 'moving') {
          p.x += p.vx * dt;
          if (p.x < 0 || p.x > W - p.w) p.vx *= -1;
        }
      });

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
            ctx.audio.sfx('jump');
            if (p.kind === 'break') p.used = true;
            break;
          }
        }
        for (const s of springs) {
          if (Math.abs(player.x - s.x) < 14 && player.y + player.r > s.y && player.y + player.r < s.y + 14) {
            player.vy = SPRING;
            ctx.audio.sfx('powerup');
          }
        }
      }

      // camera follows upward
      if (player.y - camY < H * 0.4) camY = player.y - H * 0.4;
      if (player.y < best) {
        best = player.y;
        height = Math.floor((H - 60 - best) / 10);
        ctx.hud.setScore(Math.max(0, height));
      }

      // recycle platforms that fell below the view, spawn new ones above
      platforms = platforms.filter((p) => p.y - camY < H + 40);
      springs = springs.filter((s) => s.y - camY < H + 40);
      const topMost = Math.min(...platforms.map((p) => p.y));
      if (topMost - camY > -40) addPlatform(topMost - 70);

      // death: fall off the bottom
      if (player.y - camY > H + 30) {
        over = true;
        ctx.audio.sfx('gameover');
        ctx.gameOver(Math.max(0, height), { height });
        return;
      }
      draw();
    },
    destroy() {
      layer.destroy({ children: true });
    },
  };
}
