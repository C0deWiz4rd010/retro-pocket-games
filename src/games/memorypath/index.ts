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
  let inputTimer = 0; // Feature: per-step time limit
  let inputBudget = 0;
  let perfectStreak = 0; // Feature: flawless-level streak
  let mistakeThisLevel = false;

  ctx.hud.setScore(score);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('WATCH');

  // Feature: playback speeds up as the path grows
  const revealDur = (): number => Math.max(0.2, 0.5 - sequence.length * 0.018);

  function extend(): void {
    sequence.push(ctx.rng.int(0, 8));
    index = 0;
    showCursor = 0;
    showTimer = revealDur();
    accepting = false;
    mistakeThisLevel = false;
    ctx.hud.setLabel('WATCH');
  }

  function fail(): void {
    mistakeThisLevel = true;
    perfectStreak = 0;
    lives--;
    accepting = false;
    ctx.audio.sfx('hit');
    ctx.fx.screenShake(5, 0.12);
    ctx.hud.setLives(lives);
    if (lives <= 0) { ctx.gameOver(score, { level: sequence.length }); return; }
    extend();
  }

  function tapCell(i: number): void {
    if (!accepting) return;
    if (sequence[index] === i) {
      cells[i]!.lit = 0.18;
      index++;
      inputTimer = inputBudget; // reset timer on each correct tap
      score += 80;
      ctx.audio.sfx('blip');
      if (index >= sequence.length) {
        if (!mistakeThisLevel) perfectStreak++; else perfectStreak = 0;
        const mult = 1 + Math.floor(perfectStreak / 3);
        score += sequence.length * 120 * mult;
        if (perfectStreak >= 3) ctx.hud.toast(`FLAWLESS x${mult}`);
        ctx.hud.setScore(score);
        ctx.audio.sfx('coin');
        extend();
      }
    } else {
      fail();
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
            showTimer = revealDur() + 0.15;
          } else {
            accepting = true;
            index = 0;
            inputBudget = Math.max(1.6, 3.5 - sequence.length * 0.08);
            inputTimer = inputBudget;
            ctx.hud.setLabel(`LEVEL ${sequence.length}`);
          }
        }
      } else if (lives > 0) {
        // Feature: run out of time on a step → miss
        inputTimer -= dt;
        if (inputTimer <= 0) { ctx.hud.toast('TOO SLOW!'); fail(); }
      }
      g.clear();
      // input time ring
      if (accepting && inputBudget > 0) {
        const frac = Math.max(0, inputTimer / inputBudget);
        g.arc(W / 2, 66, 14, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2).stroke({ width: 4, color: frac < 0.3 ? 0xff4d4d : 0x60a5fa, alpha: 0.9 });
      }
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
