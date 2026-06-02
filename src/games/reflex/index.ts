import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

/**
 * Reflex Grid: a target lights up at a random spot; tap it as fast as you can. Average
 * reaction time drives the score; tapping the wrong spot or being too slow costs a life.
 */
export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  const info = new Text({
    text: 'TAP THE TARGET',
    style: { fontFamily: 'VT323, monospace', fontSize: 22, fill: 0x9bffce, align: 'center' },
  });
  info.anchor.set(0.5);
  info.position.set(W / 2, H * 0.2);
  layer.addChild(g, info);

  const R = Math.min(W, H) * 0.12;
  let target: { x: number; y: number } | null = null;
  let waiting = 0; // delay before next target
  let shownAt = 0;
  let rounds = 0;
  let totalMs = 0;
  let lives = 3;
  let over = false;
  let best = Infinity;

  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);

  const schedule = (): void => {
    target = null;
    waiting = 0.5 + ctx.rng.next() * 1.8;
  };
  schedule();

  const spawn = (): void => {
    target = {
      x: R + ctx.rng.next() * (W - 2 * R),
      y: H * 0.32 + ctx.rng.next() * (H * 0.55 - R),
    };
    shownAt = performance.now();
    ctx.audio.sfx('blip');
  };

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (over) return;
    if (!target) {
      // tapped too early
      lives--;
      ctx.hud.setLives(lives);
      ctx.audio.sfx('hit');
      info.text = 'TOO EARLY!';
      if (lives <= 0) return end();
      schedule();
      return;
    }
    if (Math.hypot(x - target.x, y - target.y) < R * 1.2) {
      const ms = performance.now() - shownAt;
      rounds++;
      totalMs += ms;
      best = Math.min(best, ms);
      const avg = totalMs / rounds;
      ctx.hud.setScore(Math.round(avg));
      info.text = `${Math.round(ms)}ms  (best ${Math.round(best)})`;
      ctx.audio.sfx('coin');
      schedule();
    }
  });

  function end(): void {
    over = true;
    ctx.audio.sfx('gameover');
    const avg = rounds ? Math.round(totalMs / rounds) : 9999;
    // lower avg = better; score rewards speed
    ctx.gameOver(Math.max(0, 5000 - avg * 5) + rounds * 20, { avg, rounds });
  }

  const draw = (): void => {
    g.clear();
    if (target) {
      g.circle(target.x, target.y, R).fill({ color: 0x26a69a });
      g.circle(target.x, target.y, R * 0.6).fill({ color: 0xffd200 });
      g.circle(target.x, target.y, R * 0.25).fill({ color: 0xffffff });
    }
  };

  return {
    update(dt) {
      if (over) return;
      if (!target) {
        waiting -= dt;
        if (waiting <= 0) spawn();
      } else {
        // 1.6s window to react
        if (performance.now() - shownAt > 1600) {
          lives--;
          ctx.hud.setLives(lives);
          ctx.audio.sfx('hit');
          info.text = 'TOO SLOW!';
          if (lives <= 0) return end();
          schedule();
        }
      }
      draw();
    },
    destroy() {
      offTap();
      layer.destroy({ children: true });
    },
  };
}
