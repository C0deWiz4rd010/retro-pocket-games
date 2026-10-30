import type { Game, GameContext } from '@core/types';
import { burst, clamp, drawSparks, updateSparks } from '@kits/arcade/juice';
import { CYAN, GOLD, GREEN, PINK, WHITE, makeLayer, backdrop } from '@kits/arcade/concept';
import { boostFromCharge, cruiseSpeed, driftGain, roadCenter, roadWidth } from './core';

/**
 * Turbo Drift — keep the car on a winding road. Hold A to drift (the car slides instead of
 * gripping), build a charge while you slide, and release for a mini-turbo. Leaving the tarmac
 * bleeds speed; staying off it too long is a spin-out.
 */
export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const { layer, g, sparks } = makeLayer(ctx);
  const car = { x: roadCenter(0, W), y: H - 110, vx: 0 };
  let dist = 0; // distance along the track (px)
  let speed = 190;
  let lives = 3;
  let score = 0;
  let t = 0;
  let drifting = false;
  let charge = 0;
  let boostT = 0;
  let offRoad = 0; // seconds spent off the tarmac in a row
  let nextCheckpoint = 1200;
  let streak = 0; // consecutive mini-turbos
  let over = false;
  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('HOLD A TO DRIFT');

  const release = (): void => {
    if (!drifting) return;
    drifting = false;
    const b = boostFromCharge(charge);
    charge = 0;
    if (b.seconds > 0) {
      boostT = b.seconds;
      streak++;
      const pts = b.points * (1 + Math.floor((streak - 1) / 3));
      score += pts;
      ctx.fx.floatingText(`MINI-TURBO +${pts}`, car.x, car.y - 36, GOLD);
      ctx.audio.sfx('powerup');
      ctx.fx.screenShake(3, 0.1);
      burst(sparks, ctx.rng, car.x, car.y + 24, GOLD, 16, 150);
    } else streak = 0;
  };
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a' || a === 'up') drifting = true;
  });
  const offUp = ctx.input.on('up', (a) => {
    if (a === 'a' || a === 'up') release();
  });

  const centerAtRow = (y: number): number => roadCenter(dist + (car.y - y), W);
  const widthAtRow = (y: number): number => roadWidth(dist + (car.y - y), W);

  function draw(): void {
    g.clear();
    backdrop(g, W, H, t, H * 0.3);
    // grass + road strips, one per 10 px row; rumble stripes alternate with distance
    for (let y = H; y > 60; y -= 10) {
      const c = centerAtRow(y);
      const w = widthAtRow(y);
      const stripe = Math.floor((dist + (car.y - y)) / 60) % 2 === 0;
      g.rect(0, y - 10, W, 10).fill({ color: stripe ? 0x0b2b18 : 0x0d331d, alpha: 0.9 });
      g.rect(c - w / 2 - 7, y - 10, 7, 10).fill({ color: stripe ? PINK : WHITE, alpha: 0.9 });
      g.rect(c + w / 2, y - 10, 7, 10).fill({ color: stripe ? PINK : WHITE, alpha: 0.9 });
      g.rect(c - w / 2, y - 10, w, 10).fill({ color: 0x14161f });
      if (stripe) g.rect(c - 1.5, y - 10, 3, 10).fill({ color: GOLD, alpha: 0.45 });
    }
    // checkpoint line
    const cpY = car.y - (nextCheckpoint - dist);
    if (cpY > 60 && cpY < H) {
      const c = centerAtRow(cpY);
      const w = widthAtRow(cpY);
      g.rect(c - w / 2, cpY - 4, w, 8).fill({ color: CYAN, alpha: 0.85 });
    }
    // car: drifting tilts it and lights the tyres
    const tilt = clamp(car.vx / 260, -0.5, 0.5) * (drifting ? 1.5 : 0.6);
    const cos = Math.cos(tilt);
    const sin = Math.sin(tilt);
    const pt = (lx: number, ly: number): [number, number] => [
      car.x + lx * cos - ly * sin,
      car.y + lx * sin + ly * cos,
    ];
    if (boostT > 0)
      g.poly([...pt(-8, 24), ...pt(8, 24), ...pt(0, 64 + Math.sin(t * 40) * 6)]).fill({
        color: GOLD,
        alpha: 0.7,
      });
    g.poly([...pt(-16, -24), ...pt(16, -24), ...pt(16, 24), ...pt(-16, 24)]).fill({
      color: boostT > 0 ? GOLD : GREEN,
    });
    g.poly([...pt(-9, -14), ...pt(9, -14), ...pt(9, 4), ...pt(-9, 4)]).fill({
      color: 0x06140b,
      alpha: 0.75,
    });
    if (drifting && Math.abs(car.vx) > 100) {
      for (const sx of [-14, 14]) {
        const [tx, ty] = pt(sx, 22);
        g.circle(tx, ty, 4 + charge * 5).fill({ color: charge >= 0.3 ? GOLD : WHITE, alpha: 0.6 });
      }
    }
    // charge meter under the car
    if (charge > 0) {
      g.rect(car.x - 18, car.y + 40, 36, 4).fill({ color: 0x000000, alpha: 0.5 });
      g.rect(car.x - 18, car.y + 40, 36 * charge, 4).fill({ color: charge >= 0.3 ? GOLD : CYAN });
    }
    drawSparks(g, sparks);
  }

  return {
    update(dt) {
      if (over) return;
      t += dt;
      updateSparks(sparks, dt);
      const ax = ctx.input.axis().x;
      // grip vs slide: drifting keeps sideways momentum and steers a little harder
      const grip = drifting ? 0.975 : 0.86;
      car.vx += ax * (drifting ? 980 : 720) * dt;
      car.vx *= Math.pow(grip, dt * 60);
      car.x = clamp(car.x + car.vx * dt, 12, W - 12);
      if (drifting) charge = Math.min(1, charge + driftGain(car.vx, dt));

      const road = centerAtRow(car.y);
      const half = widthAtRow(car.y) / 2;
      const off = Math.abs(car.x - road) > half - 6;
      const target = cruiseSpeed(dist) * (boostT > 0 ? 1.45 : 1) * (off ? 0.5 : 1);
      speed += (target - speed) * Math.min(1, dt * 3);
      boostT = Math.max(0, boostT - dt);
      dist += speed * dt;
      score += Math.round(speed * dt * 0.12);

      if (off) {
        offRoad += dt;
        charge = Math.max(0, charge - dt * 0.6);
        streak = 0;
        if (Math.floor(offRoad * 12) !== Math.floor((offRoad - dt) * 12))
          burst(sparks, ctx.rng, car.x, car.y + 20, 0x6b8f4e, 3, 60);
        if (offRoad > 1.4) {
          // spin-out: back to the middle of the road
          offRoad = 0;
          lives--;
          ctx.hud.setLives(lives);
          ctx.fx.screenShake(8, 0.2);
          ctx.audio.sfx('hit');
          burst(sparks, ctx.rng, car.x, car.y, PINK, 16, 140);
          if (lives <= 0) {
            over = true;
            ctx.gameOver(score, { distance: Math.round(dist / 10) });
            return;
          }
          car.x = road;
          car.vx = 0;
          speed *= 0.5;
          drifting = false;
          charge = 0;
        }
      } else offRoad = Math.max(0, offRoad - dt * 2);

      if (dist >= nextCheckpoint) {
        nextCheckpoint += 1200;
        score += 250;
        ctx.fx.floatingText('CHECKPOINT +250', W / 2, car.y - 70, CYAN);
        ctx.audio.sfx('coin');
      }
      ctx.hud.setScore(score);
      ctx.hud.setLabel(
        off
          ? 'OFF ROAD!'
          : boostT > 0
            ? `TURBO ${boostT.toFixed(1)}`
            : charge > 0
              ? `DRIFT ${Math.round(charge * 100)}%`
              : streak >= 3
                ? `TURBO CHAIN x${1 + Math.floor((streak - 1) / 3)}`
                : 'HOLD A TO DRIFT',
      );
      draw();
    },
    destroy() {
      offDown();
      offUp();
      layer.destroy({ children: true });
    },
  };
}
