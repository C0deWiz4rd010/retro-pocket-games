import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

interface Block {
  x: number;
  w: number;
  color: number;
}

const PALETTE = [0xff4d4d, 0xff7b00, 0xffd200, 0x3ddc84, 0x00f7ff, 0xb388ff, 0xff80ab];

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const blockH = Math.min(28, H / 18);
  const stack: Block[] = [{ x: W / 2 - 70, w: 140, color: PALETTE[0]! }];
  let current: Block = { x: 0, w: 140, color: PALETTE[1]! };
  let dir = 1;
  let speed = 150;
  let over = false;
  let score = 0;
  let camY = 0;
  let combo = 0; // Feature: perfect-drop combo

  ctx.hud.setScore(0);
  ctx.hud.setLabel('TAP TO DROP');

  const drop = (): void => {
    if (over) return;
    const below = stack[stack.length - 1]!;
    const left = Math.max(current.x, below.x);
    const right = Math.min(current.x + current.w, below.x + below.w);
    let overlap = right - left;
    if (overlap <= 0) {
      over = true;
      ctx.audio.sfx('explosion');
      ctx.gameOver(score, { height: stack.length });
      return;
    }
    // Feature: perfect drop — near-exact alignment keeps full width (and can grow it)
    const perfect = Math.abs(current.x - below.x) < 6;
    let placedX = left;
    if (perfect) {
      combo++;
      placedX = below.x;
      overlap = below.w;
      if (combo % 3 === 0) overlap = Math.min(W * 0.7, overlap + 8); // Feature: width bonus on a streak
      ctx.fx.floatingText(combo >= 3 ? `PERFECT x${1 + Math.floor(combo / 3)}` : 'PERFECT', W / 2, H * 0.3, 0x3ddc84);
      ctx.fx.screenShake(3, 0.08);
    } else {
      combo = 0;
    }
    const placed: Block = { x: placedX, w: overlap, color: current.color };
    stack.push(placed);
    // Feature: combo multiplier scoring
    const mult = 1 + Math.floor(combo / 3);
    score += Math.round(overlap * (perfect ? mult : 0.5));
    ctx.hud.setScore(score);
    ctx.audio.sfx(perfect ? 'coin' : 'blip');
    speed += 8;
    camY = Math.max(0, (stack.length - 8) * blockH);
    current = { x: 0, w: overlap, color: PALETTE[stack.length % PALETTE.length]! };
    dir = 1;
    ctx.hud.setLabel(combo >= 3 ? `H ${stack.length - 1} · x${mult}` : `H ${stack.length - 1}`);
  };
  const offTap = ctx.input.on('tap', drop);
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a') drop();
  });

  const draw = (): void => {
    g.clear();
    const baseY = H - blockH - 20;
    stack.forEach((b, i) => {
      const y = baseY - i * blockH + camY;
      if (y > -blockH && y < H) g.roundRect(b.x, y, b.w, blockH - 2, 4).fill({ color: b.color });
    });
    const cy = baseY - stack.length * blockH + camY;
    g.roundRect(current.x, cy, current.w, blockH - 2, 4).fill({ color: current.color });
  };

  return {
    update(dt) {
      if (over) return;
      current.x += dir * speed * dt;
      if (current.x <= 0) {
        current.x = 0;
        dir = 1;
      } else if (current.x + current.w >= W) {
        current.x = W - current.w;
        dir = -1;
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
