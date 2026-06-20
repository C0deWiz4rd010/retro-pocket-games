import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action, Dir } from '@core/InputManager';

interface Cycle {
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: number;
}
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: number }

const DIRS: Record<string, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export default function createGame(ctx: GameContext): Game {
  const cell = 8;
  const cols = Math.floor(ctx.width / cell);
  const rows = Math.floor(ctx.height / cell);
  const ox = (ctx.width - cols * cell) / 2;
  const oy = (ctx.height - rows * cell) / 2;

  const layer = new Container();
  layer.position.set(ox, oy);
  ctx.stage.addChild(layer);
  const gridG = new Graphics();
  const trailG = new Graphics();
  const headG = new Graphics();
  const fxG = new Graphics();
  layer.addChild(gridG, trailG, headG, fxG);

  // static neon grid backdrop
  gridG.rect(0, 0, cols * cell, rows * cell).fill({ color: 0x05060f });
  for (let x = 0; x <= cols; x += 4) gridG.rect(x * cell, 0, 1, rows * cell).fill({ color: 0x12325a, alpha: 0.4 });
  for (let y = 0; y <= rows; y += 4) gridG.rect(0, y * cell, cols * cell, 1).fill({ color: 0x12325a, alpha: 0.4 });

  const grid = new Uint8Array(cols * rows); // 0 empty, 1 player, 2 cpu
  const at = (x: number, y: number): number => grid[y * cols + x] ?? 1;
  const setCell = (x: number, y: number, v: number): void => {
    grid[y * cols + x] = v;
  };

  const player: Cycle = { x: Math.floor(cols * 0.25), y: Math.floor(rows / 2), dx: 1, dy: 0, color: 0x00f7ff };
  const cpu: Cycle = { x: Math.floor(cols * 0.75), y: Math.floor(rows / 2), dx: -1, dy: 0, color: 0xff2e97 };
  let next = { x: 1, y: 0 };
  let acc = 0;
  let speed = 0.08;
  let over = false;
  let wins = 0;
  const particles: Particle[] = [];
  let boost = 1; // Feature: boost meter 0..1
  let boostT = 0; // active boost timer
  let pickup: { x: number; y: number } | null = null; // Feature: energy pickup
  let pickupTimer = 4;
  let trailLen = 0;

  const setLabel = (): void => {
    const bars = '▮'.repeat(Math.round(boost * 5)).padEnd(5, '▯');
    ctx.hud.setLabel(`BOOST ${bars}${boostT > 0 ? ' ⚡' : ''}`);
  };
  ctx.hud.setScore(0);
  setLabel();

  const turn = (a: Action | Dir): void => {
    if (a === 'a' || a === 'b') {
      if (boost > 0.2 && boostT <= 0) {
        boostT = 0.9;
        ctx.audio.sfx('powerup');
      }
      return;
    }
    const d = DIRS[a];
    if (!d) return;
    if (d.x === -player.dx && d.y === -player.dy) return;
    next = d;
  };
  const offDown = ctx.input.on('down', turn);
  const offSwipe = ctx.input.on('swipe', turn);

  const blocked = (x: number, y: number): boolean =>
    x < 0 || y < 0 || x >= cols || y >= rows || at(x, y) !== 0;

  const cpuThink = (): void => {
    const options = [
      { x: cpu.dx, y: cpu.dy },
      { x: -cpu.dy, y: cpu.dx },
      { x: cpu.dy, y: -cpu.dx },
    ].filter((d) => !blocked(cpu.x + d.x, cpu.y + d.y));
    if (!options.length) return;
    let best = options[0]!;
    let bestSpace = -1;
    for (const d of options) {
      let space = 0;
      let tx = cpu.x;
      let ty = cpu.y;
      while (space < 12 && !blocked(tx + d.x, ty + d.y)) {
        tx += d.x;
        ty += d.y;
        space++;
      }
      if (space > bestSpace || (space === bestSpace && ctx.rng.next() < 0.3)) {
        bestSpace = space;
        best = d;
      }
    }
    cpu.dx = best.x;
    cpu.dy = best.y;
  };

  const spawnPickup = (): void => {
    for (let tries = 0; tries < 30; tries++) {
      const x = Math.floor(ctx.rng.next() * cols);
      const y = Math.floor(ctx.rng.next() * rows);
      if (at(x, y) === 0 && Math.hypot(x - player.x, y - player.y) > 5) {
        pickup = { x, y };
        return;
      }
    }
  };

  const burst = (gx: number, gy: number, color: number, n = 20): void => {
    const cx = gx * cell + cell / 2;
    const cy = gy * cell + cell / 2;
    for (let i = 0; i < n; i++) {
      const a = ctx.rng.next() * Math.PI * 2;
      const s = 40 + ctx.rng.next() * 160;
      particles.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.7, color });
    }
  };

  const drawHeads = (): void => {
    headG.clear();
    // glow
    headG.rect(player.x * cell - 2, player.y * cell - 2, cell + 4, cell + 4).fill({ color: 0x00f7ff, alpha: 0.3 });
    headG.rect(player.x * cell, player.y * cell, cell, cell).fill({ color: 0xffffff });
    headG.rect(cpu.x * cell, cpu.y * cell, cell, cell).fill({ color: 0xffd200 });
    // pickup
    if (pickup) {
      const px = pickup.x * cell + cell / 2;
      const py = pickup.y * cell + cell / 2;
      const r = cell * (0.4 + 0.15 * Math.sin(performance.now() / 120));
      headG.circle(px, py, r).fill({ color: 0x3ddc84 });
      headG.circle(px, py, r * 0.5).fill({ color: 0xccffe0 });
    }
  };

  const drawFx = (): void => {
    fxG.clear();
    for (const p of particles) fxG.circle(p.x, p.y, 3 * Math.min(1, p.life * 2)).fill({ color: p.color, alpha: Math.min(1, p.life * 2) });
  };

  const reset = (): void => {
    grid.fill(0);
    trailG.clear();
    trailLen = 0;
    player.x = Math.floor(cols * 0.25);
    player.y = Math.floor(rows / 2);
    player.dx = 1;
    player.dy = 0;
    cpu.x = Math.floor(cols * 0.75);
    cpu.y = Math.floor(rows / 2);
    cpu.dx = -1;
    cpu.dy = 0;
    next = { x: 1, y: 0 };
    boost = 1;
    boostT = 0;
    pickup = null;
    pickupTimer = 4;
    setLabel();
  };

  const endRound = (playerWon: boolean): void => {
    burst(player.x, player.y, playerWon ? 0xffd200 : 0x00f7ff, 30);
    if (playerWon) {
      wins++;
      ctx.hud.setScore(wins * 100 + trailLen);
      ctx.audio.sfx('powerup');
      ctx.hud.toast(`ROUND WON (${wins})`);
      reset();
      speed = Math.max(0.045, speed - 0.006);
    } else {
      over = true;
      ctx.audio.sfx('explosion');
      ctx.gameOver(wins * 100 + trailLen, { wins });
    }
  };

  const stepCycles = (): void => {
    player.dx = next.x;
    player.dy = next.y;
    cpuThink();

    const pnx = player.x + player.dx;
    const pny = player.y + player.dy;
    const cnx = cpu.x + cpu.dx;
    const cny = cpu.y + cpu.dy;
    const pDead = blocked(pnx, pny) || (pnx === cnx && pny === cny);
    const cDead = blocked(cnx, cny);
    if (pDead) return endRound(false);
    if (cDead) return endRound(true);

    setCell(player.x, player.y, 1);
    setCell(cpu.x, cpu.y, 2);
    trailG.rect(player.x * cell, player.y * cell, cell, cell).fill({ color: player.color });
    trailG.rect(cpu.x * cell, cpu.y * cell, cell, cell).fill({ color: cpu.color });
    trailLen++;

    player.x = pnx;
    player.y = pny;
    cpu.x = cnx;
    cpu.y = cny;

    // pickup collection
    if (pickup && player.x === pickup.x && player.y === pickup.y) {
      boost = Math.min(1, boost + 0.4);
      ctx.hud.setScore(wins * 100 + trailLen);
      ctx.hud.toast('+ENERGY');
      ctx.audio.sfx('coin');
      burst(pickup.x, pickup.y, 0x3ddc84, 12);
      pickup = null;
      pickupTimer = 4 + ctx.rng.next() * 3;
      setLabel();
    }
  };

  return {
    update(dt) {
      if (over) return;

      // boost meter
      if (boostT > 0) {
        boostT -= dt;
        boost = Math.max(0, boost - dt * 0.6);
        if (boostT <= 0 || boost <= 0) { boostT = 0; setLabel(); }
      } else if (boost < 1) {
        boost = Math.min(1, boost + dt * 0.12);
      }

      // particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }

      // pickup spawn
      if (!pickup) {
        pickupTimer -= dt;
        if (pickupTimer <= 0) spawnPickup();
      }

      acc += dt;
      const interval = boostT > 0 ? speed * 0.5 : speed;
      if (acc >= interval) {
        acc = 0;
        stepCycles();
        if (boostT > 0 && Math.round(boost * 5) !== Math.round((boost + dt * 0.6) * 5)) setLabel();
      }
      drawHeads();
      drawFx();
    },
    destroy() {
      offDown();
      offSwipe();
      layer.destroy({ children: true });
    },
  };
}
