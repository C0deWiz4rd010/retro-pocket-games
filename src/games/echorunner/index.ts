import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import { idx } from '@kits/grid/core';
import { burst, drawBackdrop, drawSparks, type Spark, updateSparks } from '@games/_shared/juice';

const N = 4;

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const size = Math.min(W - 42, H - 172);
  const cell = size / N;
  const ox = (W - size) / 2;
  const oy = 126;
  const layer = new Container();
  const g = new Graphics();
  layer.addChild(g);
  ctx.stage.addChild(layer);
  const sparks: Spark[] = [];
  const sequence: number[] = [];
  let inputAt = 0;
  let showAt = 0;
  let showTimer = 0;
  let phase: 'watch' | 'repeat' = 'watch';
  let score = 0;
  let lives = 3;
  let t = 0;
  let over = false;

  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('WATCH');

  const addStep = (): void => {
    sequence.push(ctx.rng.int(0, N * N - 1));
    phase = 'watch';
    showAt = 0;
    showTimer = 0.42;
    inputAt = 0;
    ctx.hud.setLabel('WATCH');
  };
  addStep();

  const currentHighlight = (): number => (phase === 'watch' && showTimer > 0 && showAt < sequence.length ? sequence[showAt]! : -1);

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (over || phase !== 'repeat') return;
    const c = Math.floor((x - ox) / cell);
    const r = Math.floor((y - oy) / cell);
    if (c < 0 || r < 0 || c >= N || r >= N) return;
    const pick = idx(N, c, r);
    if (pick === sequence[inputAt]) {
      inputAt++;
      score += 50 + sequence.length * 10;
      ctx.hud.setScore(score);
      ctx.audio.sfx('coin');
      burst(sparks, ctx.rng, ox + c * cell + cell / 2, oy + r * cell + cell / 2, 0x60a5fa, 10, 110);
      if (inputAt >= sequence.length) {
        score += sequence.length * 80;
        ctx.fx.floatingText(`LEVEL ${sequence.length + 1}`, W / 2, oy - 24, 0xffd200);
        ctx.audio.sfx('powerup');
        addStep();
      }
    } else {
      lives--;
      ctx.hud.setLives(lives);
      ctx.audio.sfx('hit');
      ctx.fx.screenShake(5, 0.1);
      if (lives <= 0) {
        over = true;
        ctx.gameOver(score, { length: sequence.length });
      } else {
        phase = 'watch';
        showAt = 0;
        showTimer = 0.42;
        inputAt = 0;
      }
    }
  });

  function draw(): void {
    g.clear();
    drawBackdrop(g, W, H, t, 0x1e3a8a, 0x050611);
    const hi = currentHighlight();
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const i = idx(N, c, r);
        const x = ox + c * cell;
        const y = oy + r * cell;
        const on = i === hi;
        g.roundRect(x + 5, y + 5, cell - 10, cell - 10, 9)
          .fill({ color: on ? 0x60a5fa : 0x111a33, alpha: on ? 0.95 : 0.82 })
          .stroke({ width: 2, color: on ? 0xffffff : 0x29456d, alpha: on ? 0.65 : 0.75 });
        if (phase === 'repeat' && inputAt < sequence.length && sequence[inputAt] === i) {
          g.circle(x + cell / 2, y + cell / 2, cell * 0.1 + Math.sin(t * 7) * 2).fill({ color: 0xffd200, alpha: 0.35 });
        }
      }
    }
    drawSparks(g, sparks);
  }

  return {
    update(dt) {
      if (over) return;
      t += dt;
      updateSparks(sparks, dt);
      if (phase === 'watch') {
        showTimer -= dt;
        if (showTimer <= 0) {
          showAt++;
          if (showAt >= sequence.length) {
            phase = 'repeat';
            ctx.hud.setLabel(`REPEAT ${sequence.length}`);
          } else {
            showTimer = 0.42;
            ctx.audio.sfx('blip');
          }
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

