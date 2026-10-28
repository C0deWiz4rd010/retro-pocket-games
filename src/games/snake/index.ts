import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import { Particles } from '@kits/arcade/particles';
import { glowCircle } from '@kits/arcade/glow';
import type { Action, Dir } from '@core/InputManager';
import { createSnake, setDir, step, type SnakeState, type Vec } from './core';
import { DIRS } from '@kits/arcade/constants';

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
      if ((x + y) % 2 === 0)
        bg.rect(x * cell, y * cell, cell, cell).fill({ color: 0xffffff, alpha: 0.03 });
    }
  }
  layer.addChild(bg);

  const rockG = new Graphics();
  const food = new Graphics();
  const bonusG = new Graphics();
  const poisonG = new Graphics();
  const orbG = new Graphics();
  const snakeG = new Graphics();
  const particleG = new Graphics();
  const edge = new Graphics(); // shield / death edge glow
  layer.addChild(rockG, food, bonusG, poisonG, orbG, snakeG, particleG, edge);

  const particles = new Particles({ decay: 2.5, fade: 1, size: cell * 0.18 });

  const state: SnakeState = createSnake(cols, rows, ctx.rng);
  state.obstacles = [];
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
  let shield = 0; // seconds of invincibility remaining
  let deathFlash = 0;
  // Feature 1: timed golden bonus fruit (faster = more points).
  let bonus: { x: number; y: number; ttl: number } | null = null;
  // Feature 2: poison fruit — shrinks the snake and costs points. Avoid it.
  let poison: { x: number; y: number; ttl: number } | null = null;
  // Feature 3: shield orb — grab for temporary pass-through invincibility.
  let orb: { x: number; y: number; ttl: number } | null = null;

  const interval = (): number => Math.max(0.078, 0.16 - state.score * 0.0004);

  const occupied = (x: number, y: number): boolean =>
    state.body.some((b) => b.x === x && b.y === y) ||
    (state.food.x === x && state.food.y === y) ||
    (state.obstacles?.some((o) => o.x === x && o.y === y) ?? false) ||
    (bonus?.x === x && bonus?.y === y) ||
    (poison?.x === x && poison?.y === y) ||
    (orb?.x === x && orb?.y === y);

  const freeCell = (): Vec | null => {
    const free: Vec[] = [];
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) if (!occupied(x, y)) free.push({ x, y });
    return free.length ? ctx.rng.pick(free) : null;
  };

  const spawnParticles = (gx: number, gy: number, color: number, n = 8): void => {
    particles.burst(gx * cell + cell / 2, gy * cell + cell / 2, color, n, 70, 1);
  };

  const setLabel = (): void => {
    if (shield > 0) ctx.hud.setLabel(`🛡 SHIELD ${shield.toFixed(1)}s`);
    else ctx.hud.setLabel(combo >= 3 ? `COMBO x${combo}` : 'WRAP · GRAB · DODGE');
  };
  setLabel();

  const addRock = (): void => {
    const c = freeCell();
    if (c) {
      state.obstacles!.push(c);
      spawnParticles(c.x, c.y, 0x8899aa, 6);
    }
  };

  const draw = (): void => {
    // food
    food.clear();
    // apple: glow, body, leaf and shine (gently pulsing)
    const fcx = state.food.x * cell + cell / 2;
    const fcy = state.food.y * cell + cell / 2;
    glowCircle(food, fcx, fcy, cell * 0.34 * (1 + 0.05 * Math.sin(pulse * 5)), 0xff2e97, 0.3);
    food.circle(fcx, fcy, cell * 0.34).fill({ color: 0xff2e97 });
    food
      .ellipse(fcx + cell * 0.12, fcy - cell * 0.36, cell * 0.12, cell * 0.06)
      .fill({ color: 0x3ddc84 });
    food
      .circle(
        state.food.x * cell + cell / 2 - cell * 0.1,
        state.food.y * cell + cell / 2 - cell * 0.1,
        cell * 0.1,
      )
      .fill({ color: 0xffffff, alpha: 0.6 });

    // rocks
    rockG.clear();
    for (const o of state.obstacles!) {
      rockG
        .roundRect(o.x * cell + 1, o.y * cell + 1, cell - 2, cell - 2, 3)
        .fill({ color: 0x3a4256 });
      rockG
        .roundRect(o.x * cell + 3, o.y * cell + 3, cell - 8, cell - 8, 2)
        .fill({ color: 0x596279, alpha: 0.6 });
    }

    // bonus
    bonusG.clear();
    if (bonus) {
      const cxp = bonus.x * cell + cell / 2;
      const cyp = bonus.y * cell + cell / 2;
      const r = cell * (0.3 + 0.08 * Math.sin(pulse * 8));
      bonusG.circle(cxp, cyp, r).fill({ color: 0xffd200 });
      bonusG.circle(cxp, cyp, r * 0.5).fill({ color: 0xfff6b0 });
    }

    // poison
    poisonG.clear();
    if (poison) {
      const cxp = poison.x * cell + cell / 2;
      const cyp = poison.y * cell + cell / 2;
      poisonG.circle(cxp, cyp, cell * 0.34).fill({ color: 0x8b2fd6 });
      poisonG.circle(cxp - cell * 0.1, cyp - cell * 0.05, cell * 0.06).fill({ color: 0x14001f });
      poisonG.circle(cxp + cell * 0.1, cyp - cell * 0.05, cell * 0.06).fill({ color: 0x14001f });
    }

    // shield orb
    orbG.clear();
    if (orb) {
      const cxp = orb.x * cell + cell / 2;
      const cyp = orb.y * cell + cell / 2;
      const r = cell * (0.28 + 0.06 * Math.sin(pulse * 6));
      orbG.circle(cxp, cyp, r + 3).stroke({ width: 2, color: 0x00f7ff, alpha: 0.5 });
      orbG.circle(cxp, cyp, r).fill({ color: 0x00f7ff, alpha: 0.85 });
    }

    // snake
    snakeG.clear();
    const shielded = shield > 0;
    state.body.forEach((seg, i) => {
      const head = i === 0;
      const t = i / Math.max(1, state.body.length - 1);
      const base = shielded ? 0x00f7ff : 0x3ddc84;
      // tapered body: segments shrink slightly toward the tail, with a belly stripe
      const inset = 1 + (head ? 0 : t * cell * 0.12);
      const sz = cell - 2 * inset;
      snakeG.roundRect(seg.x * cell + inset, seg.y * cell + inset, sz, sz, head ? 6 : 4).fill({
        color: head ? (shielded ? 0xbdfaff : 0x9bffce) : base,
        alpha: head ? 1 : 0.95 - t * 0.3,
      });
      if (!head && i % 2 === 0)
        snakeG
          .roundRect(seg.x * cell + inset + 2, seg.y * cell + inset + 2, sz - 4, sz * 0.35, 3)
          .fill({ color: 0xffffff, alpha: 0.18 });
      if (head) {
        // eyes facing travel direction
        const ex = state.dir.x,
          ey = state.dir.y;
        const cxp = seg.x * cell + cell / 2;
        const cyp = seg.y * cell + cell / 2;
        const off = cell * 0.16;
        const px = -ey * off,
          py = ex * off; // perpendicular
        snakeG
          .circle(cxp + px + ex * off, cyp + py + ey * off, cell * 0.09)
          .fill({ color: 0x0a0a12 });
        snakeG
          .circle(cxp - px + ex * off, cyp - py + ey * off, cell * 0.09)
          .fill({ color: 0x0a0a12 });
      }
    });

    // particles
    particleG.clear();
    particles.draw(particleG);

    // edge glow (shield / death)
    edge.clear();
    const w = cols * cell,
      h = rows * cell;
    if (shield > 0) {
      const a = 0.25 + 0.15 * Math.sin(pulse * 6);
      edge.rect(0, 0, w, h).stroke({ width: 6, color: 0x00f7ff, alpha: a });
    }
    if (deathFlash > 0) {
      edge.rect(0, 0, w, h).fill({ color: 0xff2e97, alpha: deathFlash * 0.4 });
    }
  };
  draw();

  return {
    update(dt) {
      pulse += dt;
      particles.update(dt);
      if (deathFlash > 0) deathFlash = Math.max(0, deathFlash - dt * 2);
      if (dead) {
        draw();
        return;
      }
      if (shield > 0) {
        shield = Math.max(0, shield - dt);
        setLabel();
      }
      if (comboTimer > 0) comboTimer -= dt;
      else if (combo) {
        combo = 0;
        setLabel();
      }
      for (const e of [bonus, poison, orb]) if (e) e.ttl -= dt;
      if (bonus && bonus.ttl <= 0) bonus = null;
      if (poison && poison.ttl <= 0) poison = null;
      if (orb && orb.ttl <= 0) orb = null;

      acc += dt;
      if (acc < interval()) {
        draw();
        return;
      }
      acc = 0;
      const r = step(state, ctx.rng, { invincible: shield > 0 });
      const head = state.body[0]!;

      // shield orb pickup
      if (orb && head.x === orb.x && head.y === orb.y) {
        shield = 6;
        spawnParticles(orb.x, orb.y, 0x00f7ff, 12);
        orb = null;
        ctx.audio.sfx('powerup');
        ctx.hud.toast('SHIELD ON');
        setLabel();
      }

      // poison fruit eaten
      if (poison && head.x === poison.x && head.y === poison.y) {
        state.score = Math.max(0, state.score - 15);
        for (let k = 0; k < 2 && state.body.length > 3; k++) state.body.pop();
        spawnParticles(poison.x, poison.y, 0x8b2fd6, 10);
        poison = null;
        combo = 0;
        comboTimer = 0;
        ctx.audio.sfx('hit');
        ctx.hud.toast('POISON -15');
        ctx.hud.setScore(state.score);
        setLabel();
      }

      // golden bonus eaten
      if (bonus && head.x === bonus.x && head.y === bonus.y) {
        const pts = 30 + Math.ceil(bonus.ttl) * 5;
        state.score += pts;
        spawnParticles(bonus.x, bonus.y, 0xffd200, 12);
        bonus = null;
        combo++;
        comboTimer = 3;
        state.grow += 1;
        ctx.audio.sfx('coin');
        ctx.hud.toast(`BONUS +${pts}`);
        ctx.hud.setScore(state.score);
        setLabel();
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
        setLabel();
        // periodic spawns
        if (eaten % 4 === 0 && !bonus) {
          const c = freeCell();
          if (c) bonus = { ...c, ttl: 6 };
        }
        if (eaten % 5 === 0 && !poison) {
          const c = freeCell();
          if (c) poison = { ...c, ttl: 8 };
        }
        if (eaten % 7 === 0 && !orb && shield <= 0) {
          const c = freeCell();
          if (c) orb = { ...c, ttl: 7 };
        }
        // obstacles ramp up with score
        if (eaten % 6 === 0) addRock();
      }
      if (r === 'dead') {
        dead = true;
        deathFlash = 1;
        spawnParticles(head.x, head.y, 0xff2e97, 16);
        ctx.audio.sfx('hit');
        ctx.gameOver(state.score, { length: state.body.length });
        draw();
        return;
      }
      draw();
    },
    destroy() {
      offDown();
      offSwipe();
      layer.destroy({ children: true });
    },
  };
}
