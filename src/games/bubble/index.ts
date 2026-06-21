import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

const COLS = 9;
const ROWS = 12;
const COLORS = [0xff4d4d, 0xffd200, 0x3ddc84, 0x00f7ff, 0xb388ff, 0xff80ab];
const MIN_MATCH = 3;

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const R = Math.floor((Math.min(W / COLS, H / (ROWS + 4))) * 0.48);
  const diam = R * 2;
  const rowH = R * Math.sqrt(3);
  const startX = (W - COLS * diam) / 2 + R;
  const startY = R + 10;

  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  // Bubble grid: null = empty
  type Bubble = number | null; // color index
  const grid: Bubble[][] = [];

  const colForRow = (row: number): number => (row % 2 === 0 ? COLS : COLS - 1);

  const bubbleX = (row: number, col: number): number =>
    startX + col * diam + (row % 2 === 1 ? R : 0);
  const bubbleY = (row: number): number => startY + row * rowH;

  // init grid
  const initRows = 6;
  for (let r = 0; r < ROWS; r++) {
    const cols = colForRow(r);
    grid.push(new Array(cols).fill(null));
    if (r < initRows) {
      for (let c = 0; c < cols; c++) {
        grid[r]![c] = Math.floor(ctx.rng.next() * COLORS.length);
      }
    }
  }
  // shooter
  const shooterX = W / 2;
  const shooterY = H - 60;
  let aimAngle = -Math.PI / 2; // pointing up
  let score = 0;
  let over = false;
  let bubblesLeft = 50;
  let combo = 0; // Feature: consecutive-pop combo

  // current and next bubble
  let currentColor = Math.floor(ctx.rng.next() * COLORS.length);
  let nextColor = Math.floor(ctx.rng.next() * COLORS.length);
  let currentBomb = false; // Feature: bomb bubble
  let nextBomb = ctx.rng.next() < 0.1;

  interface Shot {
    x: number; y: number;
    vx: number; vy: number;
    color: number;
    bomb: boolean;
  }
  let shot: Shot | null = null;

  ctx.hud.setScore(0);
  ctx.hud.setLabel('TAP TO AIM & SHOOT');

  const draw = (): void => {
    g.clear();

    // draw grid bubbles
    for (let r = 0; r < ROWS; r++) {
      const cols = colForRow(r);
      for (let c = 0; c < cols; c++) {
        const ci = grid[r]![c];
        if (ci === null || ci === undefined) continue;
        const bx = bubbleX(r, c);
        const by = bubbleY(r);
        g.circle(bx, by, R - 2).fill({ color: COLORS[ci]! });
        g.circle(bx - R * 0.3, by - R * 0.3, R * 0.22).fill({ color: 0xffffff, alpha: 0.4 });
      }
    }

    // danger line
    const dangerRow = ROWS - 4;
    g.rect(0, bubbleY(dangerRow), W, 1).fill({ color: 0xff4d4d, alpha: 0.3 });

    // Feature: aim line that predicts wall bounces
    if (!shot) {
      let ax = shooterX, ay = shooterY;
      let dvx = Math.cos(aimAngle);
      const dvy = Math.sin(aimAngle);
      for (let i = 0; i < 140; i++) {
        ax += dvx * 8; ay += dvy * 8;
        if (ax < R) { ax = R; dvx = Math.abs(dvx); }
        else if (ax > W - R) { ax = W - R; dvx = -Math.abs(dvx); }
        if (ay < startY) break;
        let hit = false;
        for (let r = 0; r < ROWS && !hit; r++) {
          const cols = colForRow(r);
          for (let c = 0; c < cols; c++) { if (grid[r]![c] === null) continue; if (Math.hypot(ax - bubbleX(r, c), ay - bubbleY(r)) < diam - 2) { hit = true; break; } }
        }
        if (hit) break;
        if (i % 3 === 0) g.circle(ax, ay, 2.5).fill({ color: 0xffffff, alpha: 0.45 });
      }
    }

    // shooter base
    const drawBomb = (bx: number, by: number, rr: number): void => {
      g.circle(bx, by, rr).fill({ color: 0x222233 });
      g.circle(bx, by, rr * 0.5).fill({ color: 0xff7b00 });
      g.rect(bx - 1, by - rr - 2, 2, 4).fill({ color: 0xffd200 });
    };
    g.circle(shooterX, shooterY, R + 4).fill({ color: 0x2b2b40 });
    if (currentBomb) drawBomb(shooterX, shooterY, R - 2);
    else { g.circle(shooterX, shooterY, R - 2).fill({ color: COLORS[currentColor]! }); g.circle(shooterX - R * 0.3, shooterY - R * 0.3, R * 0.22).fill({ color: 0xffffff, alpha: 0.4 }); }

    // next bubble preview
    if (nextBomb) drawBomb(shooterX + R * 3, shooterY, R * 0.7);
    else { g.circle(shooterX + R * 3, shooterY, R * 0.7).fill({ color: COLORS[nextColor]! }); g.circle(shooterX + R * 3 - R * 0.25, shooterY - R * 0.25, R * 0.16).fill({ color: 0xffffff, alpha: 0.35 }); }

    // flying shot
    if (shot) {
      if (shot.bomb) drawBomb(shot.x, shot.y, R - 2);
      else g.circle(shot.x, shot.y, R - 2).fill({ color: COLORS[shot.color]! });
    }
  };

  // flood fill to find connected group of same color
  const findGroup = (row: number, col: number, color: number): { r: number; c: number }[] => {
    const visited = new Set<string>();
    const group: { r: number; c: number }[] = [];
    const queue: { r: number; c: number }[] = [{ r: row, c: col }];
    while (queue.length) {
      const { r, c } = queue.shift()!;
      const key = `${r},${c}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (r < 0 || r >= ROWS || c < 0 || c >= colForRow(r)) continue;
      if (grid[r]![c] !== color) continue;
      group.push({ r, c });
      // hex neighbors
      const even = r % 2 === 0;
      const neighbors = [
        { r: r, c: c - 1 }, { r: r, c: c + 1 },
        { r: r - 1, c: even ? c - 1 : c }, { r: r - 1, c: even ? c : c + 1 },
        { r: r + 1, c: even ? c - 1 : c }, { r: r + 1, c: even ? c : c + 1 },
      ];
      queue.push(...neighbors);
    }
    return group;
  };

  // find floating bubbles (not connected to top)
  const findFloating = (): { r: number; c: number }[] => {
    const connected = new Set<string>();
    const queue: { r: number; c: number }[] = [];
    for (let c = 0; c < colForRow(0); c++) {
      if (grid[0]![c] !== null) queue.push({ r: 0, c });
    }
    while (queue.length) {
      const { r, c } = queue.shift()!;
      const key = `${r},${c}`;
      if (connected.has(key)) continue;
      if (r < 0 || r >= ROWS || c < 0 || c >= colForRow(r)) continue;
      if (grid[r]![c] === null) continue;
      connected.add(key);
      const even = r % 2 === 0;
      const neighbors = [
        { r: r, c: c - 1 }, { r: r, c: c + 1 },
        { r: r - 1, c: even ? c - 1 : c }, { r: r - 1, c: even ? c : c + 1 },
        { r: r + 1, c: even ? c - 1 : c }, { r: r + 1, c: even ? c : c + 1 },
      ];
      queue.push(...neighbors);
    }
    const floating: { r: number; c: number }[] = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < colForRow(r); c++)
        if (grid[r]![c] !== null && !connected.has(`${r},${c}`))
          floating.push({ r, c });
    return floating;
  };

  const snapBubble = (bx: number, by: number, color: number, bomb = false): void => {
    // find nearest empty grid cell
    let bestR = -1, bestC = -1, bestDist = Infinity;
    for (let r = 0; r < ROWS; r++) {
      const cols = colForRow(r);
      for (let c = 0; c < cols; c++) {
        if (grid[r]![c] !== null) continue;
        const gx = bubbleX(r, c);
        const gy = bubbleY(r);
        // only snap if adjacent to existing bubble or top row
        let hasNeighbor = r === 0;
        if (!hasNeighbor) {
          const even = r % 2 === 0;
          const neighbors = [
            { r, c: c - 1 }, { r, c: c + 1 },
            { r: r - 1, c: even ? c - 1 : c }, { r: r - 1, c: even ? c : c + 1 },
          ];
          hasNeighbor = neighbors.some((n) => n.r >= 0 && n.c >= 0 && n.c < colForRow(n.r) && grid[n.r]?.[n.c] !== null);
        }
        if (!hasNeighbor) continue;
        const dist = Math.hypot(bx - gx, by - gy);
        if (dist < bestDist) { bestDist = dist; bestR = r; bestC = c; }
      }
    }
    if (bestR === -1) return;

    if (bomb) {
      // Feature: bomb clears every bubble within a blast radius
      const cx = bubbleX(bestR, bestC), cy = bubbleY(bestR);
      let cleared = 0;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < colForRow(r); c++) {
        if (grid[r]![c] === null) continue;
        if (Math.hypot(bubbleX(r, c) - cx, bubbleY(r) - cy) < diam * 1.9) { grid[r]![c] = null; cleared++; }
      }
      score += cleared * 15;
      combo = 0;
      ctx.hud.setScore(score);
      ctx.hud.toast(`BOMB! ${cleared}`);
      ctx.audio.sfx('explosion');
      ctx.fx.screenShake(7, 0.18);
      const floating0 = findFloating();
      floating0.forEach(({ r, c }) => { grid[r]![c] = null; });
      if (floating0.length) score += floating0.length * 20;
      ctx.hud.setScore(score);
    } else {
      grid[bestR]![bestC] = color;

      // check match
      const group = findGroup(bestR, bestC, color);
      if (group.length >= MIN_MATCH) {
        group.forEach(({ r, c }) => { grid[r]![c] = null; });
        combo++; // Feature: pop combo
        const mult = 1 + Math.floor(combo / 3);
        ctx.audio.sfx('powerup');
        score += group.length * 10 * mult;
        ctx.hud.setScore(score);
        if (group.length >= 5 || combo >= 3) ctx.hud.toast(`CHAIN x${group.length}${mult > 1 ? ` · x${mult}` : ''}`);

        // drop floating
        const floating = findFloating();
        if (floating.length) {
          floating.forEach(({ r, c }) => { grid[r]![c] = null; });
          score += floating.length * 20 * mult;
          ctx.hud.setScore(score);
          ctx.audio.sfx('coin');
        }
      } else {
        combo = 0;
        ctx.audio.sfx('blip');
      }
    }

    // check if any bubble reached the danger row
    for (let c = 0; c < colForRow(ROWS - 4); c++) {
      if (grid[ROWS - 4]![c] !== null) {
        over = true;
        ctx.audio.sfx('gameover');
        ctx.gameOver(score, {});
        return;
      }
    }
    // check cleared
    let anyLeft = false;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < colForRow(r); c++)
        if (grid[r]![c] !== null) { anyLeft = true; break; }
    if (!anyLeft) {
      over = true;
      ctx.audio.sfx('powerup');
      ctx.hud.toast('CLEARED!');
      ctx.gameOver(score + 500, {});
    }

    // next bubble
    currentColor = nextColor;
    currentBomb = nextBomb;
    nextColor = Math.floor(ctx.rng.next() * COLORS.length);
    nextBomb = ctx.rng.next() < 0.1;
    bubblesLeft--;
    if (bubblesLeft <= 0 && !over) {
      over = true;
      ctx.gameOver(score, {});
    }
    ctx.hud.setLabel(`BUBBLES ${bubblesLeft}`);
  };

  const fire = (angle: number): void => {
    if (shot || over) return;
    shot = {
      x: shooterX, y: shooterY,
      vx: Math.cos(angle) * 480,
      vy: Math.sin(angle) * 480,
      color: currentColor,
      bomb: currentBomb,
    };
    ctx.audio.sfx('shoot');
  };

  const offPtr = ctx.input.on('pointermove', ({ x, y }) => {
    const dx = x - shooterX;
    const dy = y - shooterY;
    const angle = Math.atan2(dy, dx);
    // clamp to upward hemisphere
    aimAngle = Math.max(-Math.PI + 0.15, Math.min(-0.15, angle));
    if (!shot) draw();
  });

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (over) return;
    if (shot) return;
    const dx = x - shooterX;
    const dy = y - shooterY;
    const angle = Math.atan2(dy, dx);
    const clampedAngle = Math.max(-Math.PI + 0.15, Math.min(-0.15, angle));
    fire(clampedAngle);
  });

  draw();

  return {
    update(dt) {
      if (over) return;
      if (!shot) return;
      const s = shot; // non-null reference for the rest of this tick

      s.x += s.vx * dt;
      s.y += s.vy * dt;

      // wall bounce
      if (s.x < R) { s.x = R; s.vx = Math.abs(s.vx); }
      if (s.x > W - R) { s.x = W - R; s.vx = -Math.abs(s.vx); }

      // hit ceiling
      if (s.y < startY) {
        snapBubble(s.x, startY, s.color, s.bomb);
        shot = null;
        draw();
        return;
      }

      // collision with grid bubbles
      let snapped = false;
      for (let r = 0; r < ROWS && !snapped; r++) {
        const cols = colForRow(r);
        for (let c = 0; c < cols && !snapped; c++) {
          if (grid[r]![c] === null) continue;
          const bx = bubbleX(r, c);
          const by = bubbleY(r);
          if (Math.hypot(s.x - bx, s.y - by) < diam - 2) {
            snapBubble(s.x, s.y, s.color, s.bomb);
            shot = null;
            snapped = true;
          }
        }
      }
      draw();
    },
    destroy() {
      offPtr();
      offTap();
      layer.destroy({ children: true });
    },
  };
}
