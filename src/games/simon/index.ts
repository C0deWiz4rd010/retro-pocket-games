import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action } from '@core/InputManager';

const PADS = [
  { color: 0x3ddc84, dim: 0x1d6e44, q: 0 }, // green TL
  { color: 0xff4d4d, dim: 0x7a2424, q: 1 }, // red TR
  { color: 0xffd200, dim: 0x7a6400, q: 2 }, // yellow BL
  { color: 0x00f7ff, dim: 0x067a7e, q: 3 }, // blue BR
];

interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: number }

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
  const centerText = new Text({ text: '0', style: { fontFamily: 'Inter, sans-serif', fontWeight: '800', fontSize: R * 0.2, fill: 0xffffff, align: 'center' } });
  centerText.anchor.set(0.5);
  centerText.position.set(cx, cy);
  layer.addChild(centerText);

  const seq: number[] = [];
  const particles: Particle[] = [];
  let inputIdx = 0;
  let lit = -1;
  let over = false;
  let phase: 'show' | 'input' | 'idle' = 'idle';
  let showIdx = 0;
  let timer = 0.6;
  let score = 0;
  let inputTimer = 0; // Feature: per-press time limit
  let inputBudget = 3;

  ctx.hud.setScore(0);
  ctx.hud.setLabel('WATCH');

  // Feature: playback speeds up as the sequence grows
  const litDur = (): number => Math.max(0.16, 0.42 - seq.length * 0.012);
  const gapDur = (): number => Math.max(0.07, 0.18 - seq.length * 0.005);

  const padCenter = (q: number): { x: number; y: number } => {
    const a = [Math.PI * 1.25, Math.PI * 1.75, Math.PI * 0.75, Math.PI * 0.25][q]!;
    return { x: cx + Math.cos(a) * R * 0.6, y: cy + Math.sin(a) * R * 0.6 };
  };
  const sparkle = (q: number, color: number): void => {
    const p = padCenter(q);
    for (let i = 0; i < 10; i++) {
      const a = ctx.rng.next() * Math.PI * 2;
      const s = 40 + ctx.rng.next() * 90;
      particles.push({ x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, color });
    }
  };

  const flash = (pad: number, dur = 0.42): void => {
    lit = pad;
    sparkle(pad, PADS[pad]!.color);
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
    centerText.text = String(seq.length);
    ctx.hud.setLabel(`WATCH · L${seq.length}`);
  };

  const press = (pad: number): void => {
    if (phase !== 'input' || over) return;
    flash(pad, 0.25);
    if (seq[inputIdx] === pad) {
      inputIdx++;
      inputBudget = Math.max(1.4, 3 - seq.length * 0.05);
      inputTimer = inputBudget;
      if (inputIdx >= seq.length) {
        // Feature: length-scaled scoring with a speed bonus
        score += 10 * seq.length + Math.ceil(inputTimer * 5);
        ctx.hud.setScore(score);
        phase = 'idle';
        timer = 0.6;
        ctx.audio.sfx('coin');
      }
    } else {
      over = true;
      ctx.audio.sfx('gameover');
      ctx.gameOver(score, { len: seq.length - 1 });
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
    // particles
    for (const p of particles) g.circle(p.x, p.y, 3 * Math.min(1, p.life * 2)).fill({ color: p.color, alpha: Math.min(1, p.life * 2) });
    g.circle(cx, cy, R * 0.32).fill({ color: 0x14141f });
    g.circle(cx, cy, R * 0.32).stroke({ width: 3, color: 0x2b2b40 });
    // input time ring
    if (phase === 'input' && inputBudget > 0) {
      const frac = Math.max(0, inputTimer / inputBudget);
      g.arc(cx, cy, R * 0.38, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2).stroke({ width: 4, color: frac < 0.3 ? 0xff4d4d : 0x3ddc84, alpha: 0.9 });
    }
  };

  return {
    update(dt) {
      if (over) return;
      timer -= dt;
      // particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }

      if (phase === 'idle' && timer <= 0) {
        nextRound();
      } else if (phase === 'show') {
        if (lit >= 0 && timer <= 0) {
          lit = -1;
          timer = gapDur();
        } else if (lit < 0 && timer <= 0) {
          if (showIdx < seq.length) {
            flash(seq[showIdx]!, litDur());
            showIdx++;
          } else {
            phase = 'input';
            inputBudget = Math.max(1.4, 3 - seq.length * 0.05);
            inputTimer = inputBudget;
            ctx.hud.setLabel('REPEAT');
          }
        }
      } else if (phase === 'input') {
        if (lit >= 0 && timer <= 0) lit = -1;
        // Feature: running out of time fails the round
        inputTimer -= dt;
        if (inputTimer <= 0) {
          over = true;
          ctx.audio.sfx('gameover');
          ctx.hud.toast('TOO SLOW!');
          ctx.gameOver(score, { len: seq.length - 1 });
          return;
        }
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
