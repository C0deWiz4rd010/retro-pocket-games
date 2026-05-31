import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const terrainG = new Graphics();
  const g = new Graphics();
  const info = new Text({
    text: '',
    style: { fontFamily: 'VT323, monospace', fontSize: 18, fill: 0x9bffce },
  });
  info.position.set(10, 10);
  layer.addChild(terrainG, g, info);

  const GRAV = 22;
  const THRUST = 52;
  const ROT = 2.6;

  // generate jagged terrain with one or two flat landing pads
  const points: { x: number; y: number }[] = [];
  const segs = 12;
  const padIdx = ctx.rng.int(3, segs - 3);
  let py = H * 0.7;
  for (let i = 0; i <= segs; i++) {
    const x = (W / segs) * i;
    if (i === padIdx || i === padIdx + 1) {
      points.push({ x, y: py });
    } else {
      py = H * 0.55 + ctx.rng.next() * H * 0.32;
      points.push({ x, y: py });
    }
  }
  const padX1 = points[padIdx]!.x;
  const padX2 = points[padIdx + 1]!.x;
  const padY = points[padIdx]!.y;
  const padMult = ctx.rng.pick([2, 3, 5]);

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

  const ship = { x: W / 2, y: 60, vx: (ctx.rng.next() - 0.5) * 30, vy: 0, a: 0, fuel: 100 };
  let over = false;
  let landed = 0;
  let score = 0;

  ctx.hud.setScore(0);
  ctx.hud.setLabel('LAND SOFTLY');

  const drawTerrain = (): void => {
    terrainG.clear();
    const path: number[] = [];
    points.forEach((p) => path.push(p.x, p.y));
    path.push(W, H, 0, H);
    terrainG.poly(path).fill({ color: 0x1a1a2e });
    terrainG.poly(points.flatMap((p) => [p.x, p.y])).stroke({ width: 2, color: 0x8a8aa3 });
    // landing pad highlight
    terrainG.rect(padX1, padY - 2, padX2 - padX1, 4).fill({ color: 0x3ddc84 });
    const flag = new Text({
      text: `x${padMult}`,
      style: { fontFamily: 'VT323, monospace', fontSize: 16, fill: 0x3ddc84 },
    });
    flag.position.set((padX1 + padX2) / 2 - 8, padY - 22);
    terrainG.addChild(flag);
  };
  drawTerrain();

  const draw = (): void => {
    g.clear();
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
    info.text = `FUEL ${Math.max(0, Math.round(ship.fuel))}  VY ${ship.vy.toFixed(0)}  VX ${ship.vx.toFixed(0)}`;
  };

  return {
    update(dt) {
      if (over) return;
      const thrusting = (ctx.input.isDown('a') || ctx.input.isDown('up')) && ship.fuel > 0;
      const ax = ctx.input.axis().x;
      ship.a += ax * ROT * dt;
      ship.a = Math.max(-1.2, Math.min(1.2, ship.a));

      ship.vy += GRAV * dt;
      if (thrusting) {
        ship.vx += Math.sin(ship.a) * THRUST * dt;
        ship.vy -= Math.cos(ship.a) * THRUST * dt;
        ship.fuel -= 18 * dt;
        if (ctx.rng.next() < 0.3) ctx.audio.sfx('blip');
      }
      ship.x += ship.vx * dt;
      ship.y += ship.vy * dt;
      if (ship.x < 0) ship.x = 0;
      if (ship.x > W) ship.x = W;

      const ground = terrainY(ship.x);
      if (ship.y + 8 >= ground) {
        const onPad = ship.x >= padX1 && ship.x <= padX2;
        const soft = ship.vy < 32 && Math.abs(ship.vx) < 22 && Math.abs(ship.a) < 0.25;
        if (onPad && soft) {
          landed++;
          const gain = 100 * padMult + Math.round(ship.fuel) * 2;
          score += gain;
          ctx.hud.setScore(score);
          ctx.audio.sfx('powerup');
          ctx.hud.toast(`LANDED +${gain}`);
          over = true;
          ctx.gameOver(score, { landed, fuel: Math.round(ship.fuel) });
        } else {
          ctx.audio.sfx('explosion');
          over = true;
          ctx.gameOver(score, { landed });
        }
        return;
      }
      draw();
    },
    destroy() {
      layer.destroy({ children: true });
    },
  };
}
