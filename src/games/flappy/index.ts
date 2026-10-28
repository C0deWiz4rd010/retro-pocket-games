import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import { Particles } from '@kits/arcade/particles';
import { glowCircle } from '@kits/arcade/glow';

interface Pipe {
  x: number;
  gapY: number;
  scored: boolean;
  phase: number;
  amp: number;
  coin: boolean;
  coinTaken: boolean;
}
interface Cloud {
  x: number;
  y: number;
  s: number;
  speed: number;
}

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const groundH = 60;
  const layer = new Container();
  ctx.stage.addChild(layer);

  const bgG = new Graphics();
  const g = new Graphics();
  layer.addChild(bgG, g);

  const GRAV = 1500;
  const FLAP = -430;
  const PIPE_W = 56;

  const bird = { x: W * 0.28, y: H / 2, vy: 0, r: 13 };
  let pipes: Pipe[] = [];
  const clouds: Cloud[] = [];
  const particles = new Particles({ gravity: 200, decay: 2, fade: 1 });
  let spawnT = 0;
  let score = 0;
  let speed = 150;
  let gap = 165;
  let started = false;
  let over = false;
  let shield = false; // Feature: absorbs one crash
  let invuln = 0;
  let groundScroll = 0;
  let dayT = 0; // 0 = day, 1 = night

  for (let i = 0; i < 5; i++) {
    clouds.push({
      x: ctx.rng.next() * W,
      y: 40 + ctx.rng.next() * (H * 0.5),
      s: 0.6 + ctx.rng.next() * 0.8,
      speed: 14 + ctx.rng.next() * 18,
    });
  }

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
    const moving = score >= 15 && ctx.rng.next() < 0.45; // Feature: moving pipes
    pipes.push({
      x: W + PIPE_W,
      gapY,
      scored: false,
      phase: ctx.rng.next() * Math.PI * 2,
      amp: moving ? 22 + ctx.rng.next() * 26 : 0,
      coin: ctx.rng.next() < 0.5, // Feature: collectible coins
      coinTaken: false,
    });
  };

  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
  const mix = (c1: number, c2: number, t: number): number => {
    const r = lerp((c1 >> 16) & 255, (c2 >> 16) & 255, t);
    const gg = lerp((c1 >> 8) & 255, (c2 >> 8) & 255, t);
    const b = lerp(c1 & 255, c2 & 255, t);
    return (r << 16) | (gg << 8) | b;
  };

  let clock = 0; // game time, so moving pipes and the idle bob pause with the game
  const gapYNow = (p: Pipe): number => p.gapY + Math.sin(clock * 1.67 + p.phase) * p.amp;

  // cosmetic only: fx RNG keeps pipe layout identical for a given daily seed
  const burst = (x: number, y: number, color: number, n = 8): void =>
    particles.burst(x, y, color, n, 120, 1);

  const draw = (): void => {
    // sky gradient (day -> night)
    bgG.clear();
    const skyTop = mix(0x4aa3df, 0x0a1030, dayT);
    const skyBot = mix(0x9fd8f0, 0x1a1c4a, dayT);
    bgG.rect(0, 0, W, H * 0.6).fill({ color: skyTop });
    bgG.rect(0, H * 0.4, W, H).fill({ color: skyBot, alpha: 0.6 });
    // sun / moon
    bgG
      .circle(W * 0.78, lerp(80, 120, dayT), 26)
      .fill({ color: mix(0xffe98a, 0xeef0ff, dayT), alpha: 0.9 });
    // clouds
    for (const c of clouds) {
      const a = 0.5 - dayT * 0.3;
      bgG.ellipse(c.x, c.y, 26 * c.s, 12 * c.s).fill({ color: 0xffffff, alpha: a });
      bgG
        .ellipse(c.x + 18 * c.s, c.y + 4 * c.s, 18 * c.s, 9 * c.s)
        .fill({ color: 0xffffff, alpha: a });
    }
    // ground
    bgG.rect(0, H - groundH, W, groundH).fill({ color: mix(0x2a3d2a, 0x16201a, dayT) });
    for (let x = -((groundScroll | 0) % 24); x < W; x += 24) {
      bgG.rect(x, H - groundH, 12, 6).fill({ color: mix(0x3a5236, 0x223021, dayT) });
    }

    g.clear();
    pipes.forEach((p) => {
      const gy = gapYNow(p);
      g.rect(p.x, 0, PIPE_W, gy).fill({ color: 0x3ddc84 });
      g.rect(p.x, gy + gap, PIPE_W, H - groundH - (gy + gap)).fill({ color: 0x3ddc84 });
      // light strip on the left, shade on the right (cylindrical look)
      g.rect(p.x + 6, 0, 6, gy).fill({ color: 0xffffff, alpha: 0.2 });
      g.rect(p.x + PIPE_W - 10, 0, 10, gy).fill({ color: 0x000000, alpha: 0.18 });
      g.rect(p.x + 6, gy + gap, 6, H - groundH - (gy + gap)).fill({ color: 0xffffff, alpha: 0.2 });
      g.rect(p.x + PIPE_W - 10, gy + gap, 10, H - groundH - (gy + gap)).fill({
        color: 0x000000,
        alpha: 0.18,
      });
      g.rect(p.x - 3, gy - 16, PIPE_W + 6, 16).fill({ color: 0x2bb86c });
      g.rect(p.x - 3, gy + gap, PIPE_W + 6, 16).fill({ color: 0x2bb86c });
      if (p.coin && !p.coinTaken) {
        const cx = p.x + PIPE_W / 2;
        const cy = gy + gap / 2;
        const spin = Math.abs(Math.cos(clock * 4 + p.phase));
        glowCircle(g, cx, cy, 8, 0xffd200, 0.18);
        g.ellipse(cx, cy, 9 * (0.35 + 0.65 * spin), 9).fill({ color: 0xffd200 });
        g.ellipse(cx, cy, 5 * (0.35 + 0.65 * spin), 5).fill({ color: 0xfff0a0 });
      }
    });
    // particles
    particles.draw(g);
    // bird (rotates with velocity)
    const rot = Math.max(-0.5, Math.min(1.1, bird.vy / 600));
    const bx = bird.x,
      by = bird.y;
    const cos = Math.cos(rot),
      sin = Math.sin(rot);
    const rp = (dx: number, dy: number): { x: number; y: number } => ({
      x: bx + dx * cos - dy * sin,
      y: by + dx * sin + dy * cos,
    });
    if (shield || invuln > 0)
      g.circle(bx, by, bird.r + 6).stroke({ width: 2.5, color: 0x00f7ff, alpha: 0.7 });
    g.circle(bx, by, bird.r).fill({ color: 0xffd200 });
    // belly + flapping wing
    const belly = rp(-2, 5);
    g.ellipse(belly.x, belly.y, 8, 5).fill({ color: 0xfff0a0, alpha: 0.8 });
    const flapY = Math.sin(clock * 22) * 4 * (started ? 1 : 0.4);
    const wing = rp(-5, 1 + flapY);
    g.ellipse(wing.x, wing.y, 7, 4).fill({ color: 0xe0a800 });
    const eye = rp(5, -5);
    g.circle(eye.x, eye.y, 4).fill({ color: 0xffffff });
    g.circle(eye.x + 1, eye.y, 2).fill({ color: 0x101018 });
    const b0 = rp(bird.r, 0),
      b1 = rp(bird.r + 8, -3),
      b2 = rp(bird.r + 8, 3);
    g.moveTo(b0.x, b0.y).lineTo(b1.x, b1.y).lineTo(b2.x, b2.y).fill({ color: 0xff7b00 });
  };

  const die = (): void => {
    if (shield || invuln > 0) return;
    over = true;
    burst(bird.x, bird.y, 0xffd200, 14);
    ctx.audio.sfx('hit');
    let medal = 0;
    if (score >= 50) medal = 3;
    else if (score >= 25) medal = 2;
    else if (score >= 10) medal = 1;
    ctx.gameOver(score, { medal });
  };

  draw();

  return {
    update(dt) {
      clock += dt;
      // ambient motion always runs
      for (const c of clouds) {
        c.x -= c.speed * dt;
        if (c.x < -40) c.x = W + 40;
      }
      particles.update(dt);
      if (over) {
        draw();
        return;
      }
      if (invuln > 0) invuln -= dt;
      if (!started) {
        bird.y = H / 2 + Math.sin(clock * 3.3) * 8;
        draw();
        return;
      }
      bird.vy += GRAV * dt;
      bird.y += bird.vy * dt;
      groundScroll += speed * dt;
      dayT = Math.min(1, score / 40); // night falls as you progress

      spawnT += dt;
      if (spawnT > 1.45) {
        spawnT = 0;
        addPipe();
      }
      pipes.forEach((p) => (p.x -= speed * dt));
      pipes = pipes.filter((p) => p.x > -PIPE_W);

      for (const p of pipes) {
        const gy = gapYNow(p);
        // coin pickup
        if (p.coin && !p.coinTaken) {
          const cx = p.x + PIPE_W / 2;
          const cy = gy + gap / 2;
          if (Math.hypot(bird.x - cx, bird.y - cy) < bird.r + 10) {
            p.coinTaken = true;
            score += 2;
            ctx.hud.setScore(score);
            burst(cx, cy, 0xffd200, 8);
            ctx.audio.sfx('coin');
            // chance to grant a shield from a coin
            if (!shield && ctx.rng.next() < 0.18) {
              shield = true;
              ctx.hud.toast('🛡 SHIELD');
            }
          }
        }
        if (!p.scored && p.x + PIPE_W < bird.x) {
          p.scored = true;
          score++;
          ctx.hud.setScore(score);
          ctx.audio.sfx('coin');
          if (score % 10 === 0) {
            speed = Math.min(270, speed + 16);
            gap = Math.max(110, gap - 8);
            ctx.hud.toast(`SPEED UP! Lv ${score / 10 + 1}`);
          } else if (score === 10) ctx.hud.toast('🥉 BRONZE');
          else if (score === 25) ctx.hud.toast('🥈 SILVER');
          else if (score === 50) ctx.hud.toast('🥇 GOLD');
        }
        const inX = bird.x + bird.r > p.x && bird.x - bird.r < p.x + PIPE_W;
        const hitY = bird.y - bird.r < gy || bird.y + bird.r > gy + gap;
        if (inX && hitY) {
          if (shield && invuln <= 0) {
            shield = false;
            invuln = 1.2;
            bird.vy = FLAP * 0.7;
            burst(bird.x, bird.y, 0x00f7ff, 12);
            ctx.audio.sfx('powerup');
            ctx.hud.toast('SHIELD BROKE');
          } else {
            return die();
          }
        }
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
