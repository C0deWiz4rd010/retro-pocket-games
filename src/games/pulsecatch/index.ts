import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  const g = new Graphics();
  const label = new Text({ text: 'PULSE CATCH', style: { fontFamily: 'VT323, monospace', fontSize: 30, fill: 0xfb7185 } });
  label.anchor.set(0.5);
  label.position.set(W / 2, 58);
  layer.addChild(g, label);
  ctx.stage.addChild(layer);

  let x = 0;
  let dir = 1;
  let score = 0;
  let lives = 3;
  let streak = 0;
  let speed = 220;
  const laneX = 34;
  const laneY = H * 0.48;
  const laneW = W - laneX * 2;
  let zoneX = laneX + ctx.rng.next() * (laneW - 74);
  let zoneW = 70;
  let goldZone = false; // Feature: golden bonus zone
  let zoneVx = 0; // Feature: moving zone at high streak

  ctx.hud.setScore(score);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('TIME IT');

  function resetZone(): void {
    goldZone = ctx.rng.next() < 0.15;
    zoneW = goldZone ? 40 : Math.max(34, 74 - streak * 4);
    zoneX = laneX + ctx.rng.next() * (laneW - zoneW);
    speed = 220 + streak * 22;
    zoneVx = streak >= 5 ? (ctx.rng.next() < 0.5 ? -1 : 1) * (60 + streak * 8) : 0;
  }

  function catchPulse(): void {
    const px = laneX + x * laneW;
    if (px >= zoneX && px <= zoneX + zoneW) {
      streak++;
      // Feature: perfect-centre bonus
      const perfect = Math.abs(px - (zoneX + zoneW / 2)) < zoneW * 0.2;
      let pts = 140 + streak * 35 + (perfect ? 150 : 0);
      if (goldZone) { pts += 300; lives = Math.min(5, lives + 1); ctx.hud.setLives(lives); ctx.hud.toast('GOLD +1 LIFE'); }
      score += pts;
      ctx.audio.sfx(goldZone ? 'powerup' : 'coin');
      ctx.fx.floatingText(perfect ? `PERFECT x${streak}` : `x${streak}`, W / 2, laneY - 70, goldZone ? 0xffd200 : 0xfb7185);
      resetZone();
    } else {
      streak = 0;
      lives--;
      resetZone();
      ctx.audio.sfx('hit');
      ctx.fx.screenShake(5, 0.12);
      ctx.hud.setLives(lives);
      if (lives <= 0) {
        ctx.gameOver(score);
        return;
      }
    }
    ctx.hud.setScore(score);
  }

  const offTap = ctx.input.on('tap', catchPulse);
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a' || a === 'b' || a === 'start') catchPulse();
  });

  return {
    update(dt) {
      x += dir * (speed / laneW) * dt;
      if (x >= 1) {
        x = 1;
        dir = -1;
      } else if (x <= 0) {
        x = 0;
        dir = 1;
      }
      // Feature: moving zone drifts at high streak
      if (zoneVx) {
        zoneX += zoneVx * dt;
        if (zoneX < laneX) { zoneX = laneX; zoneVx *= -1; }
        else if (zoneX + zoneW > laneX + laneW) { zoneX = laneX + laneW - zoneW; zoneVx *= -1; }
      }
      const px = laneX + x * laneW;
      g.clear();
      g.roundRect(laneX, laneY, laneW, 24, 12).fill({ color: 0x111827 }).stroke({ width: 2, color: 0x334155 });
      g.roundRect(zoneX, laneY - 6, zoneW, 36, 12).fill({ color: goldZone ? 0xffd200 : 0x22c55e, alpha: 0.75 });
      g.rect(zoneX + zoneW / 2 - 1, laneY - 6, 2, 36).fill({ color: 0xffffff, alpha: 0.7 }); // centre marker
      g.circle(px, laneY + 12, 15).fill({ color: 0xfb7185 });
      g.roundRect(W * 0.24, H * 0.7, W * 0.52, 58, 14).fill({ color: 0x4c0519 }).stroke({ width: 2, color: 0xfb7185 });
    },
    destroy() {
      offTap();
      offDown();
      layer.destroy({ children: true });
    },
  };
}
