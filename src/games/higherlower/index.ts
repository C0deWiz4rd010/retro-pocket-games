import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  const g = new Graphics();
  const card = new Text({ text: '', style: { fontFamily: 'Press Start 2P, monospace', fontSize: 44, fill: 0xf8fafc } });
  const msg = new Text({ text: 'HIGHER OR LOWER?', style: { fontFamily: 'VT323, monospace', fontSize: 28, fill: 0xfacc15 } });
  card.anchor.set(0.5);
  msg.anchor.set(0.5);
  card.position.set(W / 2, H * 0.34);
  msg.position.set(W / 2, H * 0.52);
  layer.addChild(g, card, msg);
  ctx.stage.addChild(layer);

  let current = ctx.rng.int(0, RANKS.length - 1);
  let score = 0;
  let lives = 3;
  let streak = 0;

  ctx.hud.setScore(score);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('CARDS');

  function guess(higher: boolean): void {
    const next = ctx.rng.int(0, RANKS.length - 1);
    const correct = higher ? next >= current : next <= current;
    msg.text = `${RANKS[current]} -> ${RANKS[next]}`;
    current = next;
    if (correct) {
      streak++;
      score += 100 + streak * 25;
      ctx.audio.sfx('coin');
      ctx.fx.floatingText(`STREAK ${streak}`, W / 2, H * 0.2, 0xfacc15);
    } else {
      streak = 0;
      lives--;
      ctx.audio.sfx('hit');
      ctx.fx.screenShake(5, 0.12);
      ctx.hud.setLives(lives);
      if (lives <= 0) {
        ctx.gameOver(score, { streak });
        return;
      }
    }
    ctx.hud.setScore(score);
    draw();
  }

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (y < H * 0.6) return;
    guess(x >= W / 2);
  });
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'left' || a === 'b') guess(false);
    else if (a === 'right' || a === 'a') guess(true);
  });

  function draw(): void {
    g.clear();
    g.roundRect(W / 2 - 72, H * 0.2, 144, 180, 14).fill({ color: 0x111827 }).stroke({ width: 4, color: 0xf8fafc });
    card.text = RANKS[current] ?? '?';
    const y = H * 0.66;
    g.roundRect(28, y, W / 2 - 42, 78, 12).fill({ color: 0x7f1d1d }).stroke({ width: 2, color: 0xfca5a5 });
    g.roundRect(W / 2 + 14, y, W / 2 - 42, 78, 12).fill({ color: 0x14532d }).stroke({ width: 2, color: 0x86efac });
  }

  draw();
  return {
    update() {},
    destroy() {
      offTap();
      offDown();
      layer.destroy({ children: true });
    },
  };
}
