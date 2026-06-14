import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import { burst, clamp, drawBackdrop, drawSparks, type Spark, updateSparks } from '@games/_shared/juice';

type Gate = { y: number; x: number; w: number; color: number; passed: boolean };

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  const g = new Graphics();
  layer.addChild(g);
  ctx.stage.addChild(layer);
  const gates: Gate[] = [];
  const sparks: Spark[] = [];
  let x = W / 2;
  let vx = 0;
  let score = 0;
  let lives = 3;
  let boost = 1;
  let spawn = 0;
  let t = 0;
  let over = false;

  ctx.hud.setScore(score);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('DRIFT');

  const addGate = (): void => {
    gates.push({
      y: -20,
      x: 74 + ctx.rng.next() * (W - 148),
      w: 82 - Math.min(34, score / 500),
      color: ctx.rng.pick([0x22d3ee, 0xffd200, 0xff4d8d, 0x3ddc84]),
      passed: false,
    });
  };

  function draw(): void {
    g.clear();
    drawBackdrop(g, W, H, t, 0x172554, 0x050713);
    const center = W / 2 + Math.sin(t * 0.9) * 34;
    g.moveTo(center - 110, 70).lineTo(center + 110, 70).lineTo(W - 28, H - 62).lineTo(28, H - 62).closePath().fill({ color: 0x080c18, alpha: 0.86 });
    for (let i = 0; i < 16; i++) {
      const yy = 80 + ((i * 46 + t * 180 * boost) % (H - 120));
      g.rect(W / 2 - 2, yy, 4, 24).fill({ color: 0xffffff, alpha: 0.12 });
    }
    for (const gate of gates) {
      g.roundRect(gate.x - gate.w / 2, gate.y, gate.w, 12, 5).fill({ color: gate.color });
      g.circle(gate.x - gate.w / 2, gate.y + 6, 7).fill({ color: 0xffffff, alpha: 0.45 });
      g.circle(gate.x + gate.w / 2, gate.y + 6, 7).fill({ color: 0xffffff, alpha: 0.45 });
    }
    g.roundRect(x - 15, H - 118, 30, 48, 8).fill({ color: boost > 1 ? 0xffd200 : 0x22d3ee });
    g.circle(x - 9, H - 72, 4).fill({ color: 0xff4d8d });
    g.circle(x + 9, H - 72, 4).fill({ color: 0xff4d8d });
    drawSparks(g, sparks);
  }

  return {
    update(dt) {
      if (over) return;
      t += dt;
      updateSparks(sparks, dt);
      const axis = ctx.input.axis();
      boost = ctx.input.isDown('a') || ctx.input.isDown('up') ? 1.55 : Math.max(1, boost - dt);
      vx += axis.x * 620 * dt;
      vx *= 0.91;
      x = clamp(x + vx * dt, 42, W - 42);
      spawn -= dt;
      if (spawn <= 0) {
        spawn = Math.max(0.42, 0.9 - score / 15000);
        addGate();
      }
      for (let i = gates.length - 1; i >= 0; i--) {
        const gate = gates[i]!;
        gate.y += (150 + score * 0.018) * boost * dt;
        if (!gate.passed && gate.y > H - 118) {
          gate.passed = true;
          if (Math.abs(x - gate.x) < gate.w / 2) {
            const pts = Math.round(120 * boost);
            score += pts;
            ctx.hud.setScore(score);
            ctx.fx.floatingText(`+${pts}`, x, H - 138, gate.color);
            ctx.audio.sfx('coin');
            burst(sparks, ctx.rng, x, H - 100, gate.color, 12, 130);
          } else {
            lives--;
            ctx.hud.setLives(lives);
            ctx.audio.sfx('hit');
            ctx.fx.screenShake(5, 0.12);
            if (lives <= 0) {
              over = true;
              ctx.gameOver(score, { gates: Math.floor(score / 100) });
            }
          }
        }
        if (gate.y > H + 40) gates.splice(i, 1);
      }
      score += Math.floor(dt * 12 * boost);
      ctx.hud.setScore(score);
      ctx.hud.setLabel(boost > 1 ? 'BOOST' : 'DRIFT');
      draw();
    },
    destroy() {
      layer.destroy({ children: true });
    },
  };
}

