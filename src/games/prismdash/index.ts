import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action } from '@core/InputManager';
import { burst, drawBackdrop, drawSparks, type Spark, updateSparks } from '@games/_shared/juice';

type Gate = { x: number; gapY: number; color: number; scored: boolean; rainbow: boolean };
const COLORS = [0x22d3ee, 0xff4d8d, 0xffd200];

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  const g = new Graphics();
  layer.addChild(g);
  ctx.stage.addChild(layer);
  const gates: Gate[] = [];
  const coins: { x: number; y: number }[] = []; // Feature: bonus coins
  const sparks: Spark[] = [];
  let y = H / 2;
  let vy = 0;
  let color = 0;
  let score = 0;
  let lives = 3;
  let spawn = 0;
  let speed = 145;
  let t = 0;
  let over = false;
  let combo = 0; // Feature: matched-gate combo multiplier

  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('PRISM');

  const cycle = (): void => {
    color = (color + 1) % COLORS.length;
    ctx.audio.sfx('blip');
  };
  const offDown = ctx.input.on('down', (a: Action) => {
    if (a === 'a' || a === 'up') cycle();
  });
  const offTap = ctx.input.on('tap', () => cycle());
  const addGate = (): void => {
    const gapY = 122 + ctx.rng.next() * (H - 250);
    gates.push({ x: W + 30, gapY, color: ctx.rng.int(0, COLORS.length - 1), scored: false, rainbow: ctx.rng.next() < 0.12 });
    if (ctx.rng.next() < 0.45) coins.push({ x: W + 30 + 120, y: 110 + ctx.rng.next() * (H - 220) });
  };

  function draw(): void {
    g.clear();
    drawBackdrop(g, W, H, t, 0x29204c, 0x050512);
    for (const gate of gates) {
      const c = gate.rainbow ? COLORS[Math.floor(t * 6) % COLORS.length]! : COLORS[gate.color]!;
      g.rect(gate.x - 6, 72, 12, gate.gapY - 46).fill({ color: c, alpha: 0.8 });
      g.rect(gate.x - 6, gate.gapY + 46, 12, H - gate.gapY - 106).fill({ color: c, alpha: 0.8 });
      g.circle(gate.x, gate.gapY, 24).stroke({ width: 4, color: c, alpha: 0.9 });
      if (gate.rainbow) g.circle(gate.x, gate.gapY, 30).stroke({ width: 2, color: 0xffffff, alpha: 0.5 });
    }
    for (const co of coins) g.circle(co.x, co.y, 9).fill({ color: 0xffd200 });
    g.circle(W * 0.28, y, 18).fill({ color: COLORS[color]! });
    g.circle(W * 0.28, y, 30).stroke({ width: 3, color: COLORS[color]!, alpha: 0.35 + Math.sin(t * 10) * 0.18 });
    drawSparks(g, sparks);
  }

  return {
    update(dt) {
      if (over) return;
      t += dt;
      updateSparks(sparks, dt);
      const axis = ctx.input.axis();
      vy += axis.y * 620 * dt;
      vy *= 0.9;
      y = Math.max(94, Math.min(H - 96, y + vy * dt));
      spawn -= dt;
      speed += dt * 2.5;
      if (spawn <= 0) {
        spawn = Math.max(0.55, 1.05 - score / 16000);
        addGate();
      }
      for (let i = gates.length - 1; i >= 0; i--) {
        const gate = gates[i]!;
        gate.x -= speed * dt;
        if (!gate.scored && gate.x < W * 0.28) {
          gate.scored = true;
          if (Math.abs(y - gate.gapY) < 42 && (gate.rainbow || gate.color === color)) {
            combo++;
            const mult = 1 + Math.floor(combo / 4);
            const pts = (gate.rainbow ? 280 : 180) * mult;
            score += pts;
            ctx.hud.setScore(score);
            ctx.fx.floatingText(gate.rainbow ? `RAINBOW +${pts}` : `+${pts}`, W * 0.28, y - 28, gate.rainbow ? 0xffffff : COLORS[color]!);
            if (combo >= 4 && combo % 4 === 0) ctx.hud.toast(`COMBO x${mult}`);
            ctx.audio.sfx('coin');
            burst(sparks, ctx.rng, W * 0.28, y, COLORS[color]!, 16, 150);
          } else {
            combo = 0;
            lives--;
            ctx.hud.setLives(lives);
            ctx.audio.sfx('hit');
            ctx.fx.screenShake(6, 0.12);
            if (lives <= 0) {
              over = true;
              ctx.gameOver(score, { speed: Math.round(speed) });
            }
          }
        }
        if (gate.x < -50) gates.splice(i, 1);
      }
      // coins
      for (let i = coins.length - 1; i >= 0; i--) {
        const co = coins[i]!;
        co.x -= speed * dt;
        if (co.x < -20) { coins.splice(i, 1); continue; }
        if (Math.abs(co.x - W * 0.28) < 24 && Math.abs(co.y - y) < 24) {
          coins.splice(i, 1);
          score += 60;
          ctx.audio.sfx('coin');
          burst(sparks, ctx.rng, co.x, co.y, 0xffd200, 8, 90);
        }
      }
      score += Math.floor(dt * 10);
      ctx.hud.setScore(score);
      ctx.hud.setLabel(combo >= 4 ? `COMBO x${1 + Math.floor(combo / 4)}` : ['CYAN', 'PINK', 'GOLD'][color]!);
      draw();
    },
    destroy() {
      offDown();
      offTap();
      layer.destroy({ children: true });
    },
  };
}
