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
  let coins: { x: number; y: number }[] = []; // Feature: collectible coins
  let powerups: { x: number; y: number }[] = []; // Feature: shield power-up
  let scrollX = 0;
  let gap = 200;
  let centre = H / 2;
  let score = 0;
  let bonus = 0;
  let dist = 0;
  let over = false;
  let rising = false;
  let shield = false;
  let invuln = 0;
  let zone = 1; // Feature: distance zone multiplier

  // initial cave
  for (let x = W; x < W * 2.5; x += 40) addSlice(x);

  function addSlice(x: number): void {
    centre += (ctx.rng.next() - 0.5) * 60;
    centre = Math.max(gap / 2 + 20, Math.min(H - gap / 2 - 20, centre));
    walls.push({ x, top: centre - gap / 2, bottom: centre + gap / 2 });
    if (ctx.rng.next() < 0.06) {
      const oh = 30 + ctx.rng.next() * 40;
      obstacles.push({ x, y: centre - oh / 2, w: 14, h: oh });
    } else if (ctx.rng.next() < 0.1) {
      coins.push({ x, y: centre + (ctx.rng.next() - 0.5) * gap * 0.5 });
    } else if (ctx.rng.next() < 0.025) {
      powerups.push({ x, y: centre });
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
    coins.forEach((c) => g.circle(c.x - scrollX, c.y, 7).fill({ color: 0xffd200 }));
    powerups.forEach((p) => { g.circle(p.x - scrollX, p.y, 11).stroke({ width: 3, color: 0x3ddc84 }); g.circle(p.x - scrollX, p.y, 5).fill({ color: 0x3ddc84 }); });
    if (shield || invuln > 0) g.circle(heli.x, heli.y, heli.r + 7).stroke({ width: 2, color: 0x3ddc84, alpha: 0.6 });
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

      if (invuln > 0) invuln -= dt;
      scrollX += SPEED * dt;
      dist += SPEED * dt;
      gap = Math.max(120, 200 - dist * 0.01);
      const nz = 1 + Math.floor(dist / 1500);
      if (nz > zone) { zone = nz; ctx.hud.toast(`ZONE ${zone} · x${zone}`); }
      score = Math.floor(dist / 10) * zone + bonus;
      ctx.hud.setScore(score);

      const lastX = walls.length ? walls[walls.length - 1]!.x : 0;
      if (lastX - scrollX < W + 60) addSlice(lastX + 40);
      walls = walls.filter((w) => w.x - scrollX > -50);
      obstacles = obstacles.filter((o) => o.x - scrollX > -30);

      // coin + power-up pickups
      coins = coins.filter((c) => {
        if (c.x - scrollX < -20) return false;
        if (Math.hypot(c.x - scrollX - heli.x, c.y - heli.y) < heli.r + 10) {
          bonus += 50 * zone;
          ctx.audio.sfx('coin');
          return false;
        }
        return true;
      });
      powerups = powerups.filter((p) => {
        if (p.x - scrollX < -20) return false;
        if (Math.hypot(p.x - scrollX - heli.x, p.y - heli.y) < heli.r + 12) {
          shield = true;
          ctx.hud.toast('SHIELD');
          ctx.audio.sfx('powerup');
          return false;
        }
        return true;
      });

      // collision against the cave + obstacles near the heli
      const here = walls.find((w) => Math.abs(w.x - scrollX - heli.x) < 24);
      const hitWall = here && (heli.y - heli.r < here.top || heli.y + heli.r > here.bottom);
      let hitObs = false;
      for (const o of obstacles) {
        const sx = o.x - scrollX;
        if (heli.x + heli.r > sx && heli.x - heli.r < sx + o.w && heli.y + heli.r > o.y && heli.y - heli.r < o.y + o.h) { hitObs = true; break; }
      }
      if ((hitWall || hitObs || heli.y < 0 || heli.y > H) && invuln <= 0) {
        if (shield) {
          shield = false;
          invuln = 1;
          heli.vy = LIFT; // bump away from the wall
          heli.y = Math.max(heli.r + 4, Math.min(H - heli.r - 4, heli.y));
          ctx.audio.sfx('powerup');
          ctx.fx.screenShake(6, 0.14);
        } else {
          return die();
        }
      }
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
