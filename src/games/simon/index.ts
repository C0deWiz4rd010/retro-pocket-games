import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action } from '@core/InputManager';

const PADS = [
  { color: 0x3ddc84, dim: 0x1d6e44, q: 0 }, // green TL
  { color: 0xff4d4d, dim: 0x7a2424, q: 1 }, // red TR
  { color: 0xffd200, dim: 0x7a6400, q: 2 }, // yellow BL
  { color: 0x00f7ff, dim: 0x067a7e, q: 3 }, // blue BR
];

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.min(W, H) * 0.42;

  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const seq: number[] = [];
  let inputIdx = 0;
  let lit = -1;
  let over = false;
  let phase: 'show' | 'input' | 'idle' = 'idle';
  let showIdx = 0;
  let timer = 0.6;

  ctx.hud.setScore(0);
  ctx.hud.setLabel('WATCH');

  const flash = (pad: number, dur = 0.42): void => {
    lit = pad;
    ctx.audio.sfx('blip');
    timer = dur;
  };

  const nextRound = (): void => {
    seq.push(ctx.rng.int(0, 3));
    inputIdx = 0;
    showIdx = 0;
    phase = 'show';
    timer = 0.4;
    lit = -1;
    ctx.hud.setScore(seq.length - 1);
    ctx.hud.setLabel('WATCH');
  };

  const press = (pad: number): void => {
    if (phase !== 'input' || over) return;
    flash(pad, 0.25);
    if (seq[inputIdx] === pad) {
      inputIdx++;
      if (inputIdx >= seq.length) {
        phase = 'idle';
        timer = 0.6;
        ctx.audio.sfx('coin');
      }
    } else {
      over = true;
      ctx.audio.sfx('gameover');
      ctx.gameOver(seq.length - 1, { len: seq.length - 1 });
    }
  };

  const padForPoint = (x: number, y: number): number => (x < cx ? 0 : 1) + (y < cy ? 0 : 2);
  const offTap = ctx.input.on('tap', ({ x, y }) => press(padForPoint(x, y)));
  const ACTIONS: Partial<Record<Action, number>> = { up: 0, left: 0, right: 1, down: 2, a: 3, b: 2 };
  const offDown = ctx.input.on('down', (a) => {
    const p = ACTIONS[a];
    if (p !== undefined) press(p);
  });

  const draw = (): void => {
    g.clear();
    PADS.forEach((p) => {
      const start = [Math.PI, -Math.PI / 2, Math.PI / 2, 0][p.q]!;
      g.moveTo(cx, cy);
      g.arc(cx, cy, R, start, start + Math.PI / 2);
      g.fill({ color: lit === p.q ? p.color : p.dim });
    });
    g.circle(cx, cy, R * 0.32).fill({ color: 0x14141f });
    g.circle(cx, cy, R * 0.32).stroke({ width: 3, color: 0x2b2b40 });
  };

  return {
    update(dt) {
      if (over) return;
      timer -= dt;
      if (phase === 'idle' && timer <= 0) {
        nextRound();
      } else if (phase === 'show') {
        if (lit >= 0 && timer <= 0) {
          lit = -1;
          timer = 0.18;
        } else if (lit < 0 && timer <= 0) {
          if (showIdx < seq.length) {
            flash(seq[showIdx]!, 0.42);
            showIdx++;
          } else {
            phase = 'input';
            ctx.hud.setLabel('REPEAT');
          }
        }
      } else if (phase === 'input' && lit >= 0 && timer <= 0) {
        lit = -1;
      }
      draw();
    },
    destroy() {
      offTap();
      offDown();
      layer.destroy({ children: true });
    },
  };
}
