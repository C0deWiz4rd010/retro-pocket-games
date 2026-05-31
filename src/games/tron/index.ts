import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action, Dir } from '@core/InputManager';

interface Cycle {
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: number;
}

const DIRS: Record<string, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export default function createGame(ctx: GameContext): Game {
  const cell = 8;
  const cols = Math.floor(ctx.width / cell);
  const rows = Math.floor(ctx.height / cell);
  const ox = (ctx.width - cols * cell) / 2;
  const oy = (ctx.height - rows * cell) / 2;

  const layer = new Container();
  layer.position.set(ox, oy);
  ctx.stage.addChild(layer);
  const trailG = new Graphics();
  const headG = new Graphics();
  layer.addChild(trailG, headG);

  const grid = new Uint8Array(cols * rows); // 0 empty, 1 player, 2 cpu
  const at = (x: number, y: number): number => grid[y * cols + x] ?? 1;
  const setCell = (x: number, y: number, v: number): void => {
    grid[y * cols + x] = v;
  };

  const player: Cycle = { x: Math.floor(cols * 0.25), y: Math.floor(rows / 2), dx: 1, dy: 0, color: 0x00f7ff };
  const cpu: Cycle = { x: Math.floor(cols * 0.75), y: Math.floor(rows / 2), dx: -1, dy: 0, color: 0xff2e97 };
  let next = { x: 1, y: 0 };
  let acc = 0;
  let speed = 0.08;
  let over = false;
  let wins = 0;

  ctx.hud.setScore(0);
  ctx.hud.setLabel('TRAP THE RIVAL');

  const turn = (a: Action | Dir): void => {
    const d = DIRS[a];
    if (!d) return;
    if (d.x === -player.dx && d.y === -player.dy) return;
    next = d;
  };
  const offDown = ctx.input.on('down', turn);
  const offSwipe = ctx.input.on('swipe', turn);

  const blocked = (x: number, y: number): boolean =>
    x < 0 || y < 0 || x >= cols || y >= rows || at(x, y) !== 0;

  const cpuThink = (): void => {
    const options = [
      { x: cpu.dx, y: cpu.dy },
      { x: -cpu.dy, y: cpu.dx },
      { x: cpu.dy, y: -cpu.dx },
    ].filter((d) => !blocked(cpu.x + d.x, cpu.y + d.y));
    if (!options.length) return;
    let best = options[0]!;
    let bestSpace = -1;
    for (const d of options) {
      let space = 0;
      let tx = cpu.x;
      let ty = cpu.y;
      while (space < 12 && !blocked(tx + d.x, ty + d.y)) {
        tx += d.x;
        ty += d.y;
        space++;
      }
      if (space > bestSpace || (space === bestSpace && ctx.rng.next() < 0.3)) {
        bestSpace = space;
        best = d;
      }
    }
    cpu.dx = best.x;
    cpu.dy = best.y;
  };

  const drawHeads = (): void => {
    headG.clear();
    headG.rect(player.x * cell, player.y * cell, cell, cell).fill({ color: 0xffffff });
    headG.rect(cpu.x * cell, cpu.y * cell, cell, cell).fill({ color: 0xffd200 });
  };

  const reset = (): void => {
    grid.fill(0);
    trailG.clear();
    player.x = Math.floor(cols * 0.25);
    player.y = Math.floor(rows / 2);
    player.dx = 1;
    player.dy = 0;
    cpu.x = Math.floor(cols * 0.75);
    cpu.y = Math.floor(rows / 2);
    cpu.dx = -1;
    cpu.dy = 0;
    next = { x: 1, y: 0 };
  };

  const endRound = (playerWon: boolean): void => {
    if (playerWon) {
      wins++;
      ctx.hud.setScore(wins * 100);
      ctx.audio.sfx('powerup');
      ctx.hud.toast(`ROUND WON (${wins})`);
      reset();
      speed = Math.max(0.045, speed - 0.006);
    } else {
      over = true;
      ctx.audio.sfx('explosion');
      ctx.gameOver(wins * 100, { wins });
    }
  };

  return {
    update(dt) {
      if (over) return;
      acc += dt;
      if (acc < speed) return;
      acc = 0;

      player.dx = next.x;
      player.dy = next.y;
      cpuThink();

      const pnx = player.x + player.dx;
      const pny = player.y + player.dy;
      const cnx = cpu.x + cpu.dx;
      const cny = cpu.y + cpu.dy;
      const pDead = blocked(pnx, pny) || (pnx === cnx && pny === cny);
      const cDead = blocked(cnx, cny);
      if (pDead) return endRound(false);
      if (cDead) return endRound(true);

      setCell(player.x, player.y, 1);
      setCell(cpu.x, cpu.y, 2);
      trailG.rect(player.x * cell, player.y * cell, cell, cell).fill({ color: player.color });
      trailG.rect(cpu.x * cell, cpu.y * cell, cell, cell).fill({ color: cpu.color });

      player.x = pnx;
      player.y = pny;
      cpu.x = cnx;
      cpu.y = cny;
      drawHeads();
    },
    destroy() {
      offDown();
      offSwipe();
      layer.destroy({ children: true });
    },
  };
}
