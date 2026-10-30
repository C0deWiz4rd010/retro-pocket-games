import type { Game, GameContext } from '@core/types';
import { burst, drawSparks, updateSparks } from '@kits/arcade/juice';
import { CYAN, PINK, GOLD, GREEN, VIOLET, makeLayer, backdrop } from '@kits/arcade/concept';
import { cutTail, hungerDrain } from './core';

/**
 * Tailspin — a wrap-around snake that you *want* to bite. Running into your own body cuts the tail
 * off at that point: the cut segments turn into shards worth points, and eating shards grows you
 * back. The catch is hunger: go too long without eating and the tail withers away.
 */
export default function createGame(ctx: GameContext): Game {
  const { layer, g, sparks } = makeLayer(ctx);
  const W = ctx.width;
  const H = ctx.height;
  const cols = 18;
  const rows = 26;
  const cell = Math.floor(Math.min(W / cols, (H - 20) / rows));
  const ox = (W - cols * cell) / 2;
  const oy = (H - rows * cell) / 2;
  const MIN_LEN = 3;
  const HUNGER_MAX = 7;
  const snake = [
    { x: 8, y: 13 },
    { x: 7, y: 13 },
    { x: 6, y: 13 },
    { x: 5, y: 13 },
  ];
  let dir = { x: 1, y: 0 };
  let next = dir;
  let food = { x: 13, y: 13 };
  let bonusFood: { x: number; y: number; t: number } | null = null;
  const shards: { x: number; y: number; t: number }[] = [];
  let eaten = 0;
  let score = 0;
  let tick = 0;
  let over = false;
  let wrapPulse = 0;
  let t = 0;
  let hunger = HUNGER_MAX;
  let cuts = 0;
  let portals: { ax: number; ay: number; bx: number; by: number } | null = null;
  let combo = 0;
  let comboTimer = 0;

  const occupied = (x: number, y: number): boolean =>
    snake.some((s) => s.x === x && s.y === y) ||
    (food.x === x && food.y === y) ||
    shards.some((s) => s.x === x && s.y === y);
  const freeCell = (): { x: number; y: number } => {
    let c: { x: number; y: number };
    do {
      c = { x: ctx.rng.int(0, cols - 1), y: ctx.rng.int(0, rows - 1) };
    } while (occupied(c.x, c.y));
    return c;
  };
  const placePortals = (): void => {
    const a = freeCell();
    let b = freeCell();
    while (b.x === a.x && b.y === a.y) b = freeCell();
    portals = { ax: a.x, ay: a.y, bx: b.x, by: b.y };
  };
  ctx.hud.setScore(0);
  ctx.hud.setLabel('BITE YOUR TAIL');
  const placeFood = (): void => {
    food = freeCell();
  };
  const placeBonus = (): void => {
    bonusFood = { ...freeCell(), t: 6 };
    ctx.hud.toast('BONUS FRUIT');
  };
  const turn = (d: string): void => {
    if (d === 'left' && dir.x !== 1) next = { x: -1, y: 0 };
    if (d === 'right' && dir.x !== -1) next = { x: 1, y: 0 };
    if (d === 'up' && dir.y !== 1) next = { x: 0, y: -1 };
    if (d === 'down' && dir.y !== -1) next = { x: 0, y: 1 };
  };
  const offDown = ctx.input.on('down', turn);
  const offSwipe = ctx.input.on('swipe', turn);
  const px = (x: number): number => ox + x * cell + cell / 2;
  const py = (y: number): number => oy + y * cell + cell / 2;

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
    g.circle(px(food.x), py(food.y), cell * 0.38).fill({ color: PINK });
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
        g.circle(px(cx), py(cy), r).stroke({ width: 3, color: VIOLET, alpha: 0.85 });
      }
    }
    // shards: cut-off tail pieces, blinking when they are about to vanish
    for (const s of shards) {
      if (s.t < 2 && Math.floor(s.t * 8) % 2 === 0) continue;
      const r = cell * 0.3;
      g.moveTo(px(s.x), py(s.y) - r)
        .lineTo(px(s.x) + r, py(s.y))
        .lineTo(px(s.x), py(s.y) + r)
        .lineTo(px(s.x) - r, py(s.y))
        .closePath()
        .fill({ color: GOLD, alpha: 0.9 });
    }
    // body fades toward the tail; a starving snake flashes red
    const starving = hunger < 2.5 && Math.floor(t * 6) % 2 === 0;
    snake.forEach((s, i) => {
      const head = i === 0;
      const fade = 1 - (i / Math.max(1, snake.length)) * 0.45;
      g.roundRect(ox + s.x * cell + 1, oy + s.y * cell + 1, cell - 2, cell - 2, 4).fill({
        color: head ? GOLD : starving ? PINK : GREEN,
        alpha: 0.92 * fade,
      });
    });
    // hunger ring around the head
    const hp = Math.max(0, hunger / HUNGER_MAX);
    const hx = px(snake[0]!.x);
    const hy = py(snake[0]!.y);
    g.arc(hx, hy, cell * 0.8, -Math.PI / 2, -Math.PI / 2 + hp * Math.PI * 2).stroke({
      width: 2,
      color: hp < 0.35 ? PINK : CYAN,
      alpha: 0.7,
    });
    drawSparks(g, sparks);
  }

  const feed = (): void => {
    hunger = HUNGER_MAX;
  };

  return {
    update(dt) {
      if (over) return;
      t += dt;
      updateSparks(sparks, dt);
      wrapPulse = Math.max(0, wrapPulse - dt);
      if (comboTimer > 0) comboTimer -= dt;
      else combo = 0;
      if (bonusFood) {
        bonusFood.t -= dt;
        if (bonusFood.t <= 0) bonusFood = null;
      }
      for (let i = shards.length - 1; i >= 0; i--) {
        shards[i]!.t -= dt;
        if (shards[i]!.t <= 0) shards.splice(i, 1);
      }
      // hunger: the tail withers when you don't eat
      hunger -= dt;
      if (hunger <= 0) {
        const d = hungerDrain(snake.length, MIN_LEN);
        hunger = 4;
        if (d.dead) {
          over = true;
          ctx.audio.sfx('hit');
          ctx.gameOver(score, { length: snake.length, cuts });
          return;
        }
        const lost = snake.pop()!;
        burst(sparks, ctx.rng, px(lost.x), py(lost.y), PINK, 8, 70);
        ctx.audio.sfx('hit');
        ctx.hud.toast('STARVING!');
      }
      tick += dt;
      if (tick >= Math.max(0.075, 0.15 - snake.length * 0.0018)) {
        tick = 0;
        dir = next;
        const raw = { x: snake[0]!.x + dir.x, y: snake[0]!.y + dir.y };
        const head = { x: (raw.x + cols) % cols, y: (raw.y + rows) % rows };
        if (raw.x !== head.x || raw.y !== head.y) {
          wrapPulse = 0.4;
          score += 12;
          ctx.fx.floatingText('WRAP', px(head.x), oy + head.y * cell, CYAN);
        }
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
        // biting your own body cuts the tail off from that segment on
        const hitIdx = snake.findIndex((s, i) => i > 0 && s.x === head.x && s.y === head.y);
        if (hitIdx > 0) {
          const cut = cutTail(snake.length, hitIdx, MIN_LEN);
          if (cut.dead) {
            over = true;
            ctx.fx.screenShake(8, 0.2);
            ctx.audio.sfx('explosion');
            ctx.gameOver(score, { length: snake.length, cuts });
            return;
          }
          const lost = snake.splice(hitIdx);
          for (const s of lost) shards.push({ x: s.x, y: s.y, t: 9 });
          cuts++;
          const pts = lost.length * 40 * (1 + Math.floor(cuts / 3));
          score += pts;
          ctx.fx.floatingText(`CUT +${pts}`, px(head.x), oy + head.y * cell, GOLD);
          ctx.fx.screenShake(4, 0.1);
          ctx.audio.sfx('powerup');
          burst(sparks, ctx.rng, px(head.x), py(head.y), GOLD, 16, 120);
        }
        snake.unshift(head);
        const shardIdx = shards.findIndex((s) => s.x === head.x && s.y === head.y);
        const ateBonus = bonusFood && head.x === bonusFood.x && head.y === bonusFood.y;
        let grew = false;
        if (shardIdx >= 0) {
          // shards regrow the tail
          shards.splice(shardIdx, 1);
          score += 60;
          feed();
          grew = true;
          ctx.audio.sfx('coin');
          burst(sparks, ctx.rng, px(head.x), py(head.y), GOLD, 6, 80);
        }
        if (head.x === food.x && head.y === food.y) {
          eaten++;
          feed();
          combo = comboTimer > 0 ? combo + 1 : 1;
          comboTimer = 3;
          const mult = 1 + Math.floor(combo / 3);
          score += (100 + snake.length * 2) * mult;
          if (combo >= 3 && combo % 3 === 0)
            ctx.fx.floatingText(`COMBO x${mult}`, px(head.x), oy + head.y * cell, GOLD);
          ctx.audio.sfx('coin');
          burst(sparks, ctx.rng, px(food.x), py(food.y), PINK, 12, 90);
          placeFood();
          if (eaten % 4 === 0) placeBonus();
          if (eaten % 5 === 0) placePortals();
          grew = true;
        } else if (ateBonus) {
          score += 450;
          feed();
          bonusFood = null;
          ctx.audio.sfx('powerup');
          ctx.fx.floatingText('+450', px(head.x), oy + head.y * cell, GOLD);
          grew = true;
        }
        if (!grew) snake.pop();
        ctx.hud.setScore(score);
        ctx.hud.setLabel(
          hunger < 3
            ? `HUNGRY ${Math.ceil(hunger)}`
            : combo >= 3
              ? `COMBO x${1 + Math.floor(combo / 3)}`
              : bonusFood
                ? `BONUS ${Math.ceil(bonusFood.t)}`
                : `LEN ${snake.length} · CUTS ${cuts}`,
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
