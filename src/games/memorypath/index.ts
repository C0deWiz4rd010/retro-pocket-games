import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

type Cell = { x: number; y: number; lit: number };

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  const g = new Graphics();
  layer.addChild(g);
  ctx.stage.addChild(layer);

  const size = Math.min(W - 50, H - 170);
  const cell = size / 3;
  const ox = (W - size) / 2;
  const oy = H - size - 42;
  const cells: Cell[] = Array.from({ length: 9 }, (_, i) => ({
    x: ox + (i % 3) * cell,
    y: oy + Math.floor(i / 3) * cell,
    lit: 0,
  }));
  const sequence: number[] = [];
  let index = 0;
  let showTimer = 0;
  let showCursor = 0;
  let accepting = false;
  let score = 0;
  let lives = 3;

  ctx.hud.setScore(score);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('WATCH');

  function extend(): void {
    sequence.push(ctx.rng.int(0, 8));
    index = 0;
    showCursor = 0;
    showTimer = 0.35;
    accepting = false;
    ctx.hud.setLabel('WATCH');
  }

  function tapCell(i: number): void {
    if (!accepting) return;
    if (sequence[index] === i) {
      cells[i]!.lit = 0.18;
      index++;
      score += 80;
      ctx.audio.sfx('blip');
      if (index >= sequence.length) {
        score += sequence.length * 120;
        ctx.hud.setScore(score);
        ctx.audio.sfx('coin');
        extend();
      }
    } else {
      lives--;
      accepting = false;
      ctx.audio.sfx('hit');
      ctx.fx.screenShake(5, 0.12);
      ctx.hud.setLives(lives);
      if (lives <= 0) {
        ctx.gameOver(score, { level: sequence.length });
        return;
      }
      extend();
    }
    ctx.hud.setScore(score);
  }

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    const c = Math.floor((x - ox) / cell);
    const r = Math.floor((y - oy) / cell);
    if (c < 0 || c >= 3 || r < 0 || r >= 3) return;
    tapCell(r * 3 + c);
  });

  extend();
  return {
    update(dt) {
      for (const c of cells) c.lit = Math.max(0, c.lit - dt);
      if (!accepting) {
        showTimer -= dt;
        if (showTimer <= 0) {
          const next = sequence[showCursor];
          if (next !== undefined) {
            cells[next]!.lit = 0.3;
            showCursor++;
            showTimer = 0.5;
          } else {
            accepting = true;
            index = 0;
            ctx.hud.setLabel(`LEVEL ${sequence.length}`);
          }
        }
      }
      g.clear();
      g.roundRect(W / 2 - 88, 44, 176, 44, 10).fill({ color: 0x111827 }).stroke({ width: 2, color: 0x60a5fa });
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i]!;
        const active = c.lit > 0;
        g.roundRect(c.x + 5, c.y + 5, cell - 10, cell - 10, 10)
          .fill({ color: active ? 0x60a5fa : 0x172554 })
          .stroke({ width: 2, color: active ? 0xbfdbfe : 0x1d4ed8 });
      }
    },
    destroy() {
      offTap();
      layer.destroy({ children: true });
    },
  };
}
