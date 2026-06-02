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

  const secret = Array.from({ length: SLOTS }, () => ctx.rng.int(0, COLORS.length - 1));
  const guesses: number[][] = [];
  const feedback: { black: number; white: number }[] = [];
  let current: number[] = [];
  let over = false;
  let selColor = 0;

  ctx.hud.setScore(0);
  ctx.hud.setLabel('CRACK THE CODE');

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

  const submit = (): void => {
    if (current.length < SLOTS) return;
    const fb = score(current);
    guesses.push([...current]);
    feedback.push(fb);
    ctx.audio.sfx('blip');
    if (fb.black === SLOTS) {
      over = true;
      ctx.audio.sfx('levelup');
      ctx.hud.toast('CRACKED!');
      ctx.gameOver((MAX_ROWS - guesses.length + 1) * 100, { tries: guesses.length });
    } else if (guesses.length >= MAX_ROWS) {
      over = true;
      ctx.audio.sfx('gameover');
      ctx.gameOver(0, { tries: guesses.length });
    }
    current = [];
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
