import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: number }

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const bgG = new Graphics();
  const terrainG = new Graphics();
  const g = new Graphics();
  const info = new Text({
    text: '',
    style: { fontFamily: 'VT323, monospace', fontSize: 18, fill: 0x9bffce },
  });
  info.position.set(10, 10);
  layer.addChild(bgG, terrainG, g, info);

  const GRAV = 22;
  const THRUST = 52;
  const ROT = 2.6;

  const stars: { x: number; y: number; s: number }[] = [];
  for (let i = 0; i < 50; i++) stars.push({ x: ctx.rng.next() * W, y: ctx.rng.next() * H * 0.7, s: ctx.rng.next() * 1.3 + 0.4 });

  let points: { x: number; y: number }[] = [];
  let padX1 = 0;
  let padX2 = 0;
  let padY = 0;
  let padMult = 2;
  let fuelCans: { x: number; y: number }[] = [];
  const particles: Particle[] = [];

  let level = 1;
  let lives = 3;
  let landedCount = 0;
  let bestLandFuel = 0;
  let score = 0;
  let windStrength = (ctx.rng.next() - 0.5) * 14;
  let windAngle = 0;

  const ship = { x: W / 2, y: 60, vx: (ctx.rng.next() - 0.5) * 30, vy: 0, a: 0, fuel: 100 };
  let over = false;

  const genTerrain = (): void => {
    points = [];
    const segs = 12;
    const padIdx = ctx.rng.int(3, segs - 3);
    let py = H * 0.7;
    for (let i = 0; i <= segs; i++) {
      const x = (W / segs) * i;
      if (i === padIdx || i === padIdx + 1) points.push({ x, y: py });
      else {
        py = H * 0.5 + ctx.rng.next() * H * (0.32 + level * 0.02);
        points.push({ x, y: py });
      }
    }
    padX1 = points[padIdx]!.x;
    padX2 = points[padIdx + 1]!.x;
    padY = points[padIdx]!.y;
    padMult = ctx.rng.pick([2, 3, 5]);
    // Feature: floating fuel canisters
    fuelCans = [];
    const cans = 1 + Math.floor(ctx.rng.next() * 2);
    for (let i = 0; i < cans; i++) fuelCans.push({ x: 40 + ctx.rng.next() * (W - 80), y: H * 0.25 + ctx.rng.next() * H * 0.25 });
    drawTerrain();
  };

  const resetShip = (): void => {
    ship.x = W / 2;
    ship.y = 60;
    ship.vx = (ctx.rng.next() - 0.5) * 30;
    ship.vy = 0;
    ship.a = 0;
    ship.fuel = Math.min(100, 60 + level * 5);
  };

  const burst = (x: number, y: number, color: number, n = 14): void => {
    for (let i = 0; i < n; i++) {
      const a = ctx.rng.next() * Math.PI * 2;
      const s = 40 + ctx.rng.next() * 140;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6, color });
    }
  };

  const terrainY = (x: number): number => {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      if (x >= a.x && x <= b.x) {
        const t = (x - a.x) / (b.x - a.x);
        return a.y + (b.y - a.y) * t;
      }
    }
    return H;
  };

  function drawTerrain(): void {
    terrainG.clear();
    terrainG.removeChildren();
    const path: number[] = [];
    points.forEach((p) => path.push(p.x, p.y));
    path.push(W, H, 0, H);
    terrainG.poly(path).fill({ color: 0x1a1a2e });
    terrainG.poly(points.flatMap((p) => [p.x, p.y])).stroke({ width: 2, color: 0x8a8aa3 });
    terrainG.rect(padX1, padY - 2, padX2 - padX1, 4).fill({ color: 0x3ddc84 });
    const flag = new Text({ text: `x${padMult}`, style: { fontFamily: 'VT323, monospace', fontSize: 16, fill: 0x3ddc84 } });
    flag.position.set((padX1 + padX2) / 2 - 8, padY - 22);
    terrainG.addChild(flag);
  }

  const drawBg = (): void => {
    bgG.clear();
    bgG.rect(0, 0, W, H).fill({ color: 0x05060f });
    for (const s of stars) bgG.circle(s.x, s.y, s.s).fill({ color: 0xffffff, alpha: 0.12 + s.s * 0.18 });
  };
  drawBg();
  genTerrain();

  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('LAND SOFTLY · L1');

  const nextMission = (): void => {
    level++;
    windStrength = (ctx.rng.next() - 0.5) * (14 + level * 3);
    ctx.hud.setLabel(`LAND SOFTLY · L${level}`);
    ctx.hud.toast(`MISSION ${level}`);
    genTerrain();
    resetShip();
  };

  const draw = (): void => {
    g.clear();
    // particles
    for (const p of particles) g.circle(p.x, p.y, 3 * Math.min(1, p.life * 2)).fill({ color: p.color, alpha: Math.min(1, p.life * 2) });
    // fuel canisters
    fuelCans.forEach((c) => {
      g.roundRect(c.x - 6, c.y - 8, 12, 16, 3).fill({ color: 0x00f7ff });
      g.rect(c.x - 6, c.y - 2, 12, 3).fill({ color: 0x0a0a12 });
    });
    const tx = (lx: number, ly: number): [number, number] => [
      ship.x + lx * Math.cos(ship.a) - ly * Math.sin(ship.a),
      ship.y + lx * Math.sin(ship.a) + ly * Math.cos(ship.a),
    ];
    const [ax, ay] = tx(0, -10);
    const [bx, by] = tx(-7, 7);
    const [cx, cy] = tx(7, 7);
    g.poly([ax, ay, bx, by, cx, cy]).fill({ color: 0xb0bec5 });
    if ((ctx.input.isDown('a') || ctx.input.isDown('up')) && ship.fuel > 0) {
      const [fx, fy] = tx(0, 9);
      const [f2x, f2y] = tx(-4, 16 + Math.random() * 6);
      const [f3x, f3y] = tx(4, 16 + Math.random() * 6);
      g.poly([fx, fy, f2x, f2y, f3x, f3y]).fill({ color: 0xff7b00 });
    }
  };

  return {
    update(dt) {
      if (over) return;
      windAngle += dt * 0.4;
      const windGust = windStrength * (0.8 + 0.2 * Math.sin(windAngle * 2.3));
      const thrusting = (ctx.input.isDown('a') || ctx.input.isDown('up')) && ship.fuel > 0;
      const ax = ctx.input.axis().x;
      ship.a += ax * ROT * dt;
      ship.a = Math.max(-1.2, Math.min(1.2, ship.a));

      ship.vy += GRAV * dt;
      ship.vx += windGust * dt;
      if (thrusting) {
        ship.vx += Math.sin(ship.a) * THRUST * dt;
        ship.vy -= Math.cos(ship.a) * THRUST * dt;
        ship.fuel -= 18 * dt;
        if (ctx.rng.next() < 0.3) ctx.audio.sfx('blip');
        // thruster particles
        const fx = ship.x - Math.sin(ship.a) * 12;
        const fy = ship.y + Math.cos(ship.a) * 12;
        particles.push({ x: fx, y: fy, vx: ship.vx * 0.3 + (ctx.rng.next() - 0.5) * 30, vy: 60 + ctx.rng.next() * 40, life: 0.3, color: 0xff7b00 });
      }
      ship.x += ship.vx * dt;
      ship.y += ship.vy * dt;
      if (ship.x < 0) ship.x = 0;
      if (ship.x > W) ship.x = W;

      // particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }

      // fuel pickup
      for (let i = fuelCans.length - 1; i >= 0; i--) {
        const c = fuelCans[i]!;
        if (Math.hypot(ship.x - c.x, ship.y - c.y) < 16) {
          fuelCans.splice(i, 1);
          ship.fuel = Math.min(100, ship.fuel + 30);
          burst(c.x, c.y, 0x00f7ff, 8);
          ctx.audio.sfx('coin');
          ctx.hud.toast('+30 FUEL');
        }
      }

      info.text = `FUEL ${Math.max(0, Math.round(ship.fuel))}  VY ${ship.vy.toFixed(0)}  WIND ${windGust > 0 ? '>' : '<'}${Math.abs(windGust).toFixed(0)}`;

      const ground = terrainY(ship.x);
      if (ship.y + 8 >= ground) {
        const onPad = ship.x >= padX1 && ship.x <= padX2;
        const soft = ship.vy < 32 && Math.abs(ship.vx) < 22 && Math.abs(ship.a) < 0.25;
        if (onPad && soft) {
          landedCount++;
          bestLandFuel = Math.max(bestLandFuel, Math.round(ship.fuel));
          const gain = 100 * padMult + Math.round(ship.fuel) * 2;
          score += gain;
          ctx.hud.setScore(score);
          burst(ship.x, ship.y, 0x3ddc84, 16);
          ctx.audio.sfx('powerup');
          ctx.hud.toast(`LANDED +${gain}`);
          nextMission(); // Feature: continue to a harder mission
        } else {
          burst(ship.x, ship.y, 0xff7b00, 20);
          ctx.audio.sfx('explosion');
          lives--;
          ctx.hud.setLives(lives);
          if (lives <= 0) {
            over = true;
            ctx.gameOver(score, { landed: landedCount, level, fuel: bestLandFuel });
          } else {
            ctx.hud.toast('CRASHED!');
            resetShip();
          }
        }
        draw();
        return;
      }
      draw();
    },
    destroy() {
      layer.destroy({ children: true });
    },
  };
}
