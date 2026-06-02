import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import { clamp } from '@utils/math';

interface Meteor {
  x: number;
  y: number;
  r: number;
  vy: number;
}

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const player = { x: W / 2, y: H - 50, r: 12 };
  let meteors: Meteor[] = [];
  const stars: { x: number; y: number; s: number }[] = [];
  for (let i = 0; i < 40; i++) stars.push({ x: ctx.rng.next() * W, y: ctx.rng.next() * H, s: ctx.rng.next() * 2 + 0.5 });
  let score = 0;
  let elapsed = 0;
  let spawnAcc = 0;
  let over = false;

  ctx.hud.setScore(0);
  ctx.hud.setLabel('DODGE!');

  const offPtr = ctx.input.on('pointermove', ({ x }) => {
    player.x = clamp(x, player.r, W - player.r);
  });

  const draw = (): void => {
    g.clear();
    stars.forEach((s) => g.circle(s.x, s.y, s.s).fill({ color: 0xffffff, alpha: 0.4 }));
    meteors.forEach((m) => {
      g.circle(m.x, m.y, m.r).fill({ color: 0xff7043 });
      g.circle(m.x - m.r * 0.3, m.y - m.r * 0.3, m.r * 0.4).fill({ color: 0xffd200, alpha: 0.6 });
    });
    g.poly([player.x, player.y - player.r, player.x - player.r, player.y + player.r, player.x + player.r, player.y + player.r]).fill({ color: 0x00f7ff });
  };

  return {
    update(dt) {
      if (over) return;
      elapsed += dt;
      score = Math.floor(elapsed * 10);
      ctx.hud.setScore(score);

      const ax = ctx.input.axis().x;
      if (ax) player.x = clamp(player.x + ax * 320 * dt, player.r, W - player.r);

      stars.forEach((s) => {
        s.y += s.s * 30 * dt;
        if (s.y > H) s.y = 0;
      });

      spawnAcc += dt;
      const rate = Math.max(0.2, 0.7 - elapsed * 0.01);
      if (spawnAcc >= rate) {
        spawnAcc = 0;
        const r = 8 + ctx.rng.next() * 16;
        meteors.push({ x: ctx.rng.next() * W, y: -r, r, vy: 120 + ctx.rng.next() * 120 + elapsed * 4 });
      }

      for (const m of meteors) {
        m.y += m.vy * dt;
        if (Math.hypot(m.x - player.x, m.y - player.y) < m.r + player.r * 0.7) {
          over = true;
          ctx.audio.sfx('explosion');
          ctx.gameOver(score, { time: Math.floor(elapsed) });
          return;
        }
      }
      meteors = meteors.filter((m) => m.y < H + 30);
      draw();
    },
    destroy() {
      offPtr();
      layer.destroy({ children: true });
    },
  };
}
