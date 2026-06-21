import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  const label = new Text({ text: '', style: { fontFamily: 'VT323, monospace', fontSize: 24, fill: 0x22d3ee } });
  label.anchor.set(0.5);
  label.position.set(W / 2, 52);
  layer.addChild(g, label);

  interface Mover { x: number; y: number; r: number; vx: number; vy: number; gold?: boolean }
  let target: Mover = { x: W / 2, y: H / 2, r: 28, vx: 80, vy: 60 };
  let bomb: Mover | null = null; // Feature: bomb target — don't tap it!
  let bombTimer = 4;
  let bombLife = 0;
  let score = 0;
  let combo = 0;
  let time = 30;
  let over = false;

  ctx.hud.setScore(0);
  ctx.hud.setLabel('30s');

  const spawn = (gold: boolean): Mover => ({
    x: 40 + ctx.rng.next() * (W - 80),
    y: 100 + ctx.rng.next() * (H - 210),
    r: Math.max(16, 30 - combo),
    vx: (ctx.rng.next() - 0.5) * 180,
    vy: (ctx.rng.next() - 0.5) * 180,
    gold,
  });
  const moveTarget = (): void => { target = spawn(ctx.rng.next() < 0.16); }; // Feature: golden target
  moveTarget();

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (over) return;
    if (bomb && Math.hypot(x - bomb.x, y - bomb.y) <= bomb.r) {
      // Feature: tapping a bomb hurts
      score = Math.max(0, score - 100);
      time = Math.max(0, time - 2);
      combo = 0;
      bomb = null;
      ctx.hud.setScore(score);
      ctx.fx.floatingText('-100 -2s', x, y, 0xff4d4d);
      ctx.audio.sfx('explosion');
      ctx.fx.screenShake(6, 0.14);
      return;
    }
    if (Math.hypot(x - target.x, y - target.y) <= target.r) {
      combo++;
      const mult = 1 + Math.floor(combo / 5); // Feature: combo multiplier
      const pts = (target.gold ? 150 : 50 + combo * 10) * mult;
      score += pts;
      time = Math.min(40, time + (target.gold ? 2 : 0.3)); // Feature: hit time bonus
      ctx.hud.setScore(score);
      ctx.fx.floatingText(target.gold ? `GOLD +${pts}` : `+${pts}`, target.x, target.y, target.gold ? 0xffd200 : 0x22d3ee);
      ctx.audio.sfx(target.gold ? 'powerup' : 'coin');
      moveTarget();
    } else {
      combo = 0;
      ctx.audio.sfx('hit');
      ctx.fx.screenShake(3, 0.08);
    }
  });

  function draw(): void {
    g.clear();
    label.text = combo >= 5 ? `COMBO ${combo} · x${1 + Math.floor(combo / 5)}` : `COMBO ${combo}`;
    if (bomb) {
      g.circle(bomb.x, bomb.y, bomb.r).fill({ color: 0xff4d4d });
      g.circle(bomb.x, bomb.y, bomb.r * 0.5).fill({ color: 0x2b0a0a });
      g.rect(bomb.x - 1, bomb.y - bomb.r - 3, 2, 5).fill({ color: 0xffd200 });
    }
    const col = target.gold ? 0xffd200 : 0x22d3ee;
    g.circle(target.x, target.y, target.r).fill({ color: col });
    g.circle(target.x, target.y, target.r * 0.62).fill({ color: 0x0f172a });
    g.circle(target.x, target.y, target.r * 0.28).fill({ color: 0xfffbeb });
  }

  const moveMover = (m: Mover, dt: number): void => {
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    if (m.x < m.r || m.x > W - m.r) m.vx *= -1;
    if (m.y < 90 + m.r || m.y > H - 90 - m.r) m.vy *= -1;
  };

  return {
    update(dt) {
      if (over) return;
      time -= dt;
      ctx.hud.setLabel(`${Math.ceil(time)}s`);
      moveMover(target, dt);
      // bomb spawn/lifecycle
      bombTimer -= dt;
      if (!bomb && bombTimer <= 0) { bomb = { ...spawn(false), r: 24 }; bombLife = 2.6; }
      if (bomb) {
        moveMover(bomb, dt);
        bombLife -= dt;
        if (bombLife <= 0) { bomb = null; bombTimer = 4 + ctx.rng.next() * 3; }
      }
      if (time <= 0) {
        over = true;
        ctx.gameOver(score, { combo });
      }
      draw();
    },
    destroy() {
      offTap();
      layer.destroy({ children: true });
    },
  };
}
