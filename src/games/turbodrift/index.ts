import type { Game, GameContext } from '@core/types';
import { burst, clamp, drawSparks, updateSparks } from '@kits/arcade/juice';
import { CYAN, GOLD, GREEN, WHITE, makeLayer, backdrop } from '@kits/arcade/concept';

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const { layer, g, sparks } = makeLayer(ctx);
  const car = { x: W / 2, y: H - 100, vx: 0, angle: 0 };
  const gates: { x: number; y: number; w: number; hit: boolean }[] = [];
  const coins: { x: number; y: number; hit: boolean }[] = []; // Feature: boost coins
  const cones: { x: number; y: number }[] = []; // Feature: hazard cones
  let score = 0;
  let lives = 3;
  let nitro = 0;
  let spawn = 0;
  let t = 0;
  let streak = 0; // Feature: perfect-gate streak multiplier
  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('HOLD A NITRO');
  const spawnGate = (): void => {
    gates.push({
      x: 54 + ctx.rng.next() * (W - 108),
      y: -30,
      w: 82 - Math.min(34, score / 600),
      hit: false,
    });
    if (ctx.rng.next() < 0.4) coins.push({ x: 40 + ctx.rng.next() * (W - 80), y: -70, hit: false });
    if (score > 1500 && ctx.rng.next() < 0.3)
      cones.push({ x: 40 + ctx.rng.next() * (W - 80), y: -110 });
  };
  const scroll = (): number => Math.min(175 + score * 0.018, 400);
  function draw(): void {
    g.clear();
    backdrop(g, W, H, t, H * 0.38);
    g.moveTo(W * 0.38, H * 0.28)
      .lineTo(W * 0.62, H * 0.28)
      .lineTo(W - 24, H - 48)
      .lineTo(24, H - 48)
      .closePath()
      .fill({ color: 0x090a18, alpha: 0.92 });
    for (const gate of gates) {
      g.roundRect(gate.x - gate.w / 2, gate.y, gate.w, 12, 6).fill({
        color: gate.hit ? GREEN : GOLD,
      });
      g.circle(gate.x - gate.w / 2, gate.y + 6, 7).fill({ color: CYAN });
      g.circle(gate.x + gate.w / 2, gate.y + 6, 7).fill({ color: CYAN });
    }
    for (const c of coins) {
      if (!c.hit) g.circle(c.x, c.y, 9).fill({ color: GOLD });
    }
    for (const c of cones) {
      g.moveTo(c.x, c.y - 12)
        .lineTo(c.x + 11, c.y + 10)
        .lineTo(c.x - 11, c.y + 10)
        .closePath()
        .fill({ color: 0xff7b00 });
      g.rect(c.x - 11, c.y + 4, 22, 3).fill({ color: WHITE, alpha: 0.6 });
    }
    g.roundRect(car.x - 16, car.y - 24, 32, 48, 8).fill({ color: nitro > 0 ? GOLD : GREEN });
    g.rect(car.x - 9, car.y - 15, 18, 20).fill({ color: 0x06140b, alpha: 0.7 });
    if (nitro > 0) g.rect(car.x - 10, car.y + 26, 20, 42).fill({ color: GOLD, alpha: 0.28 });
    drawSparks(g, sparks);
  }
  return {
    update(dt) {
      t += dt;
      updateSparks(sparks, dt);
      const ax = ctx.input.axis().x;
      nitro =
        ctx.input.isDown('a') || ctx.input.isDown('up')
          ? Math.min(1.4, nitro + dt * 3)
          : Math.max(0, nitro - dt * 1.8);
      car.vx += ax * (680 + nitro * 260) * dt;
      car.vx *= nitro > 0 ? 0.9 : 0.92;
      car.x = clamp(car.x + car.vx * dt, 34, W - 34);
      spawn -= dt;
      if (spawn <= 0) {
        spawn = Math.max(0.42, 0.85 - score / 13000);
        spawnGate();
      }
      for (let i = gates.length - 1; i >= 0; i--) {
        const gate = gates[i]!;
        gate.y += scroll() * dt;
        if (!gate.hit && gate.y > car.y - 18) {
          gate.hit = true;
          if (Math.abs(car.x - gate.x) < gate.w / 2) {
            const perfect = Math.abs(car.x - gate.x) < Math.max(8, gate.w * 0.12);
            streak++;
            const mult = 1 + Math.floor(streak / 4);
            const pts =
              (120 +
                Math.round(Math.abs(car.vx) * 0.25) +
                (nitro > 0.5 ? 80 : 0) +
                (perfect ? 140 : 0)) *
              mult;
            score += pts;
            ctx.fx.floatingText(
              perfect ? `PERFECT +${pts}` : nitro > 0.5 ? `NITRO +${pts}` : `+${pts}`,
              car.x,
              car.y - 32,
              perfect ? CYAN : GOLD,
            );
            if (perfect && streak % 4 === 0) ctx.hud.toast(`STREAK x${mult}`);
            else if (perfect) ctx.hud.toast('PERFECT GATE');
            ctx.audio.sfx('coin');
            burst(sparks, ctx.rng, car.x, car.y, GREEN, 12, 120);
          } else {
            streak = 0;
            lives--;
            ctx.hud.setLives(lives);
            ctx.fx.screenShake(5, 0.12);
            if (lives <= 0) {
              ctx.gameOver(score);
              return;
            }
          }
        }
        if (gate.y > H + 30) gates.splice(i, 1);
      }
      // coins
      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i]!;
        c.y += scroll() * dt;
        if (c.y > H + 20) {
          coins.splice(i, 1);
          continue;
        }
        if (!c.hit && Math.hypot(c.x - car.x, c.y - car.y) < 26) {
          c.hit = true;
          score += 60;
          nitro = Math.min(1.4, nitro + 0.5);
          ctx.audio.sfx('coin');
          burst(sparks, ctx.rng, c.x, c.y, GOLD, 8, 90);
          coins.splice(i, 1);
        }
      }
      // cones (hazards)
      for (let i = cones.length - 1; i >= 0; i--) {
        const c = cones[i]!;
        c.y += scroll() * dt;
        if (c.y > H + 20) {
          cones.splice(i, 1);
          continue;
        }
        if (Math.abs(c.x - car.x) < 22 && Math.abs(c.y - car.y) < 28) {
          cones.splice(i, 1);
          streak = 0;
          lives--;
          ctx.hud.setLives(lives);
          ctx.fx.screenShake(7, 0.16);
          burst(sparks, ctx.rng, car.x, car.y, 0xff7b00, 14, 130);
          if (lives <= 0) {
            ctx.gameOver(score);
            return;
          }
        }
      }
      ctx.hud.setScore(score);
      ctx.hud.setLabel(
        streak >= 4
          ? `STREAK x${1 + Math.floor(streak / 4)}`
          : nitro > 0.5
            ? 'NITRO DRIFT'
            : 'HOLD A NITRO',
      );
      draw();
    },
    destroy() {
      layer.destroy({ children: true });
    },
  };
}
