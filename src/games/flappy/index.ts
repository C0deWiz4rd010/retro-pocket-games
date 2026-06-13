import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const groundH = 60;
  const layer = new Container();
  ctx.stage.addChild(layer);

  const bgG = new Graphics();
  bgG.rect(0, 0, W, H).fill({ color: 0x0d1b2a });
  bgG.rect(0, H - groundH, W, groundH).fill({ color: 0x2a3d2a });
  layer.addChild(bgG);

  const g = new Graphics();
  layer.addChild(g);

  const GRAV = 1500;
  const FLAP = -430;
  const PIPE_W = 56;

  const bird = { x: W * 0.28, y: H / 2, vy: 0, r: 13 };
  let pipes: { x: number; gapY: number; scored: boolean }[] = [];
  let spawnT = 0;
  let score = 0;
  let speed = 150;
  let gap = 165;
  let started = false;
  let over = false;

  const flap = (): void => {
    if (over) return;
    started = true;
    bird.vy = FLAP;
    ctx.audio.sfx('jump');
  };
  const offTap = ctx.input.on('tap', flap);
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a' || a === 'up') flap();
  });

  ctx.hud.setScore(0);
  ctx.hud.setLabel('TAP TO FLY');

  const addPipe = (): void => {
    const margin = 60;
    const gapY = margin + ctx.rng.next() * (H - groundH - gap - margin * 2);
    pipes.push({ x: W + PIPE_W, gapY, scored: false });
  };

  const draw = (): void => {
    g.clear();
    pipes.forEach((p) => {
      g.rect(p.x, 0, PIPE_W, p.gapY).fill({ color: 0x3ddc84 });
      g.rect(p.x, p.gapY + gap, PIPE_W, H - groundH - (p.gapY + gap)).fill({ color: 0x3ddc84 });
      g.rect(p.x - 3, p.gapY - 16, PIPE_W + 6, 16).fill({ color: 0x2bb86c });
      g.rect(p.x - 3, p.gapY + gap, PIPE_W + 6, 16).fill({ color: 0x2bb86c });
    });
    g.circle(bird.x, bird.y, bird.r).fill({ color: 0xffd200 });
    g.circle(bird.x + 4, bird.y - 4, 3).fill({ color: 0x101018 });
    g.moveTo(bird.x + bird.r, bird.y).lineTo(bird.x + bird.r + 8, bird.y - 3).lineTo(bird.x + bird.r + 8, bird.y + 3).fill({ color: 0xff7b00 });
  };

  const die = (): void => {
    over = true;
    ctx.audio.sfx('hit');
    ctx.gameOver(score);
  };

  draw();

  return {
    update(dt) {
      if (over) return;
      if (!started) {
        bird.y = H / 2 + Math.sin(performance.now() / 300) * 8;
        draw();
        return;
      }
      bird.vy += GRAV * dt;
      bird.y += bird.vy * dt;

      spawnT += dt;
      if (spawnT > 1.45) {
        spawnT = 0;
        addPipe();
      }
      pipes.forEach((p) => (p.x -= speed * dt));
      pipes = pipes.filter((p) => p.x > -PIPE_W);

      for (const p of pipes) {
        if (!p.scored && p.x + PIPE_W < bird.x) {
          p.scored = true;
          score++;
          ctx.hud.setScore(score);
          ctx.audio.sfx('coin');
          // speed up every 10 pipes; gap shrinks slightly until min 110
          if (score % 10 === 0) {
            speed += 18;
            gap = Math.max(110, gap - 8);
            ctx.hud.toast(`SPEED UP! Lv ${score / 10 + 1}`);
          } else if (score === 10) ctx.hud.toast('🥉 BRONZE');
          else if (score === 25) ctx.hud.toast('🥈 SILVER');
          else if (score === 50) ctx.hud.toast('🥇 GOLD');
        }
        const inX = bird.x + bird.r > p.x && bird.x - bird.r < p.x + PIPE_W;
        const hitY = bird.y - bird.r < p.gapY || bird.y + bird.r > p.gapY + gap;
        if (inX && hitY) return die();
      }

      if (bird.y + bird.r > H - groundH) {
        bird.y = H - groundH - bird.r;
        return die();
      }
      if (bird.y < 0) bird.y = 0;
      draw();
    },
    destroy() {
      offTap();
      offDown();
      layer.destroy({ children: true });
    },
  };
}
