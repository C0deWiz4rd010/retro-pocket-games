import type { Game, GameContext } from '@core/types';
import { drawSparks, updateSparks } from '@kits/arcade/juice';
import { cellAt } from '@kits/arcade/grid';
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
import { reshuffleRest } from './core';

/**
 * Shuffle Match — a memory game where the table moves. Every time you land a pair the cards that
 * are still face-down are dealt out again: you get a short look at the new layout and have to
 * re-memorise it before the clock (which a match refills) runs out.
 */
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
  const vals = ctx.rng.shuffle([...Array(8).keys(), ...Array(8).keys()]);
  const open = new Set<number>();
  const found = new Set<number>();
  let first: number | null = null;
  let lock = 0;
  let moves = 0;
  let score = 1200;
  let streak = 0;
  let shuffles = 0;
  let peek = 1.6; // preview of the whole table (start of round and after every shuffle)
  let t = 0;
  let complete = false;
  const maxTime = 50;
  let timeLeft = maxTime;
  let started = false;
  const cursor = { c: 0, r: 0 };
  let cursorOn = false; // shown once the keyboard / gamepad is used
  ctx.hud.setScore(score);
  ctx.hud.setLabel('MEMORIZE…');
  const colors = [PINK, CYAN, GOLD, GREEN, VIOLET, BLUE, 0xff7b00, 0xffffff];

  const flip = (i: number): void => {
    if (lock > 0 || peek > 0 || complete || open.has(i) || found.has(i)) return;
    open.add(i);
    ctx.audio.sfx('blip');
    if (first === null) {
      first = i;
    } else {
      moves++;
      if (vals[first] === vals[i]) {
        found.add(first);
        found.add(i);
        first = null;
        streak++;
        score += 180 + streak * 45;
        timeLeft = Math.min(maxTime, timeLeft + 4); // matches refill the clock
        ctx.audio.sfx('coin');
        ctx.fx.floatingText(
          `x${streak} +4s`,
          ox + (i % cols) * card + card / 2,
          oy + Math.floor(i / cols) * card,
          GOLD,
        );
        // the twist: deal the remaining cards out again and show them briefly
        if (found.size < vals.length - 2) {
          reshuffleRest(vals, found, (n) => ctx.rng.int(0, n));
          open.clear();
          for (const f of found) open.add(f);
          shuffles++;
          peek = Math.max(0.7, 1.3 - shuffles * 0.06);
          ctx.fx.floatingText('SHUFFLE!', W / 2, oy - 24, CYAN);
          ctx.audio.sfx('select');
        }
      } else {
        streak = 0;
        lock = 0.72;
        score = Math.max(0, score - 35);
        timeLeft = Math.max(0, timeLeft - 2.5); // mismatches cost time
      }
      ctx.hud.setScore(score);
      ctx.hud.setLabel(streak > 1 ? `STREAK x${streak}` : `${Math.ceil(timeLeft)}s`);
    }
    draw();
  };

  const offDown = ctx.input.on('down', (a) => {
    if (a === 'up' || a === 'down' || a === 'left' || a === 'right') {
      cursorOn = true;
      cursor.c = Math.max(
        0,
        Math.min(cols - 1, cursor.c + (a === 'right' ? 1 : a === 'left' ? -1 : 0)),
      );
      cursor.r = Math.max(
        0,
        Math.min(rows - 1, cursor.r + (a === 'down' ? 1 : a === 'up' ? -1 : 0)),
      );
      draw();
    } else if (a === 'a' || a === 'start') {
      cursorOn = true;
      flip(cursor.r * cols + cursor.c);
    } else if (a === 'b' && peek <= 0 && score >= 100) {
      peek = 0.7;
      score = Math.max(0, score - 100);
      ctx.hud.setScore(score);
      ctx.hud.toast('PEEK -100');
      ctx.audio.sfx('powerup');
      draw();
    }
  });
  const offTap = ctx.input.on('tap', ({ x, y }) => {
    cursorOn = false;
    const hit = cellAt({ x: ox, y: oy, cell: card, cols, rows }, x, y);
    if (hit) flip(hit.r * cols + hit.c);
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
      // while peeking, matched cards stay dim so the live ones stand out
      const dim = found.has(i) && peek > 0 ? 0.35 : 1;
      g.roundRect(x + 5, y + 5, card - 10, card - 10, 9)
        .fill({ color: face ? colors[vals[i]!]! : 0x14141f, alpha: dim })
        .stroke({ width: 2, color: face ? WHITE : CYAN, alpha: 0.34 });
      if (face) {
        g.circle(x + card / 2, y + card / 2, card * 0.18).fill({ color: WHITE, alpha: 0.35 * dim });
        // each pair also gets its own number of pips so colour-blind players can match them
        const n = vals[i]! + 1;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 - Math.PI / 2;
          g.circle(
            x + card / 2 + Math.cos(a) * card * 0.3,
            y + card / 2 + Math.sin(a) * card * 0.3,
            3,
          ).fill({ color: 0x050511, alpha: 0.55 * dim });
        }
      } else {
        g.rect(x + card * 0.36, y + card * 0.36, card * 0.28, card * 0.28).stroke({
          width: 2,
          color: PINK,
          alpha: 0.6,
        });
      }
    }
    if (cursorOn)
      g.roundRect(
        ox + cursor.c * card + 2,
        oy + cursor.r * card + 2,
        card - 4,
        card - 4,
        11,
      ).stroke({
        width: 3,
        color: GOLD,
        alpha: 0.95,
      });
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
        }
        draw();
      } else if (!complete) {
        started = true;
        timeLeft -= dt;
        if (timeLeft <= 0) {
          timeLeft = 0;
          complete = true;
          ctx.hud.toast("TIME'S UP!");
          ctx.gameOver(score, { moves, streak, shuffles });
          return;
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
        const bonus = Math.ceil(timeLeft) * 15;
        score += bonus;
        ctx.hud.setScore(score);
        ctx.hud.toast(`PERFECT! +${bonus}`);
        ctx.gameOver(score, { moves, streak, shuffles });
        return;
      }
      draw();
    },
    destroy() {
      offDown();
      offTap();
      layer.destroy({ children: true });
    },
  };
}
