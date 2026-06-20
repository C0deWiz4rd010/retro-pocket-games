import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

interface Slice {
  cx: number;
  half: number;
}

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const sliceH = 10;
  const sliceCount = Math.ceil(H / sliceH) + 2;
  const slices: Slice[] = [];
  let centre = W / 2;
  let half = W * 0.34;
  for (let i = 0; i < sliceCount; i++) slices.push({ cx: centre, half });

  const ship = { x: W / 2, y: H * 0.72, r: 9 };
  const items: { x: number; y: number; kind: 'coin' | 'shield' }[] = []; // Feature: coins + shield
  let vx = 0;
  let scroll = 0;
  let speed = 180;
  let dist = 0;
  let over = false;
  let steer = 0; // -1 left, 1 right
  let shield = false;
  let invuln = 0;
  let zone = 1; // Feature: distance zone multiplier
  let bonus = 0;
  let spawnAcc = 0;

  ctx.hud.setScore(0);
  ctx.hud.setLabel('HOLD TO STEER');

  const offDown = ctx.input.on('down', (a) => {
    if (a === 'left') steer = -1;
    else if (a === 'right') steer = 1;
  });
  const offUp = ctx.input.on('up', (a) => {
    if ((a === 'left' && steer < 0) || (a === 'right' && steer > 0)) steer = 0;
  });
  const offPtr = ctx.input.on('pointermove', ({ x, down }) => {
    if (down) steer = x < W / 2 ? -1 : 1;
    else steer = 0;
  });

  const advance = (): void => {
    // shift slices down, add a new one on top following a wandering centre
    centre += (ctx.rng.next() - 0.5) * 40;
    centre = Math.max(half + 10, Math.min(W - half - 10, centre));
    half = Math.max(W * 0.14, half - 0.06);
    slices.pop();
    slices.unshift({ cx: centre, half });
  };

  const draw = (): void => {
    g.clear();
    // interpolate wall color from dark-blue → purple → deep-red as speed increases
    const t = Math.min(1, (speed - 180) / 280);
    const r = Math.floor(0x1d + t * (0x3d - 0x1d));
    const gv = Math.floor(0x1d * (1 - t));
    const bv = Math.floor(0x4e * (1 - t));
    const wallColor = (r << 16) | (gv << 8) | bv;
    slices.forEach((s, i) => {
      const y = i * sliceH - (scroll % sliceH);
      g.rect(0, y, s.cx - s.half, sliceH + 1).fill({ color: wallColor });
      g.rect(s.cx + s.half, y, W - (s.cx + s.half), sliceH + 1).fill({ color: wallColor });
    });
    for (const it of items) {
      if (it.kind === 'coin') g.circle(it.x, it.y, 7).fill({ color: 0xffd200 });
      else { g.circle(it.x, it.y, 10).stroke({ width: 3, color: 0x3ddc84 }); g.circle(it.x, it.y, 4).fill({ color: 0x3ddc84 }); }
    }
    if (shield || invuln > 0) g.circle(ship.x, ship.y, ship.r + 6).stroke({ width: 2, color: 0x3ddc84, alpha: 0.6 });
    g.poly([ship.x, ship.y - ship.r, ship.x - ship.r, ship.y + ship.r, ship.x + ship.r, ship.y + ship.r]).fill({ color: 0x42a5f5 });
    g.circle(ship.x, ship.y + 2, 3).fill({ color: 0x00f7ff });
  };

  return {
    update(dt) {
      if (over) return;
      speed += dt * 6;
      dist += speed * dt;
      if (invuln > 0) invuln -= dt;
      const nz = 1 + Math.floor(dist / 1800);
      if (nz > zone) { zone = nz; ctx.hud.toast(`ZONE ${zone} · x${zone}`); }
      ctx.hud.setScore(Math.floor(dist / 10) * zone + bonus);

      // smooth steering
      const targetVx = steer * 260;
      vx += (targetVx - vx) * Math.min(1, dt * 10);
      ship.x = Math.max(ship.r, Math.min(W - ship.r, ship.x + vx * dt));

      scroll += speed * dt;
      while (scroll >= sliceH) {
        scroll -= sliceH;
        advance();
      }

      // spawn + move items
      spawnAcc += dt;
      if (spawnAcc >= 1.1) {
        spawnAcc = 0;
        const top = slices[0]!;
        items.push({ x: top.cx + (ctx.rng.next() - 0.5) * top.half, y: -10, kind: ctx.rng.next() < 0.12 ? 'shield' : 'coin' });
      }
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i]!;
        it.y += speed * dt;
        if (it.y > H + 10) { items.splice(i, 1); continue; }
        if (Math.hypot(it.x - ship.x, it.y - ship.y) < ship.r + 10) {
          items.splice(i, 1);
          if (it.kind === 'coin') { bonus += 30 * zone; ctx.audio.sfx('coin'); }
          else { shield = true; ctx.hud.toast('SHIELD'); ctx.audio.sfx('powerup'); }
        }
      }

      // collision: find the slice at the ship's y
      const idx = Math.floor((ship.y + (scroll % sliceH)) / sliceH);
      const s = slices[Math.max(0, Math.min(slices.length - 1, idx))]!;
      if ((ship.x - ship.r < s.cx - s.half || ship.x + ship.r > s.cx + s.half) && invuln <= 0) {
        if (shield) {
          shield = false;
          invuln = 1;
          half = Math.min(W * 0.34, half + 30); // widen tunnel briefly so you can recover
          ship.x = s.cx;
          ctx.audio.sfx('powerup');
          ctx.fx.screenShake(6, 0.14);
        } else {
          over = true;
          ctx.audio.sfx('explosion');
          ctx.gameOver(Math.floor(dist / 10) * zone + bonus, { dist: Math.floor(dist) });
          return;
        }
      }
      draw();
    },
    destroy() {
      offDown();
      offUp();
      offPtr();
      layer.destroy({ children: true });
    },
  };
}
