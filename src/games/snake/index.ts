import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action, Dir } from '@core/InputManager';
import { createSnake, setDir, step, type SnakeState } from './core';

const DIRS: Record<string, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export default function createGame(ctx: GameContext): Game {
  const cols = 18;
  const cell = Math.floor(ctx.width / cols);
  const rows = Math.floor(ctx.height / cell);
  const ox = (ctx.width - cols * cell) / 2;
  const oy = (ctx.height - rows * cell) / 2;

  const layer = new Container();
  layer.position.set(ox, oy);
  ctx.stage.addChild(layer);

  // checkerboard background
  const bg = new Graphics();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if ((x + y) % 2 === 0) bg.rect(x * cell, y * cell, cell, cell).fill({ color: 0xffffff, alpha: 0.03 });
    }
  }
  layer.addChild(bg);

  const food = new Graphics();
  const bonusG = new Graphics();
  const snakeG = new Graphics();
  const particleG = new Graphics();
  layer.addChild(food, bonusG, snakeG, particleG);

  interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: number }
  const particles: Particle[] = [];

  const state: SnakeState = createSnake(cols, rows, ctx.rng);
  ctx.hud.setScore(0);

  const turn = (a: Action): void => {
    const d = DIRS[a];
    if (d) setDir(state, d);
  };
  const offDown = ctx.input.on('down', turn);
  const offSwipe = ctx.input.on('swipe', (d: Dir) => turn(d));

  let acc = 0;
  let dead = false;
  let eaten = 0;
  let combo = 0;
  let comboTimer = 0;
  let pulse = 0;
  // Timed golden bonus fruit: appears periodically, worth more, ticking down.
  let bonus: { x: number; y: number; ttl: number } | null = null;

  const interval = (): number => Math.max(0.06, 0.16 - state.score * 0.0006);

  const spawnParticles = (gx: number, gy: number, color: number): void => {
    const cx = gx * cell + cell / 2;
    const cy = gy * cell + cell / 2;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const speed = 40 + Math.random() * 60;
      particles.push({ x: cx, y: cy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color });
    }
  };

  const drawParticles = (): void => {
    particleG.clear();
    for (const p of particles) {
      particleG.circle(p.x, p.y, cell * 0.18 * p.life).fill({ color: p.color, alpha: p.life });
    }
  };

  const updateParticles = (dt: number): void => {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]!;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * 2.5;
      if (p.life <= 0) particles.splice(i, 1);
    }
  };

  const spawnBonus = (): void => {
    const free: { x: number; y: number }[] = [];
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++)
        if (
          !state.body.some((b) => b.x === x && b.y === y) &&
          !(state.food.x === x && state.food.y === y)
        )
          free.push({ x, y });
    if (free.length) bonus = { ...ctx.rng.pick(free), ttl: 6 };
  };

  const draw = (): void => {
    food.clear();
    food
      .circle(state.food.x * cell + cell / 2, state.food.y * cell + cell / 2, cell * 0.34)
      .fill({ color: 0xff2e97 });

    bonusG.clear();
    if (bonus) {
      const cxp = bonus.x * cell + cell / 2;
      const cyp = bonus.y * cell + cell / 2;
      const r = cell * (0.3 + 0.08 * Math.sin(pulse * 8));
      bonusG.circle(cxp, cyp, r).fill({ color: 0xffd200 });
      bonusG.circle(cxp, cyp, r * 0.5).fill({ color: 0xfff6b0 });
    }

    snakeG.clear();
    state.body.forEach((seg, i) => {
      const head = i === 0;
      snakeG
        .roundRect(seg.x * cell + 1, seg.y * cell + 1, cell - 2, cell - 2, 4)
        .fill({ color: head ? 0x9bffce : 0x3ddc84, alpha: head ? 1 : 0.9 });
    });
  };
  draw();

  return {
    update(dt) {
      if (dead) return;
      pulse += dt;
      updateParticles(dt);
      if (comboTimer > 0) comboTimer -= dt;
      else combo = 0;
      if (bonus) {
        bonus.ttl -= dt;
        if (bonus.ttl <= 0) bonus = null;
      }

      acc += dt;
      if (acc < interval()) {
        drawParticles();
        draw();
        return;
      }
      acc = 0;
      const r = step(state, ctx.rng);

      const head = state.body[0]!;
      if (bonus && head.x === bonus.x && head.y === bonus.y) {
        const pts = 30 + Math.ceil(bonus.ttl) * 5;
        state.score += pts;
        spawnParticles(bonus.x, bonus.y, 0xffd200);
        bonus = null;
        combo++;
        comboTimer = 3;
        state.grow += 1;
        ctx.audio.sfx('coin');
        ctx.hud.toast(`BONUS +${pts}`);
        ctx.hud.setScore(state.score);
      }

      if (r === 'eat') {
        eaten++;
        combo++;
        comboTimer = 3;
        if (combo >= 3) {
          state.score += combo;
          ctx.hud.toast(`COMBO x${combo}`);
        }
        spawnParticles(state.food.x, state.food.y, 0xff2e97);
        ctx.audio.sfx('eat');
        ctx.hud.setScore(state.score);
        if (eaten % 5 === 0 && !bonus) spawnBonus();
      }
      if (r === 'dead') {
        dead = true;
        ctx.gameOver(state.score, { length: state.body.length });
        return;
      }
      drawParticles();
      draw();
    },
    destroy() {
      offDown();
      offSwipe();
      layer.destroy({ children: true });
    },
  };
}
