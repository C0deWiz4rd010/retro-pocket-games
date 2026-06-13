import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

type Rock = { a: number; r: number; speed: number; size: number };

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  const g = new Graphics();
  layer.addChild(g);
  ctx.stage.addChild(layer);

  const cx = W / 2;
  const cy = H / 2;
  const orbitR = Math.min(W, H) * 0.28;
  let angle = -Math.PI / 2;
  let score = 0;
  let lives = 3;
  let spawn = 0.8;
  let invuln = 0;
  const rocks: Rock[] = [];

  ctx.hud.setScore(score);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('ORBIT');

  function addRock(): void {
    rocks.push({
      a: ctx.rng.next() * Math.PI * 2,
      r: Math.max(W, H) * 0.58,
      speed: 55 + score * 0.018 + ctx.rng.next() * 45,
      size: 7 + ctx.rng.next() * 8,
    });
  }

  return {
    update(dt) {
      const axis = ctx.input.axis();
      if (ctx.input.isDown('a')) angle -= 3.4 * dt;
      if (ctx.input.isDown('b')) angle += 3.4 * dt;
      angle += axis.x * 3.4 * dt;
      spawn -= dt;
      invuln = Math.max(0, invuln - dt);
      if (spawn <= 0) {
        spawn = Math.max(0.22, 0.82 - score / 12000);
        addRock();
      }
      const px = cx + Math.cos(angle) * orbitR;
      const py = cy + Math.sin(angle) * orbitR;
      for (let i = rocks.length - 1; i >= 0; i--) {
        const rock = rocks[i]!;
        rock.r -= rock.speed * dt;
        if (rock.r < 12) {
          rocks.splice(i, 1);
          score += 25;
          ctx.hud.setScore(score);
          continue;
        }
        const rx = cx + Math.cos(rock.a) * rock.r;
        const ry = cy + Math.sin(rock.a) * rock.r;
        if (invuln <= 0 && Math.hypot(px - rx, py - ry) < rock.size + 9) {
          rocks.splice(i, 1);
          lives--;
          invuln = 1.1;
          ctx.audio.sfx('hit');
          ctx.fx.screenShake(6, 0.15);
          ctx.hud.setLives(lives);
          if (lives <= 0) ctx.gameOver(score);
        }
      }
      score += Math.floor(dt * 18);
      ctx.hud.setScore(score);
      g.clear();
      g.circle(cx, cy, 12).fill({ color: 0xfacc15 });
      g.circle(cx, cy, orbitR).stroke({ width: 2, color: 0x334155, alpha: 0.9 });
      g.circle(px, py, invuln > 0 ? 12 : 9).fill({ color: invuln > 0 ? 0x93c5fd : 0x22d3ee });
      for (const rock of rocks) {
        const rx = cx + Math.cos(rock.a) * rock.r;
        const ry = cy + Math.sin(rock.a) * rock.r;
        g.circle(rx, ry, rock.size).fill({ color: 0xfb7185 });
      }
    },
    destroy() {
      layer.destroy({ children: true });
    },
  };
}
