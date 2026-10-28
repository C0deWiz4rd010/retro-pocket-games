import type { Game, GameContext } from '@core/types';
import { burst, drawSparks, updateSparks } from '@kits/arcade/juice';
import { CYAN, PINK, GOLD, GREEN, WHITE, makeLayer, backdrop } from '@kits/arcade/concept';

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const { layer, g, sparks } = makeLayer(ctx);
  const colors = [PINK, GOLD, CYAN, GREEN];
  let color = 0;
  let angle = -Math.PI / 2;
  let score = 0;
  let lives = 3;
  let combo = 0;
  let zone = 1; // Feature: zone multiplier
  let t = 0;
  interface Ring {
    y: number;
    rot: number;
    speed: number;
    passed: boolean;
    star: boolean;
    bomb: boolean;
  }
  const rings: Ring[] = [{ y: 160, rot: 0, speed: 1.1, passed: false, star: false, bomb: false }];
  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('A NEXT / B BACK');
  const switchColor = (dir = 1): void => {
    color = (color + dir + colors.length) % colors.length;
    ctx.audio.sfx('blip');
  };
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a' || a === 'up') switchColor();
    if (a === 'b' || a === 'down') switchColor(-1);
  });
  const offTap = ctx.input.on('tap', () => switchColor());
  function draw(): void {
    g.clear();
    backdrop(g, W, H, t, H * 0.72);
    for (const ring of rings) {
      const r = 58;
      for (let i = 0; i < 4; i++) {
        const a0 = ring.rot + (i * Math.PI) / 2;
        const a1 = a0 + Math.PI / 2 - 0.12;
        g.arc(W / 2, ring.y, r, a0, a1).stroke({
          width: 13,
          color: ring.bomb ? colors[(i + Math.floor(t * 6)) % 4]! : colors[i]!,
          alpha: 0.9,
        });
      }
      if (ring.star) g.star(W / 2, ring.y, 5, 12, 6).fill({ color: GOLD });
      else g.circle(W / 2, ring.y, 5).fill({ color: WHITE, alpha: 0.22 });
    }
    const px = W / 2 + Math.cos(angle) * 94;
    const py = H - 86 + Math.sin(angle) * 28;
    g.circle(px, py, 16).fill({ color: colors[color]! });
    g.circle(px, py, 7).fill({ color: WHITE, alpha: 0.35 });
    drawSparks(g, sparks);
  }
  return {
    update(dt) {
      t += dt;
      updateSparks(sparks, dt);
      angle += dt * 2.2;
      for (const ring of rings) {
        ring.y += Math.min(78 + score * 0.01, 200) * dt;
        ring.rot += ring.speed * dt;
        if (!ring.passed && ring.y > H - 88) {
          ring.passed = true;
          const seg =
            Math.floor(
              ((((Math.PI / 2 - ring.rot) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) /
                (Math.PI / 2),
            ) % 4;
          if (ring.bomb || seg === color) {
            combo++;
            let pts = (160 + combo * 35) * zone;
            if (ring.star) {
              pts += 120 * zone;
              ctx.fx.floatingText('★ +BONUS', W / 2, H - 150, GOLD);
            } // Feature: star bonus
            if (ring.bomb) ctx.hud.toast('FREE PASS!');
            score += pts;
            ctx.audio.sfx(ring.bomb ? 'powerup' : 'coin');
            if (combo >= 3) ctx.fx.floatingText(`CHAIN x${combo}`, W / 2, H - 122, colors[color]!);
            burst(sparks, ctx.rng, W / 2, H - 86, ring.bomb ? WHITE : colors[color]!, 15, 120);
            // Feature: zone multiplier rises with score
            const nz = 1 + Math.floor(score / 5000);
            if (nz > zone) {
              zone = nz;
              ctx.hud.toast(`ZONE ${zone} · x${zone}`);
            }
          } else {
            combo = 0;
            lives--;
            ctx.hud.setLives(lives);
            ctx.fx.screenShake(7, 0.15);
            if (lives <= 0) {
              ctx.gameOver(score, { zone });
              return;
            }
          }
        }
      }
      if (rings[rings.length - 1]!.y > 250) {
        rings.push({
          y: -30,
          rot: ctx.rng.next() * Math.PI * 2,
          speed: ctx.rng.pick([-1.4, -1, 1, 1.4]),
          passed: false,
          star: ctx.rng.next() < 0.3,
          bomb: ctx.rng.next() < 0.1,
        });
      }
      while (rings[0] && rings[0].y > H + 90) rings.shift();
      ctx.hud.setScore(score);
      ctx.hud.setLabel(combo >= 3 ? `CHAIN x${combo} · Z${zone}` : `A NEXT / B BACK · Z${zone}`);
      draw();
    },
    destroy() {
      offDown();
      offTap();
      layer.destroy({ children: true });
    },
  };
}
