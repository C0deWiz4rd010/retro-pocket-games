import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

interface Wall {
  x: number;
  top: number;
  bottom: number;
}

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const GRAV = 900;
  const LIFT = -520;
  const SPEED = 160;

  const heli = { x: W * 0.3, y: H / 2, vy: 0, r: 10 };
  let walls: Wall[] = [];
  let obstacles: { x: number; y: number; w: number; h: number }[] = [];
  let scrollX = 0;
  let gap = 200;
  let centre = H / 2;
  let score = 0;
  let dist = 0;
  let over = false;
  let rising = false;

  // initial cave
  for (let x = W; x < W * 2.5; x += 40) addSlice(x);

  function addSlice(x: number): void {
    centre += (ctx.rng.next() - 0.5) * 60;
    centre = Math.max(gap / 2 + 20, Math.min(H - gap / 2 - 20, centre));
    walls.push({ x, top: centre - gap / 2, bottom: centre + gap / 2 });
    if (ctx.rng.next() < 0.06) {
      const oh = 30 + ctx.rng.next() * 40;
      obstacles.push({ x, y: centre - oh / 2, w: 14, h: oh });
    }
  }

  ctx.hud.setScore(0);
  ctx.hud.setLabel('TAP TO RISE');

  const press = (): void => {
    rising = true;
  };
  const release = (): void => {
    rising = false;
  };
  const offDownPtr = ctx.input.on('pointermove', ({ down }) => {
    rising = down;
  });
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a' || a === 'up') press();
  });
  const offUp = ctx.input.on('up', (a) => {
    if (a === 'a' || a === 'up') release();
  });

  const draw = (): void => {
    g.clear();
    walls.forEach((w) => {
      const sx = w.x - scrollX;
      g.rect(sx, 0, 42, w.top).fill({ color: 0x2a3d2a });
      g.rect(sx, w.bottom, 42, H - w.bottom).fill({ color: 0x2a3d2a });
    });
    obstacles.forEach((o) => g.rect(o.x - scrollX, o.y, o.w, o.h).fill({ color: 0xff4d4d }));
    g.roundRect(heli.x - heli.r, heli.y - heli.r * 0.6, heli.r * 2, heli.r * 1.2, 4).fill({ color: 0x26c6da });
    g.rect(heli.x - heli.r * 1.4, heli.y - heli.r, heli.r * 2.8, 2).fill({ color: 0xffffff });
  };

  return {
    update(dt) {
      if (over) return;
      heli.vy += GRAV * dt;
      if (rising) heli.vy += LIFT * dt * 3;
      heli.vy = Math.max(-380, Math.min(500, heli.vy));
      heli.y += heli.vy * dt;

      scrollX += SPEED * dt;
      dist += SPEED * dt;
      gap = Math.max(120, 200 - dist * 0.01);
      score = Math.floor(dist / 10);
      ctx.hud.setScore(score);

      const lastX = walls.length ? walls[walls.length - 1]!.x : 0;
      if (lastX - scrollX < W + 60) addSlice(lastX + 40);
      walls = walls.filter((w) => w.x - scrollX > -50);
      obstacles = obstacles.filter((o) => o.x - scrollX > -30);

      // collision against the cave + obstacles near the heli
      const here = walls.find((w) => Math.abs(w.x - scrollX - heli.x) < 24);
      if (here && (heli.y - heli.r < here.top || heli.y + heli.r > here.bottom)) {
        return die();
      }
      for (const o of obstacles) {
        const sx = o.x - scrollX;
        if (heli.x + heli.r > sx && heli.x - heli.r < sx + o.w && heli.y + heli.r > o.y && heli.y - heli.r < o.y + o.h) {
          return die();
        }
      }
      if (heli.y < 0 || heli.y > H) return die();
      draw();
    },
    destroy() {
      offDownPtr();
      offDown();
      offUp();
      layer.destroy({ children: true });
    },
  };

  function die(): void {
    over = true;
    ctx.audio.sfx('explosion');
    ctx.gameOver(score, { dist: Math.floor(dist) });
  }
}
