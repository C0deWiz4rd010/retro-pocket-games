import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action, Dir } from '@core/InputManager';

const DIRS: Record<string, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export default function createGame(ctx: GameContext): Game {
  // odd dimensions so the recursive-backtracker carver works cleanly
  const cols = 15;
  const rows = 21;
  const cell = Math.floor(Math.min(ctx.width / cols, (ctx.height - 20) / rows));
  const ox = (ctx.width - cols * cell) / 2;
  const oy = (ctx.height - rows * cell) / 2;

  const layer = new Container();
  layer.position.set(ox, oy);
  ctx.stage.addChild(layer);
  const mazeG = new Graphics();
  const g = new Graphics();
  layer.addChild(mazeG, g);

  // wall grid: true = wall
  const wall: boolean[] = new Array(cols * rows).fill(true);
  const wi = (c: number, r: number): number => r * cols + c;

  // recursive backtracker on odd cells
  const carve = (c: number, r: number): void => {
    wall[wi(c, r)] = false;
    const dirs = ctx.rng.shuffle([
      [0, -2],
      [0, 2],
      [-2, 0],
      [2, 0],
    ]);
    for (const [dx, dy] of dirs) {
      const nc = c + dx!;
      const nr = r + dy!;
      if (nc > 0 && nc < cols - 1 && nr > 0 && nr < rows - 1 && wall[wi(nc, nr)]) {
        wall[wi(c + dx! / 2, r + dy! / 2)] = false;
        carve(nc, nr);
      }
    }
  };
  carve(1, 1);

  const player = { c: 1, r: 1 };
  const exit = { c: cols - 2, r: rows - 2 };
  wall[wi(exit.c, exit.r)] = false;
  let timeLeft = 30;
  let over = false;
  let level = 1;
  let totalScore = 0;
  // Feature: coins, key-locked exit, path hint
  const coins = new Set<number>();
  let key = -1;
  let hasKey = false;
  let hints = 3;
  let pathFlash: number[] = [];
  let flashT = 0;

  const openCells = (): number[] => {
    const out: number[] = [];
    for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
      const i = wi(c, r);
      if (!wall[i] && !(c === 1 && r === 1) && !(c === exit.c && r === exit.r)) out.push(i);
    }
    return out;
  };
  const placeItems = (): void => {
    coins.clear();
    const open = ctx.rng.shuffle(openCells());
    for (let k = 0; k < Math.min(5, open.length); k++) coins.add(open[k]!);
    key = open[5] ?? -1;
    hasKey = false;
  };
  placeItems();

  // BFS shortest path (player -> exit) for the hint power-up
  const bfsPath = (): number[] => {
    const start = wi(player.c, player.r);
    const goal = wi(exit.c, exit.r);
    const prev = new Map<number, number>();
    const q = [start];
    const seen = new Set<number>([start]);
    while (q.length) {
      const i = q.shift()!;
      if (i === goal) break;
      const c = i % cols, r = Math.floor(i / cols);
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nc = c + dx!, nr = r + dy!;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const j = wi(nc, nr);
        if (wall[j] || seen.has(j)) continue;
        seen.add(j); prev.set(j, i); q.push(j);
      }
    }
    const path: number[] = [];
    let cur = goal;
    while (cur !== start && prev.has(cur)) { path.push(cur); cur = prev.get(cur)!; }
    return path;
  };

  ctx.hud.setScore(0);
  ctx.hud.setLabel('30s');

  const move = (a: Action | Dir): void => {
    if (over) return;
    const d = DIRS[a];
    if (!d) return;
    const nc = player.c + d.x;
    const nr = player.r + d.y;
    if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || wall[wi(nc, nr)]) return;
    player.c = nc;
    player.r = nr;
    ctx.audio.sfx('blip');
    const pi = wi(nc, nr);
    if (coins.delete(pi)) { totalScore += 50; ctx.hud.setScore(totalScore); ctx.audio.sfx('coin'); }
    if (pi === key) { key = -1; hasKey = true; ctx.hud.toast('KEY!'); ctx.audio.sfx('powerup'); drawMaze(); }
    if (player.c === exit.c && player.r === exit.r && hasKey) {
      const bonus = Math.ceil(timeLeft) * 10 + level * 100;
      totalScore += bonus;
      ctx.audio.sfx('levelup');
      ctx.hud.setScore(totalScore);
      ctx.hud.toast(`LV ${level} CLEAR! +${bonus}`);
      level++;
      // add time bonus, regenerate a larger maze
      timeLeft = Math.min(timeLeft + 12, 45);
      // clear and regenerate maze
      wall.fill(true);
      carve(1, 1);
      wall[wi(exit.c, exit.r)] = false;
      player.c = 1;
      player.r = 1;
      pathFlash = [];
      placeItems();
      drawMaze();
      draw();
    }
    draw();
  };
  const useHint = (): void => {
    if (over || hints <= 0) return;
    hints--;
    pathFlash = bfsPath();
    flashT = 1.6;
    ctx.audio.sfx('powerup');
    ctx.hud.toast(`HINT (${hints})`);
    draw();
  };
  const offDown = ctx.input.on('down', (a) => { if (a === 'a' || a === 'b' || a === 'start') useHint(); else move(a); });
  const offSwipe = ctx.input.on('swipe', move);

  const drawMaze = (): void => {
    mazeG.clear();
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (wall[wi(c, r)]) mazeG.rect(c * cell, r * cell, cell, cell).fill({ color: 0x2b2b40 });
    mazeG.roundRect(exit.c * cell + 2, exit.r * cell + 2, cell - 4, cell - 4, 3).fill({ color: hasKey ? 0x3ddc84 : 0x5a5a3a });
  };
  drawMaze();

  const draw = (): void => {
    g.clear();
    // hint path
    if (flashT > 0) for (const i of pathFlash) g.rect((i % cols) * cell + cell * 0.3, Math.floor(i / cols) * cell + cell * 0.3, cell * 0.4, cell * 0.4).fill({ color: 0xffd200, alpha: 0.35 + Math.sin(flashT * 14) * 0.2 });
    // coins
    for (const i of coins) g.circle((i % cols) * cell + cell / 2, Math.floor(i / cols) * cell + cell / 2, cell * 0.18).fill({ color: 0xffd200 });
    // key
    if (key >= 0) {
      const kx = (key % cols) * cell + cell / 2, ky = Math.floor(key / cols) * cell + cell / 2;
      g.circle(kx, ky - cell * 0.1, cell * 0.14).stroke({ width: 2, color: 0xffd200 });
      g.rect(kx - 1, ky, 2, cell * 0.22).fill({ color: 0xffd200 });
    }
    g.circle(player.c * cell + cell / 2, player.r * cell + cell / 2, cell * 0.34).fill({ color: 0x00f7ff });
  };
  draw();

  return {
    update(dt) {
      if (over) return;
      timeLeft -= dt;
      if (flashT > 0) { flashT -= dt; if (flashT <= 0) pathFlash = []; draw(); }
      ctx.hud.setLabel(`LV${level} ${Math.ceil(timeLeft)}s${hasKey ? ' 🔑' : ''}`);
      if (timeLeft <= 0) {
        over = true;
        ctx.audio.sfx('gameover');
        ctx.gameOver(totalScore, { level });
      }
    },
    destroy() {
      offDown();
      offSwipe();
      layer.destroy({ children: true });
    },
  };
}
