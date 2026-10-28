import type { Game, GameContext } from '@core/types';
import { burst, drawSparks, updateSparks } from '@kits/arcade/juice';
import { CYAN, PINK, GOLD, GREEN, VIOLET, makeLayer, backdrop } from '@kits/arcade/concept';

export default function createGame(ctx: GameContext): Game {
  const { layer, g, sparks } = makeLayer(ctx);
  const W = ctx.width;
  const H = ctx.height;
  const cols = 18;
  const rows = 26;
  const cell = Math.floor(Math.min(W / cols, (H - 20) / rows));
  const ox = (W - cols * cell) / 2;
  const oy = (H - rows * cell) / 2;
  const snake = [
    { x: 8, y: 13 },
    { x: 7, y: 13 },
    { x: 6, y: 13 },
  ];
  let dir = { x: 1, y: 0 };
  let next = dir;
  let food = { x: 13, y: 13 };
  let bonusFood: { x: number; y: number; t: number } | null = null;
  let eaten = 0;
  let score = 0;
  let tick = 0;
  let over = false;
  let wrapPulse = 0;
  let t = 0;
  // Feature: portal pair, shield orb, combo multiplier
  let portals: { ax: number; ay: number; bx: number; by: number } | null = null;
  let shieldOrb: { x: number; y: number; t: number } | null = null;
  let shield = 0;
  let combo = 0;
  let comboTimer = 0;
  const freeCell = (): { x: number; y: number } => {
    let c: { x: number; y: number };
    do {
      c = { x: ctx.rng.int(0, cols - 1), y: ctx.rng.int(0, rows - 1) };
    } while (snake.some((s) => s.x === c.x && s.y === c.y) || (food.x === c.x && food.y === c.y));
    return c;
  };
  const placePortals = (): void => {
    const a = freeCell();
    let b = freeCell();
    while (b.x === a.x && b.y === a.y) b = freeCell();
    portals = { ax: a.x, ay: a.y, bx: b.x, by: b.y };
  };
  ctx.hud.setScore(0);
  ctx.hud.setLabel('WRAP + BONUS');
  const placeFood = (): void => {
    do {
      food = { x: ctx.rng.int(0, cols - 1), y: ctx.rng.int(0, rows - 1) };
    } while (snake.some((s) => s.x === food.x && s.y === food.y));
  };
  const placeBonus = (): void => {
    do {
      bonusFood = { x: ctx.rng.int(0, cols - 1), y: ctx.rng.int(0, rows - 1), t: 6 };
    } while (
      snake.some((s) => s.x === bonusFood!.x && s.y === bonusFood!.y) ||
      (food.x === bonusFood!.x && food.y === bonusFood!.y)
    );
    ctx.hud.toast('BONUS FRUIT');
  };
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'left' && dir.x !== 1) next = { x: -1, y: 0 };
    if (a === 'right' && dir.x !== -1) next = { x: 1, y: 0 };
    if (a === 'up' && dir.y !== 1) next = { x: 0, y: -1 };
    if (a === 'down' && dir.y !== -1) next = { x: 0, y: 1 };
  });
  const offSwipe = ctx.input.on('swipe', (d) => {
    if (d === 'left' && dir.x !== 1) next = { x: -1, y: 0 };
    if (d === 'right' && dir.x !== -1) next = { x: 1, y: 0 };
    if (d === 'up' && dir.y !== 1) next = { x: 0, y: -1 };
    if (d === 'down' && dir.y !== -1) next = { x: 0, y: 1 };
  });
  function draw(): void {
    g.clear();
    backdrop(g, W, H, t, H * 0.76);
    g.roundRect(ox - 6, oy - 6, cols * cell + 12, rows * cell + 12, 10)
      .fill({ color: 0x07190f, alpha: 0.94 })
      .stroke({
        width: wrapPulse > 0 ? 4 : 2,
        color: wrapPulse > 0 ? CYAN : GREEN,
        alpha: wrapPulse > 0 ? 0.8 : 0.4,
      });
    for (let x = 0; x <= cols; x++)
      g.rect(ox + x * cell, oy, 1, rows * cell).fill({ color: GREEN, alpha: 0.07 });
    for (let y = 0; y <= rows; y++)
      g.rect(ox, oy + y * cell, cols * cell, 1).fill({ color: GREEN, alpha: 0.07 });
    g.circle(ox + food.x * cell + cell / 2, oy + food.y * cell + cell / 2, cell * 0.38).fill({
      color: PINK,
    });
    if (bonusFood) {
      const p = 0.75 + Math.sin(t * 10) * 0.12;
      g.roundRect(
        ox + bonusFood.x * cell + cell * (0.5 - p / 2),
        oy + bonusFood.y * cell + cell * (0.5 - p / 2),
        cell * p,
        cell * p,
        5,
      ).fill({ color: GOLD });
    }
    if (portals) {
      for (const [cx, cy] of [
        [portals.ax, portals.ay],
        [portals.bx, portals.by],
      ] as [number, number][]) {
        const r = cell * (0.36 + 0.08 * Math.sin(t * 6));
        g.circle(ox + cx * cell + cell / 2, oy + cy * cell + cell / 2, r).stroke({
          width: 3,
          color: VIOLET,
          alpha: 0.85,
        });
      }
    }
    if (shieldOrb) {
      g.circle(
        ox + shieldOrb.x * cell + cell / 2,
        oy + shieldOrb.y * cell + cell / 2,
        cell * 0.32,
      ).fill({ color: CYAN, alpha: 0.85 });
    }
    snake.forEach((s, i) => {
      const head = i === 0;
      g.roundRect(ox + s.x * cell + 1, oy + s.y * cell + 1, cell - 2, cell - 2, 4).fill({
        color: head ? (shield > 0 ? CYAN : GOLD) : shield > 0 ? 0x66d9ff : GREEN,
        alpha: 0.92,
      });
    });
    drawSparks(g, sparks);
  }
  return {
    update(dt) {
      if (over) return;
      t += dt;
      updateSparks(sparks, dt);
      wrapPulse = Math.max(0, wrapPulse - dt);
      shield = Math.max(0, shield - dt);
      if (comboTimer > 0) comboTimer -= dt;
      else combo = 0;
      if (bonusFood) {
        bonusFood.t -= dt;
        if (bonusFood.t <= 0) bonusFood = null;
      }
      if (shieldOrb) {
        shieldOrb.t -= dt;
        if (shieldOrb.t <= 0) shieldOrb = null;
      }
      tick += dt;
      if (tick >= Math.max(0.07, 0.15 - snake.length * 0.002)) {
        tick = 0;
        dir = next;
        const raw = { x: snake[0]!.x + dir.x, y: snake[0]!.y + dir.y };
        const head = { x: (raw.x + cols) % cols, y: (raw.y + rows) % rows };
        if (raw.x !== head.x || raw.y !== head.y) {
          wrapPulse = 0.4;
          score += 12;
          ctx.fx.floatingText('WRAP', ox + head.x * cell + cell / 2, oy + head.y * cell, CYAN);
        }
        // Feature: portal teleport
        if (portals) {
          if (head.x === portals.ax && head.y === portals.ay) {
            head.x = portals.bx;
            head.y = portals.by;
            ctx.audio.sfx('blip');
          } else if (head.x === portals.bx && head.y === portals.by) {
            head.x = portals.ax;
            head.y = portals.ay;
            ctx.audio.sfx('blip');
          }
        }
        // Feature: shield lets the head pass through the body
        if (shield <= 0 && snake.some((s) => s.x === head.x && s.y === head.y)) {
          over = true;
          ctx.gameOver(score, { length: snake.length });
          return;
        }
        snake.unshift(head);
        // Feature: shield orb pickup
        if (shieldOrb && head.x === shieldOrb.x && head.y === shieldOrb.y) {
          shield = 5;
          shieldOrb = null;
          ctx.audio.sfx('powerup');
          ctx.fx.floatingText('SHIELD', ox + head.x * cell + cell / 2, oy + head.y * cell, CYAN);
        }
        const ateBonus = bonusFood && head.x === bonusFood.x && head.y === bonusFood.y;
        if (head.x === food.x && head.y === food.y) {
          eaten++;
          combo = comboTimer > 0 ? combo + 1 : 1;
          comboTimer = 3;
          const mult = 1 + Math.floor(combo / 3);
          score += (100 + snake.length * 2) * mult;
          if (combo >= 3 && combo % 3 === 0)
            ctx.fx.floatingText(
              `COMBO x${mult}`,
              ox + head.x * cell + cell / 2,
              oy + head.y * cell,
              GOLD,
            );
          ctx.audio.sfx('coin');
          burst(
            sparks,
            ctx.rng,
            ox + food.x * cell + cell / 2,
            oy + food.y * cell + cell / 2,
            PINK,
            12,
            90,
          );
          placeFood();
          if (eaten % 4 === 0) placeBonus();
          if (eaten % 5 === 0) placePortals();
          if (eaten % 6 === 0 && shield <= 0) shieldOrb = { ...freeCell(), t: 7 };
        } else if (ateBonus) {
          score += 450;
          bonusFood = null;
          ctx.audio.sfx('powerup');
          ctx.fx.floatingText('+450', ox + head.x * cell + cell / 2, oy + head.y * cell, GOLD);
          snake.pop();
        } else snake.pop();
        ctx.hud.setScore(score);
        ctx.hud.setLabel(
          shield > 0
            ? `SHIELD ${Math.ceil(shield)}`
            : combo >= 3
              ? `COMBO x${1 + Math.floor(combo / 3)}`
              : bonusFood
                ? `BONUS ${Math.ceil(bonusFood.t)}`
                : 'WRAP + BONUS',
        );
        draw();
      }
    },
    destroy() {
      offDown();
      offSwipe();
      layer.destroy({ children: true });
    },
  };
}
