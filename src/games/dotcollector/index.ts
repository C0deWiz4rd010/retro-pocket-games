import type { Game, GameContext } from '@core/types';
import { burst, drawSparks, updateSparks } from '@kits/arcade/juice';
import { CYAN, PINK, GOLD, GREEN, VIOLET, makeLayer, backdrop } from '@kits/arcade/concept';

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const { layer, g, sparks } = makeLayer(ctx);
  const cols = 15;
  const rows = 21;
  const cell = Math.floor(Math.min(W / cols, (H - 30) / rows));
  const ox = (W - cols * cell) / 2;
  const oy = (H - rows * cell) / 2;
  const walls = new Set<string>();
  const dots = new Set<string>();
  const powers = new Set<string>();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const wall =
        x === 0 ||
        y === 0 ||
        x === cols - 1 ||
        y === rows - 1 ||
        (x % 4 === 0 && y % 4 !== 2) ||
        (y % 5 === 0 && x % 5 !== 2);
      if (wall) walls.add(`${x},${y}`);
      else dots.add(`${x},${y}`);
    }
  }
  let player = { x: 1, y: 1 };
  const foes = [
    { x: cols - 2, y: rows - 2, phase: 0 },
    { x: cols - 2, y: 1, phase: 2.1 },
  ];
  dots.delete('1,1');
  for (const key of [`1,${rows - 2}`, `${cols - 2},1`, `${cols - 2},${rows - 2}`]) {
    powers.add(key);
    dots.delete(key);
  }
  let score = 0;
  let lives = 3;
  let power = 0;
  let tick = 0;
  let t = 0;
  let over = false;
  // Feature: bonus fruit, power-mode chain, speed pellet
  let fruit: { x: number; y: number; t: number } | null = null;
  let fruitTimer = 8;
  let chain = 0;
  let speedT = 0;
  let speedPellet: { x: number; y: number } | null = null;
  let speedTimer = 12;
  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('DOTS');
  const can = (x: number, y: number): boolean => !walls.has(`${x},${y}`);
  const freeFloor = (): { x: number; y: number } => {
    let c: { x: number; y: number };
    do {
      c = { x: ctx.rng.int(1, cols - 2), y: ctx.rng.int(1, rows - 2) };
    } while (walls.has(`${c.x},${c.y}`));
    return c;
  };
  function draw(): void {
    g.clear();
    backdrop(g, W, H, t, H * 0.78);
    g.roundRect(ox - 5, oy - 5, cols * cell + 10, rows * cell + 10, 9)
      .fill({ color: 0x05070f, alpha: 0.94 })
      .stroke({ width: 2, color: CYAN, alpha: 0.35 });
    for (const key of walls) {
      const [x, y] = key.split(',').map(Number);
      g.roundRect(ox + x! * cell + 1, oy + y! * cell + 1, cell - 2, cell - 2, 3).fill({
        color: 0x123b6d,
      });
    }
    for (const key of dots) {
      const [x, y] = key.split(',').map(Number);
      g.circle(ox + x! * cell + cell / 2, oy + y! * cell + cell / 2, 2.4).fill({ color: GOLD });
    }
    for (const key of powers) {
      const [x, y] = key.split(',').map(Number);
      const pulse = 1 + Math.sin(t * 8 + x!) * 0.18;
      g.circle(ox + x! * cell + cell / 2, oy + y! * cell + cell / 2, cell * 0.24 * pulse).fill({
        color: power > 0 ? CYAN : VIOLET,
      });
    }
    if (fruit) {
      g.circle(ox + fruit.x * cell + cell / 2, oy + fruit.y * cell + cell / 2, cell * 0.3).fill({
        color: 0xff2e44,
      });
      g.rect(
        ox + fruit.x * cell + cell / 2 - 1,
        oy + fruit.y * cell + cell * 0.18,
        2,
        cell * 0.2,
      ).fill({ color: GREEN });
    }
    if (speedPellet) {
      const pul = 1 + Math.sin(t * 9) * 0.2;
      g.star(
        ox + speedPellet.x * cell + cell / 2,
        oy + speedPellet.y * cell + cell / 2,
        4,
        cell * 0.26 * pul,
        cell * 0.12,
      ).fill({ color: GREEN });
    }
    g.circle(ox + player.x * cell + cell / 2, oy + player.y * cell + cell / 2, cell * 0.38).fill({
      color: speedT > 0 ? GREEN : 0xffeb3b,
    });
    for (const f of foes) {
      g.roundRect(ox + f.x * cell + 2, oy + f.y * cell + 2, cell - 4, cell - 4, 6).fill({
        color: power > 0 ? CYAN : PINK,
      });
    }
    drawSparks(g, sparks);
  }
  return {
    update(dt) {
      if (over) return;
      t += dt;
      updateSparks(sparks, dt);
      const wasPower = power > 0;
      power = Math.max(0, power - dt);
      if (wasPower && power <= 0) chain = 0; // chain resets when power ends
      speedT = Math.max(0, speedT - dt);
      // Feature: spawn bonus fruit + speed pellet on timers
      fruitTimer -= dt;
      if (!fruit && fruitTimer <= 0) {
        fruit = { ...freeFloor(), t: 8 };
        fruitTimer = 12 + ctx.rng.next() * 6;
      }
      if (fruit) {
        fruit.t -= dt;
        if (fruit.t <= 0) fruit = null;
      }
      speedTimer -= dt;
      if (!speedPellet && speedTimer <= 0) {
        speedPellet = freeFloor();
        speedTimer = 16 + ctx.rng.next() * 8;
      }
      tick += dt;
      if (tick > (speedT > 0 ? 0.09 : 0.14)) {
        tick = 0;
        const a = ctx.input.axis();
        const nx = player.x + Math.sign(a.x);
        const ny = player.y + Math.sign(a.y);
        if ((a.x || a.y) && can(nx, ny)) player = { x: nx, y: ny };
        const k = `${player.x},${player.y}`;
        if (dots.delete(k)) {
          score += 20;
          ctx.audio.sfx('coin');
        }
        if (fruit && player.x === fruit.x && player.y === fruit.y) {
          score += 300;
          fruit = null;
          ctx.audio.sfx('coin');
          ctx.fx.floatingText('+300', ox + player.x * cell + cell / 2, oy + player.y * cell, GOLD);
        }
        if (speedPellet && player.x === speedPellet.x && player.y === speedPellet.y) {
          speedT = 6;
          speedPellet = null;
          ctx.audio.sfx('powerup');
          ctx.hud.toast('SPEED BOOST');
        }
        if (powers.delete(k)) {
          power = 6;
          chain = 0;
          score += 120;
          ctx.audio.sfx('powerup');
          ctx.hud.toast('POWER MODE');
          burst(
            sparks,
            ctx.rng,
            ox + player.x * cell + cell / 2,
            oy + player.y * cell + cell / 2,
            VIOLET,
            16,
            120,
          );
        }
        for (const f of foes) {
          const opts = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ].filter(([dx, dy]) => can(f.x + dx!, f.y + dy!));
          opts.sort(
            (aa, bb) =>
              Math.hypot(player.x - (f.x + aa[0]!), player.y - (f.y + aa[1]!)) -
              Math.hypot(player.x - (f.x + bb[0]!), player.y - (f.y + bb[1]!)),
          );
          const pick =
            opts[
              Math.min(opts.length - 1, ctx.rng.next() < 0.7 ? 0 : ctx.rng.int(0, opts.length - 1))
            ]!;
          f.x += pick[0]!;
          f.y += pick[1]!;
          if (f.x === player.x && f.y === player.y) {
            if (power > 0) {
              chain++;
              const pts = 260 * Math.pow(2, Math.min(chain - 1, 3)); // 260/520/1040/2080
              score += pts;
              ctx.audio.sfx('explosion');
              ctx.fx.floatingText(`+${pts}`, ox + f.x * cell + cell / 2, oy + f.y * cell, CYAN);
              f.x = cols - 2;
              f.y = f.phase > 1 ? 1 : rows - 2;
            } else {
              lives--;
              ctx.hud.setLives(lives);
              ctx.fx.screenShake(7, 0.16);
              player = { x: 1, y: 1 };
              if (lives <= 0) {
                over = true;
                ctx.gameOver(score);
              }
            }
          }
        }
        if (!dots.size) {
          over = true;
          ctx.gameOver(score + 1000);
        }
        ctx.hud.setScore(score);
        ctx.hud.setLabel(
          power > 0
            ? `POWER ${Math.ceil(power)}${chain > 1 ? ` x${chain}` : ''}`
            : speedT > 0
              ? `SPEED ${Math.ceil(speedT)}`
              : `DOTS ${dots.size}`,
        );
        draw();
      }
    },
    destroy() {
      layer.destroy({ children: true });
    },
  };
}
