import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  const g = new Graphics();
  const hint = new Text({ text: 'FIND THE SIGNAL', style: { fontFamily: 'VT323, monospace', fontSize: 30, fill: 0xf97316 } });
  hint.anchor.set(0.5);
  hint.position.set(W / 2, 58);
  layer.addChild(g, hint);
  ctx.stage.addChild(layer);

  let target = newTarget();
  let score = 0;
  let scans = 0;
  let time = 40;
  let last: { x: number; y: number; d: number } | null = null;

  ctx.hud.setScore(score);
  ctx.hud.setLabel('40s');

  function newTarget(): { x: number; y: number } {
    return { x: 38 + ctx.rng.next() * (W - 76), y: 118 + ctx.rng.next() * (H - 166) };
  }

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (y < 105) return;
    const d = Math.hypot(x - target.x, y - target.y);
    scans++;
    last = { x, y, d };
    if (d < 28) {
      const bonus = Math.max(100, 900 - scans * 45 + Math.floor(time * 12));
      score += bonus;
      scans = 0;
      target = newTarget();
      last = null;
      ctx.audio.sfx('coin');
      ctx.fx.floatingText(`+${bonus}`, x, y - 16, 0xf97316);
      ctx.hud.setScore(score);
    } else {
      ctx.audio.sfx('blip');
      ctx.fx.floatingText(d < 80 ? 'HOT' : d < 150 ? 'WARM' : 'COLD', x, y - 14, d < 80 ? 0xef4444 : d < 150 ? 0xfacc15 : 0x60a5fa);
    }
  });

  return {
    update(dt) {
      time -= dt;
      ctx.hud.setLabel(`${Math.ceil(Math.max(0, time))}s`);
      if (time <= 0) ctx.gameOver(score, { scans });
      g.clear();
      g.rect(22, 105, W - 44, H - 130).fill({ color: 0x111827 }).stroke({ width: 2, color: 0x334155 });
      g.circle(target.x, target.y, 8 + Math.sin(performance.now() / 180) * 2).stroke({ width: 1, color: 0x7c2d12, alpha: 0.35 });
      if (last) {
        const color = last.d < 80 ? 0xef4444 : last.d < 150 ? 0xfacc15 : 0x60a5fa;
        g.circle(last.x, last.y, Math.max(12, Math.min(60, last.d / 2))).stroke({ width: 3, color, alpha: 0.65 });
        hint.text = last.d < 80 ? 'HOT' : last.d < 150 ? 'WARM' : 'COLD';
      } else {
        hint.text = 'FIND THE SIGNAL';
      }
    },
    destroy() {
      offTap();
      layer.destroy({ children: true });
    },
  };
}
