import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  const g = new Graphics();
  const label = new Text({ text: '', style: { fontFamily: 'VT323, monospace', fontSize: 30, fill: 0xfacc15 } });
  label.anchor.set(0.5);
  label.position.set(W / 2, H * 0.18);
  layer.addChild(g, label);
  ctx.stage.addChild(layer);

  let score = 0;
  let pin = 1;
  let lives = 4;
  let angle = 0;
  let target = ctx.rng.next() * Math.PI * 2;
  let width = 0.7;
  let speed = 2.3;

  ctx.hud.setScore(score);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('PIN 1/5');

  function resetPin(): void {
    target = ctx.rng.next() * Math.PI * 2;
    width = Math.max(0.24, 0.72 - pin * 0.08);
    speed = 2.1 + pin * 0.42;
    ctx.hud.setLabel(`PIN ${pin}/5`);
  }

  function diff(a: number, b: number): number {
    return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  }

  function pick(): void {
    const hit = diff(angle, target) < width / 2;
    if (hit) {
      score += 300 + pin * 80 + Math.floor((width - diff(angle, target)) * 120);
      ctx.audio.sfx('coin');
      ctx.fx.floatingText('CLICK', W / 2, H * 0.3, 0xfacc15);
      ctx.fx.flashRect(W * 0.2, H * 0.24, W * 0.6, H * 0.56, 0xfacc15);
      pin++;
      if (pin > 5) {
        ctx.gameOver(score, { pins: 5 });
        return;
      }
      resetPin();
    } else {
      lives--;
      ctx.audio.sfx('hit');
      ctx.fx.screenShake(5, 0.12);
      ctx.hud.setLives(lives);
      if (lives <= 0) ctx.gameOver(score, { pins: pin - 1 });
    }
    ctx.hud.setScore(score);
  }

  const offTap = ctx.input.on('tap', pick);
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a' || a === 'b' || a === 'start') pick();
  });

  resetPin();
  return {
    update(dt) {
      angle = (angle + speed * dt) % (Math.PI * 2);
      const cx = W / 2;
      const cy = H * 0.54;
      const r = Math.min(W, H) * 0.25;
      const tx1 = target - width / 2;
      const tx2 = target + width / 2;
      label.text = 'TAP IN THE GOLD ARC';
      g.clear();
      g.circle(cx, cy, r).stroke({ width: 8, color: 0x334155 });
      g.arc(cx, cy, r, tx1, tx2).stroke({ width: 12, color: 0xfacc15 });
      g.moveTo(cx, cy).lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r).stroke({ width: 4, color: 0xf8fafc });
      g.circle(cx, cy, 9).fill({ color: 0xf8fafc });
    },
    destroy() {
      offTap();
      offDown();
      layer.destroy({ children: true });
    },
  };
}
