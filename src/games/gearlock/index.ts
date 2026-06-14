import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action } from '@core/InputManager';
import { burst, drawBackdrop, drawSparks, type Spark, updateSparks } from '@games/_shared/juice';

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const cx = W / 2;
  const cy = H / 2 + 10;
  const layer = new Container();
  const g = new Graphics();
  layer.addChild(g);
  ctx.stage.addChild(layer);
  const sparks: Spark[] = [];
  let score = 0;
  let pin = 1;
  let level = 1;
  let lives = 3;
  let angle = -Math.PI / 2;
  let speed = 2.2;
  let arc = { a: 0, w: 0.55 };
  let over = false;
  let t = 0;

  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('PIN 1/5');

  const newArc = (): void => {
    arc = { a: ctx.rng.next() * Math.PI * 2, w: Math.max(0.24, 0.62 - level * 0.045) };
    speed = (2.1 + level * 0.22) * (ctx.rng.next() > 0.5 ? 1 : -1);
  };
  newArc();

  const diff = (a: number, b: number): number => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const hit = (): void => {
    if (over) return;
    if (diff(angle, arc.a) < arc.w) {
      const acc = 1 - diff(angle, arc.a) / arc.w;
      const pts = Math.round(120 + acc * 180 + level * 30);
      score += pts;
      pin++;
      ctx.hud.setScore(score);
      ctx.fx.floatingText(`+${pts}`, cx, cy - 92, 0xffd200);
      ctx.audio.sfx(acc > 0.72 ? 'powerup' : 'coin');
      burst(sparks, ctx.rng, cx + Math.cos(angle) * 88, cy + Math.sin(angle) * 88, 0xffd200, 18, 140);
      if (pin > 5) {
        pin = 1;
        level++;
        ctx.fx.screenShake(4, 0.1);
      }
      ctx.hud.setLabel(`PIN ${pin}/5`);
      newArc();
    } else {
      lives--;
      ctx.hud.setLives(lives);
      ctx.audio.sfx('hit');
      ctx.fx.screenShake(8, 0.16);
      newArc();
      if (lives <= 0) {
        over = true;
        ctx.gameOver(score, { level });
      }
    }
  };

  const offDown = ctx.input.on('down', (a: Action) => {
    if (a === 'a' || a === 'b' || a === 'up') hit();
  });
  const offTap = ctx.input.on('tap', hit);

  function draw(): void {
    g.clear();
    drawBackdrop(g, W, H, t, 0x362047, 0x060512);
    for (let r = 110; r >= 62; r -= 24) {
      g.circle(cx, cy, r).stroke({ width: 2, color: 0x2d365a, alpha: 0.7 });
    }
    g.moveTo(cx + Math.cos(arc.a - arc.w) * 88, cy + Math.sin(arc.a - arc.w) * 88);
    g.arc(cx, cy, 88, arc.a - arc.w, arc.a + arc.w).stroke({ width: 12, color: 0xffd200, alpha: 0.85 });
    g.circle(cx, cy, 44).fill({ color: 0x111827 }).stroke({ width: 3, color: 0xb388ff });
    g.circle(cx + Math.cos(angle) * 88, cy + Math.sin(angle) * 88, 12).fill({ color: 0x22d3ee });
    g.rect(cx - 5, cy - 52, 10, 104).fill({ color: 0xffffff, alpha: 0.08 });
    drawSparks(g, sparks);
  }

  return {
    update(dt) {
      if (over) return;
      t += dt;
      updateSparks(sparks, dt);
      angle += speed * dt;
      draw();
    },
    destroy() {
      offDown();
      offTap();
      layer.destroy({ children: true });
    },
  };
}
