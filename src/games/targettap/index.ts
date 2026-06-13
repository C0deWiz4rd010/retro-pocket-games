import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  const label = new Text({ text: '', style: { fontFamily: 'VT323, monospace', fontSize: 24, fill: 0x22d3ee } });
  label.anchor.set(0.5);
  label.position.set(W / 2, 52);
  layer.addChild(g, label);

  let target = { x: W / 2, y: H / 2, r: 28, vx: 80, vy: 60 };
  let score = 0;
  let combo = 0;
  let time = 30;
  let over = false;

  ctx.hud.setScore(0);
  ctx.hud.setLabel('30s');

  const moveTarget = (): void => {
    target = {
      x: 40 + ctx.rng.next() * (W - 80),
      y: 100 + ctx.rng.next() * (H - 210),
      r: Math.max(16, 30 - combo),
      vx: (ctx.rng.next() - 0.5) * 180,
      vy: (ctx.rng.next() - 0.5) * 180,
    };
  };
  moveTarget();

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (over) return;
    if (Math.hypot(x - target.x, y - target.y) <= target.r) {
      combo++;
      const pts = 50 + combo * 10;
      score += pts;
      ctx.hud.setScore(score);
      ctx.fx.floatingText(`+${pts}`, target.x, target.y, 0x22d3ee);
      ctx.audio.sfx('coin');
      moveTarget();
    } else {
      combo = 0;
      ctx.audio.sfx('hit');
      ctx.fx.screenShake(3, 0.08);
    }
  });

  function draw(): void {
    g.clear();
    label.text = `COMBO ${combo}`;
    g.circle(target.x, target.y, target.r).fill({ color: 0x22d3ee });
    g.circle(target.x, target.y, target.r * 0.62).fill({ color: 0x0f172a });
    g.circle(target.x, target.y, target.r * 0.28).fill({ color: 0xfffbeb });
  }

  return {
    update(dt) {
      if (over) return;
      time -= dt;
      ctx.hud.setLabel(`${Math.ceil(time)}s`);
      target.x += target.vx * dt;
      target.y += target.vy * dt;
      if (target.x < target.r || target.x > W - target.r) target.vx *= -1;
      if (target.y < 90 + target.r || target.y > H - 90 - target.r) target.vy *= -1;
      if (time <= 0) {
        over = true;
        ctx.gameOver(score, { combo });
      }
      draw();
    },
    destroy() {
      offTap();
      layer.destroy({ children: true });
    },
  };
}
