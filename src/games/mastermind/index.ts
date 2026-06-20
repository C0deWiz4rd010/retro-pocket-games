import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action } from '@core/InputManager';

const COLORS = [0xff4d4d, 0xffd200, 0x3ddc84, 0x00f7ff, 0xb388ff, 0xff80ab];
const SLOTS = 4;
const MAX_ROWS = 10;

export default function createGame(ctx: GameContext): Game {
  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const rowH = Math.min(40, (ctx.height - 80) / MAX_ROWS);
  const peg = rowH * 0.7;
  const boardX = ctx.width / 2 - (SLOTS * peg * 1.4) / 2;
  const oy = 50;

  let secret = Array.from({ length: SLOTS }, () => ctx.rng.int(0, COLORS.length - 1));
  let guesses: number[][] = [];
  let feedback: { black: number; white: number }[] = [];
  let current: number[] = [];
  let over = false;
  let selColor = 0;
  let round = 1; // Feature: round progression
  let total = 0;
  let hints = 1; // Feature: reveal one secret peg per round
  const revealed = new Map<number, number>(); // pos -> colour

  ctx.hud.setScore(0);
  const setLabel = (): void => ctx.hud.setLabel(`R${round} · ROW ${guesses.length + 1}/${MAX_ROWS} · 💡${hints}`);
  setLabel();

  const score = (guess: number[]): { black: number; white: number } => {
    let black = 0;
    let white = 0;
    const s = [...secret];
    const gg = [...guess];
    for (let i = 0; i < SLOTS; i++)
      if (gg[i] === s[i]) {
        black++;
        s[i] = -1;
        gg[i] = -2;
      }
    for (let i = 0; i < SLOTS; i++) {
      if (gg[i] === -2) continue;
      const j = s.indexOf(gg[i]!);
      if (j >= 0) {
        white++;
        s[j] = -1;
      }
    }
    return { black, white };
  };

  const newRound = (): void => {
    secret = Array.from({ length: SLOTS }, () => ctx.rng.int(0, COLORS.length - 1));
    guesses = [];
    feedback = [];
    current = [];
    revealed.clear();
    hints = 1;
    round++;
    setLabel();
  };

  const submit = (): void => {
    if (current.length < SLOTS) return;
    const fb = score(current);
    guesses.push([...current]);
    feedback.push(fb);
    ctx.audio.sfx('blip');
    if (fb.black === SLOTS) {
      // Feature: cracked → bank a bonus and start a fresh code
      const bonus = (MAX_ROWS - guesses.length + 1) * 100 + round * 100;
      total += bonus;
      ctx.hud.setScore(total);
      ctx.audio.sfx('levelup');
      ctx.hud.toast(`CRACKED! +${bonus}`);
      newRound();
      draw();
      return;
    } else if (guesses.length >= MAX_ROWS) {
      over = true;
      ctx.audio.sfx('gameover');
      ctx.hud.toast(`CODE WAS…`);
      ctx.gameOver(total, { round });
      current = [];
      draw();
      return;
    }
    current = [];
    setLabel();
    draw();
  };

  const useHint = (): void => {
    if (over || hints <= 0) return;
    const opts: number[] = [];
    for (let i = 0; i < SLOTS; i++) if (!revealed.has(i)) opts.push(i);
    if (!opts.length) return;
    const pos = ctx.rng.pick(opts);
    revealed.set(pos, secret[pos]!);
    hints--;
    ctx.audio.sfx('powerup');
    ctx.hud.toast(`HINT: slot ${pos + 1}`);
    setLabel();
    draw();
  };

  const offDown = ctx.input.on('down', (a: Action) => {
    if (over) return;
    if (a === 'left') selColor = (selColor + COLORS.length - 1) % COLORS.length;
    else if (a === 'right') selColor = (selColor + 1) % COLORS.length;
    else if (a === 'a') {
      if (current.length < SLOTS) {
        current.push(selColor);
        ctx.audio.sfx('blip');
      }
      if (current.length === SLOTS) submit();
    } else if (a === 'b') {
      current.pop();
    } else if (a === 'start' || a === 'select') {
      useHint();
      return;
    }
    draw();
  });

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (over) return;
    // palette row at bottom
    const palY = ctx.height - 50;
    if (y > palY - peg && y < palY + peg) {
      const i = Math.floor((x - (ctx.width / 2 - (COLORS.length * peg * 1.2) / 2)) / (peg * 1.2));
      if (i >= 0 && i < COLORS.length) {
        if (current.length < SLOTS) {
          current.push(i);
          ctx.audio.sfx('blip');
        }
        if (current.length === SLOTS) submit();
        draw();
      }
    }
  });

  function draw(): void {
    g.clear();
    // past guesses
    for (let r = 0; r < MAX_ROWS; r++) {
      const y = oy + r * rowH;
      const guess = guesses[r];
      for (let s = 0; s < SLOTS; s++) {
        const x = boardX + s * peg * 1.4;
        const col = guess ? COLORS[guess[s]!]! : 0x2b2b40;
        g.circle(x + peg / 2, y + peg / 2, peg / 2).fill({ color: col });
      }
      const fb = feedback[r];
      if (fb) {
        for (let k = 0; k < SLOTS; k++) {
          const fx = boardX + SLOTS * peg * 1.4 + 6 + (k % 2) * 10;
          const fy = y + Math.floor(k / 2) * 10 + 4;
          const c = k < fb.black ? 0x101018 : k < fb.black + fb.white ? 0xffffff : 0x3a3a4a;
          g.circle(fx, fy, 4).fill({ color: c });
        }
      }
    }
    // current row in progress
    const cy = oy + guesses.length * rowH;
    for (let s = 0; s < SLOTS; s++) {
      const x = boardX + s * peg * 1.4;
      const col = current[s] !== undefined ? COLORS[current[s]!]! : 0x14141f;
      g.circle(x + peg / 2, cy + peg / 2, peg / 2).fill({ color: col }).stroke({ width: 2, color: 0x8a8aa3 });
      // Feature: revealed hint markers
      if (revealed.has(s)) {
        g.circle(x + peg / 2, cy + peg / 2, peg * 0.22).fill({ color: COLORS[revealed.get(s)!]! });
        g.circle(x + peg / 2, cy + peg / 2, peg * 0.22).stroke({ width: 2, color: 0xffffff });
      }
    }
    // palette
    const palY = ctx.height - 50;
    const palX = ctx.width / 2 - (COLORS.length * peg * 1.2) / 2;
    COLORS.forEach((c, i) => {
      g.circle(palX + i * peg * 1.2 + peg / 2, palY, peg / 2).fill({ color: c });
      if (i === selColor) g.circle(palX + i * peg * 1.2 + peg / 2, palY, peg / 2 + 3).stroke({ width: 2, color: 0xffffff });
    });
  }
  draw();

  return {
    update() {},
    destroy() {
      offDown();
      offTap();
      layer.destroy({ children: true });
    },
  };
}
