import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

const GRID = 8;
const SHIPS = [4, 3, 3, 2, 2]; // lengths: carrier, 2×destroyer, 2×patrol

type CellState = 'empty' | 'ship' | 'hit' | 'miss' | 'sunk';

interface Board {
  cells: CellState[];
  ships: { cells: number[]; hits: number }[];
}

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const padding = 10;
  const gridSize = Math.floor((Math.min(W, H) - padding * 2) / 2 - 8);
  const cell = Math.floor(gridSize / GRID);
  const gw = cell * GRID;

  // layout: two grids side by side, or stacked if portrait
  const portrait = H > W;
  const playerOx = portrait ? (W - gw) / 2 : (W / 2 - gw - 10);
  const playerOy = portrait ? padding + 20 : (H - gw) / 2;
  const enemyOx = portrait ? (W - gw) / 2 : (W / 2 + 10);
  const enemyOy = portrait ? playerOy + gw + 40 : (H - gw) / 2;

  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const playerLabel = new Text({ text: 'YOUR FLEET', style: { fontFamily: 'VT323, monospace', fontSize: 14, fill: 0x9bffce } });
  playerLabel.position.set(playerOx, playerOy - 18);
  const enemyLabel = new Text({ text: 'ENEMY - TAP TO FIRE', style: { fontFamily: 'VT323, monospace', fontSize: 14, fill: 0xff4d4d } });
  enemyLabel.position.set(enemyOx, enemyOy - 18);
  layer.addChild(playerLabel, enemyLabel);

  const makeBoard = (): Board => ({ cells: new Array(GRID * GRID).fill('empty'), ships: [] });
  const idx = (c: number, r: number): number => r * GRID + c;

  const placeShips = (board: Board, rng?: typeof ctx.rng): void => {
    for (const len of SHIPS) {
      let placed = false;
      while (!placed) {
        const horiz = (rng ?? ctx.rng).next() < 0.5;
        const c = Math.floor((rng ?? ctx.rng).next() * (horiz ? GRID - len + 1 : GRID));
        const r = Math.floor((rng ?? ctx.rng).next() * (horiz ? GRID : GRID - len + 1));
        const cells: number[] = [];
        let ok = true;
        for (let i = 0; i < len; i++) {
          const ci = idx(c + (horiz ? i : 0), r + (horiz ? 0 : i));
          if (board.cells[ci] !== 'empty') { ok = false; break; }
          cells.push(ci);
        }
        if (ok) {
          cells.forEach((ci) => (board.cells[ci] = 'ship'));
          board.ships.push({ cells, hits: 0 });
          placed = true;
        }
      }
    }
  };

  const player = makeBoard();
  const enemy = makeBoard();
  placeShips(player);
  placeShips(enemy, ctx.rng);

  // AI state: tracks last hit to continue sinking
  let aiLastHit: number | null = null;
  let aiHuntDir: { dc: number; dr: number } | null = null;
  const aiShot = new Set<number>();

  let score = 0;
  let over = false;
  let playerTurn = true;
  let hitStreak = 0; // Feature: consecutive-hit multiplier
  let sonar = 2; // Feature: sonar power-up
  let sonarArmed = false;
  const sonarReveal = new Set<number>();

  const shipsLeft = (board: Board): number => board.ships.filter((s) => s.hits < s.cells.length).length;
  const updateLabels = (): void => {
    playerLabel.text = `YOUR FLEET · ${shipsLeft(player)}`;
    enemyLabel.text = sonarArmed ? 'SONAR: TAP A ZONE' : `ENEMY · ${shipsLeft(enemy)} · 📡${sonar}`;
  };

  ctx.hud.setScore(0);
  ctx.hud.setLabel('YOUR TURN — FIRE!');

  const drawBoard = (board: Board, ox: number, oy: number, hideShips: boolean): void => {
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const ci = idx(c, r);
        const state = board.cells[ci]!;
        const x = ox + c * cell;
        const y = oy + r * cell;
        let color = 0x1d1d4e;
        if (state === 'ship' && !hideShips) color = 0x3d5a80;
        if (state === 'hit') color = 0xff4d4d;
        if (state === 'sunk') color = 0x8b0000;
        if (state === 'miss') color = 0x4a4a6a;
        g.roundRect(x + 1, y + 1, cell - 2, cell - 2, 2).fill({ color });
        if (state === 'hit' || state === 'sunk') {
          g.rect(x + cell * 0.3, y + cell * 0.3, cell * 0.4, cell * 0.4).fill({ color: 0xffd200 });
        }
        if (state === 'miss') {
          g.circle(x + cell / 2, y + cell / 2, cell * 0.18).fill({ color: 0x888888 });
        }
      }
    }
    // grid lines
    for (let i = 0; i <= GRID; i++) {
      g.rect(ox + i * cell, oy, 1, gw).fill({ color: 0x2b2b60, alpha: 0.6 });
      g.rect(ox, oy + i * cell, gw, 1).fill({ color: 0x2b2b60, alpha: 0.6 });
    }
  };

  const draw = (): void => {
    g.clear();
    drawBoard(player, playerOx, playerOy, false);
    drawBoard(enemy, enemyOx, enemyOy, true);
    // sonar hints on the enemy board
    for (const i of sonarReveal) {
      const c = i % GRID, r = Math.floor(i / GRID);
      const x = enemyOx + c * cell, y = enemyOy + r * cell;
      if (enemy.cells[i] === 'ship') g.circle(x + cell / 2, y + cell / 2, cell * 0.28).stroke({ width: 2, color: 0x00f7ff, alpha: 0.7 });
      else g.circle(x + cell / 2, y + cell / 2, cell * 0.08).fill({ color: 0x00f7ff, alpha: 0.4 });
    }
  };

  const checkWin = (board: Board): boolean =>
    board.ships.every((s) => s.hits >= s.cells.length);

  const shootEnemy = (ci: number): void => {
    if (enemy.cells[ci] === 'hit' || enemy.cells[ci] === 'miss' || enemy.cells[ci] === 'sunk') return;
    if (!playerTurn || over) return;

    const wasShip = enemy.cells[ci] === 'ship';
    enemy.cells[ci] = wasShip ? 'hit' : 'miss';

    if (wasShip) {
      ctx.audio.sfx('explosion');
      hitStreak++;
      const mult = 1 + Math.floor(hitStreak / 3);
      score += 50 * mult;
      if (hitStreak >= 3 && hitStreak % 3 === 0) ctx.hud.toast(`STREAK x${mult}`);
      ctx.hud.setScore(score);
      // check if ship sunk
      for (const ship of enemy.ships) {
        if (ship.cells.includes(ci)) {
          ship.hits++;
          if (ship.hits >= ship.cells.length) {
            ship.cells.forEach((c) => (enemy.cells[c] = 'sunk'));
            ctx.hud.toast('SHIP SUNK!');
            ctx.audio.sfx('powerup');
            score += 100;
          }
        }
      }
      if (checkWin(enemy)) {
        over = true;
        ctx.audio.sfx('powerup');
        ctx.hud.toast('YOU WIN!');
        draw();
        ctx.gameOver(score, {});
        return;
      }
    } else {
      ctx.audio.sfx('blip');
      hitStreak = 0;
      playerTurn = false;
      ctx.hud.setLabel('ENEMY TURN…');
    }
    updateLabels();
    draw();
    if (!wasShip) setTimeout(() => aiTurn(), 600);
  };

  const aiTurn = (): void => {
    if (over) return;
    // AI: hunt mode or target mode
    let ci = -1;
    if (aiLastHit !== null && aiHuntDir !== null) {
      const lc = aiLastHit % GRID;
      const lr = Math.floor(aiLastHit / GRID);
      const nc = lc + aiHuntDir.dc;
      const nr = lr + aiHuntDir.dr;
      if (nc >= 0 && nc < GRID && nr >= 0 && nr < GRID && !aiShot.has(idx(nc, nr))) {
        ci = idx(nc, nr);
      } else {
        aiHuntDir = null;
        ci = -1;
      }
    }
    if (ci === -1) {
      // checkerboard hunt pattern
      const candidates: number[] = [];
      for (let i = 0; i < GRID * GRID; i++) {
        const c = i % GRID, r = Math.floor(i / GRID);
        if (!aiShot.has(i) && (c + r) % 2 === 0) candidates.push(i);
      }
      if (!candidates.length) {
        for (let i = 0; i < GRID * GRID; i++) if (!aiShot.has(i)) candidates.push(i);
      }
      ci = candidates[Math.floor(ctx.rng.next() * candidates.length)]!;
    }

    aiShot.add(ci);
    const wasShip = player.cells[ci] === 'ship';
    player.cells[ci] = wasShip ? 'hit' : 'miss';

    if (wasShip) {
      ctx.audio.sfx('hit');
      aiLastHit = ci;
      if (!aiHuntDir) aiHuntDir = ctx.rng.pick([{ dc: 1, dr: 0 }, { dc: -1, dr: 0 }, { dc: 0, dr: 1 }, { dc: 0, dr: -1 }]);
      for (const ship of player.ships) {
        if (ship.cells.includes(ci)) {
          ship.hits++;
          if (ship.hits >= ship.cells.length) {
            ship.cells.forEach((c) => (player.cells[c] = 'sunk'));
            aiLastHit = null;
            aiHuntDir = null;
            ctx.hud.toast('YOUR SHIP SUNK!');
          }
        }
      }
      if (checkWin(player)) {
        over = true;
        ctx.audio.sfx('gameover');
        ctx.hud.toast('GAME OVER');
        draw();
        ctx.gameOver(score, {});
        return;
      }
    }

    playerTurn = true;
    ctx.hud.setLabel('YOUR TURN — FIRE!');
    updateLabels();
    draw();
  };

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (over || !playerTurn) return;
    const c = Math.floor((x - enemyOx) / cell);
    const r = Math.floor((y - enemyOy) / cell);
    if (c < 0 || c >= GRID || r < 0 || r >= GRID) return;
    if (sonarArmed) {
      // Feature: sonar reveals ships in the tapped 3x3 zone
      sonarArmed = false;
      sonar--;
      let found = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nc >= GRID || nr < 0 || nr >= GRID) continue;
        const i = idx(nc, nr);
        sonarReveal.add(i);
        if (enemy.cells[i] === 'ship') found++;
      }
      ctx.hud.toast(`SONAR: ${found} ship cell${found === 1 ? '' : 's'} near`);
      ctx.audio.sfx('powerup');
      updateLabels();
      draw();
      return;
    }
    shootEnemy(idx(c, r));
  });
  const offDown = ctx.input.on('down', (a) => {
    if (over || !playerTurn) return;
    if ((a === 'a' || a === 'b' || a === 'start') && sonar > 0) {
      sonarArmed = !sonarArmed;
      ctx.audio.sfx('select');
      updateLabels();
    }
  });

  updateLabels();
  draw();

  return {
    update() {},
    destroy() {
      offTap();
      offDown();
      layer.destroy({ children: true });
    },
  };
}
