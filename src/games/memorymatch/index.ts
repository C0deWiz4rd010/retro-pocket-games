import type { Game, GameContext } from '@core/types';
import { drawSparks, updateSparks } from '@kits/arcade/juice';
import {
  CYAN,
  PINK,
  GOLD,
  GREEN,
  BLUE,
  VIOLET,
  WHITE,
  makeLayer,
  backdrop,
} from '@kits/arcade/concept';

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const { layer, g, sparks } = makeLayer(ctx);
  const cols = 4;
  const rows = 4;
  const size = Math.min(W - 34, H - 90);
  const card = size / cols;
  const ox = (W - size) / 2;
  const oy = 78;
  const vals = [...Array(8).keys(), ...Array(8).keys()].sort(() => ctx.rng.next() - 0.5);
  const open = new Set<number>();
  const found = new Set<number>();
  let first: number | null = null;
  let lock = 0;
  let moves = 0;
  let score = 1200;
  let streak = 0;
  let peek = 1.6; // Feature: start-of-round preview (all cards briefly shown)
  let t = 0;
  let complete = false;
  // Feature: countdown timer (match adds time, mismatch costs time)
  const maxTime = 45;
  let timeLeft = maxTime;
  let started = false;
  ctx.hud.setScore(score);
  ctx.hud.setLabel('MEMORIZE…');
  const colors = [PINK, CYAN, GOLD, GREEN, VIOLET, BLUE, 0xff7b00, 0xffffff];
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'b' && peek <= 0 && score >= 100) {
      peek = 0.7;
      score = Math.max(0, score - 100);
      ctx.hud.setScore(score);
      ctx.hud.toast('PEEK -100');
      ctx.audio.sfx('powerup');
      draw();
    }
  });
  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (lock > 0) return;
    const c = Math.floor((x - ox) / card);
    const r = Math.floor((y - oy) / card);
    const i = r * cols + c;
    if (c < 0 || r < 0 || c >= cols || r >= rows || open.has(i) || found.has(i)) return;
    open.add(i);
    if (first === null) first = i;
    else {
      moves++;
      if (vals[first] === vals[i]) {
        found.add(first);
        found.add(i);
        first = null;
        streak++;
        score += 180 + streak * 45;
        timeLeft = Math.min(maxTime, timeLeft + 3); // matches add time
        ctx.audio.sfx('coin');
        ctx.fx.floatingText(
          `x${streak} +3s`,
          ox + (i % cols) * card + card / 2,
          oy + Math.floor(i / cols) * card,
          GOLD,
        );
      } else {
        streak = 0;
        lock = 0.72;
        score = Math.max(0, score - 35);
        timeLeft = Math.max(0, timeLeft - 2); // mismatches cost time
      }
      ctx.hud.setScore(score);
      ctx.hud.setLabel(streak > 1 ? `STREAK x${streak}` : `${Math.ceil(timeLeft)}s`);
    }
    draw();
  });
  function draw(): void {
    g.clear();
    backdrop(g, W, H, t, H * 0.76);
    for (let i = 0; i < vals.length; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = ox + c * card;
      const y = oy + r * card;
      const face = open.has(i) || found.has(i) || peek > 0;
      g.roundRect(x + 5, y + 5, card - 10, card - 10, 9)
        .fill({ color: face ? colors[vals[i]!]! : 0x14141f })
        .stroke({ width: 2, color: face ? WHITE : CYAN, alpha: 0.34 });
      if (face) {
        g.circle(x + card / 2, y + card / 2, card * 0.18).fill({ color: WHITE, alpha: 0.35 });
        g.rect(x + card * 0.34, y + card * 0.34, card * 0.32, card * 0.32).fill({
          color: 0x050511,
          alpha: 0.18,
        });
      } else {
        g.rect(x + card * 0.36, y + card * 0.36, card * 0.28, card * 0.28).stroke({
          width: 2,
          color: PINK,
          alpha: 0.6,
        });
      }
    }
    // timer bar
    const tw = size * (timeLeft / maxTime);
    g.rect(ox, oy - 12, size, 5).fill({ color: 0x000000, alpha: 0.4 });
    g.rect(ox, oy - 12, tw, 5).fill({ color: timeLeft < 10 ? PINK : GREEN });
    drawSparks(g, sparks);
  }
  draw();
  return {
    update(dt) {
      t += dt;
      updateSparks(sparks, dt);
      if (peek > 0) {
        peek -= dt;
        if (peek <= 0) {
          started = true;
          ctx.hud.setLabel(`${Math.ceil(timeLeft)}s`);
          draw();
        }
      } else if (!complete) {
        // Feature: countdown runs once the preview ends
        started = true;
        timeLeft -= dt;
        if (timeLeft <= 0) {
          timeLeft = 0;
          complete = true;
          ctx.hud.toast("TIME'S UP!");
          ctx.gameOver(score, { moves, streak });
        }
      }
      if (started && Math.floor(t * 2) % 2 === 0)
        ctx.hud.setLabel(streak > 1 ? `STREAK x${streak}` : `${Math.ceil(timeLeft)}s`);
      if (lock > 0) {
        lock -= dt;
        if (lock <= 0) {
          open.clear();
          for (const i of found) open.add(i);
          first = null;
          draw();
        }
      }
      if (!complete && found.size === vals.length) {
        complete = true;
        const bonus = Math.ceil(timeLeft) * 15; // Feature: time bonus on completion
        score += bonus;
        ctx.hud.setScore(score);
        ctx.hud.toast(`PERFECT! +${bonus}`);
        ctx.gameOver(score, { moves, streak });
      }
    },
    destroy() {
      offDown();
      offTap();
      layer.destroy({ children: true });
    },
  };
}
