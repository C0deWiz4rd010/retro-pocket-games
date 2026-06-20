import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action, Dir } from '@core/InputManager';

const N = 4;
const COLORS: Record<number, number> = {
  2: 0x3c3a32, 4: 0x4a4632, 8: 0xf2b179, 16: 0xf59563, 32: 0xf67c5f, 64: 0xf65e3b,
  128: 0xedcf72, 256: 0xedcc61, 512: 0xedc850, 1024: 0xedc53f, 2048: 0xedc22e,
};

export default function createGame(ctx: GameContext): Game {
  const pad = 18;
  const boardSize = Math.min(ctx.width - pad * 2, ctx.height - pad * 2);
  const gap = 10;
  const cell = (boardSize - gap * (N + 1)) / N;
  const ox = (ctx.width - boardSize) / 2;
  const oy = (ctx.height - boardSize) / 2;

  const layer = new Container();
  layer.position.set(ox, oy);
  ctx.stage.addChild(layer);

  const board = new Graphics();
  board.roundRect(0, 0, boardSize, boardSize, 12).fill({ color: 0x1d1d2b });
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++)
      board
        .roundRect(gap + x * (cell + gap), gap + y * (cell + gap), cell, cell, 8)
        .fill({ color: 0xffffff, alpha: 0.04 });
  layer.addChild(board);

  const tilesG = new Graphics();
  const fxG = new Graphics();
  const labels: Text[] = [];
  layer.addChild(tilesG, fxG);
  for (let i = 0; i < N * N; i++) {
    const t = new Text({ text: '', style: { fontFamily: 'Inter, sans-serif', fontWeight: '800', fontSize: cell * 0.32, fill: 0x101018, align: 'center' } });
    t.anchor.set(0.5);
    labels.push(t);
    layer.addChild(t);
  }

  let grid: number[] = new Array(N * N).fill(0);
  let score = 0;
  let over = false;
  let won = false;
  let prev: { grid: number[]; score: number } | null = null;
  let bestTile = 0; // Feature: milestone celebrations
  let hammers = 3; // Feature: hammer power-up (remove one tile)
  let hammerArmed = false;
  // per-cell scale for merge bounce animation [0,1] => 1 when idle
  const cellScale: number[] = new Array(N * N).fill(1);
  interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: number }
  interface Popup { life: number; t: Text }
  const particles: Particle[] = [];
  const popups: Popup[] = [];

  const cellCenter = (i: number): { x: number; y: number } => ({
    x: gap + (i % N) * (cell + gap) + cell / 2,
    y: gap + Math.floor(i / N) * (cell + gap) + cell / 2,
  });
  const burst = (i: number, color: number, n = 8): void => {
    const c = cellCenter(i);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const s = 40 + ctx.rng.next() * 80;
      particles.push({ x: c.x, y: c.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, color });
    }
  };
  const popup = (i: number, text: string, color: number): void => {
    const c = cellCenter(i);
    const t = new Text({ text, style: { fontFamily: 'Inter, sans-serif', fontWeight: '800', fontSize: cell * 0.22, fill: color, align: 'center' } });
    t.anchor.set(0.5);
    t.position.set(c.x, c.y);
    layer.addChild(t);
    popups.push({ life: 1, t });
  };

  const setLabel = (): void => {
    ctx.hud.setLabel(hammerArmed ? 'TAP A TILE TO SMASH' : `SWIPE • B=UNDO • A=HAMMER(${hammers})`);
  };
  const at = (x: number, y: number): number => grid[y * N + x] as number;
  const set = (x: number, y: number, v: number): void => {
    grid[y * N + x] = v;
  };

  const spawn = (): void => {
    const empty: number[] = [];
    grid.forEach((v, i) => v === 0 && empty.push(i));
    if (!empty.length) return;
    const idx = empty[Math.floor(ctx.rng.next() * empty.length)] as number;
    grid[idx] = ctx.rng.next() < 0.9 ? 2 : 4;
  };

  const line = (vals: number[]): { row: number[]; gained: number; mergedAt: number[] } => {
    const f = vals.filter((v) => v !== 0);
    let gained = 0;
    const mergedAt: number[] = [];
    for (let i = 0; i < f.length - 1; i++) {
      if (f[i] === f[i + 1]) {
        f[i] = (f[i] as number) * 2;
        gained += f[i] as number;
        mergedAt.push(i);
        f.splice(i + 1, 1);
      }
    }
    while (f.length < N) f.push(0);
    return { row: f, gained, mergedAt };
  };

  const move = (dir: 'up' | 'down' | 'left' | 'right'): boolean => {
    const before = grid.join(',');
    const snapGrid = [...grid];
    const snapScore = score;
    let gained = 0;
    let mergeCount = 0;
    for (let i = 0; i < N; i++) {
      const vals: number[] = [];
      for (let j = 0; j < N; j++) {
        if (dir === 'left') vals.push(at(j, i));
        else if (dir === 'right') vals.push(at(N - 1 - j, i));
        else if (dir === 'up') vals.push(at(i, j));
        else vals.push(at(i, N - 1 - j));
      }
      const { row, gained: g, mergedAt } = line(vals);
      gained += g;
      for (let j = 0; j < N; j++) {
        const v = row[j] as number;
        let idx = -1;
        if (dir === 'left') { set(j, i, v); idx = i * N + j; }
        else if (dir === 'right') { set(N - 1 - j, i, v); idx = i * N + (N - 1 - j); }
        else if (dir === 'up') { set(i, j, v); idx = j * N + i; }
        else { set(i, N - 1 - j, v); idx = (N - 1 - j) * N + i; }
        if (mergedAt.includes(j) && idx >= 0) {
          cellScale[idx] = 1.25;
          mergeCount++;
          burst(idx, COLORS[v] ?? 0xedc22e, v >= 128 ? 12 : 6);
          popup(idx, `+${v}`, 0xffffff);
        }
      }
    }
    const moved = grid.join(',') !== before;
    if (moved) {
      prev = { grid: snapGrid, score: snapScore };
      score += gained;
      // Feature: chain bonus for multiple merges in one move
      if (mergeCount >= 2) {
        const bonus = mergeCount * 20;
        score += bonus;
        ctx.hud.toast(`CHAIN x${mergeCount}! +${bonus}`);
      }
      ctx.hud.setScore(score);
      if (gained > 0) ctx.audio.sfx('eat');
      else ctx.audio.sfx('blip');
      spawn();
      // Feature: milestone celebration on a new highest tile
      const top = Math.max(...grid);
      if (top > bestTile && top >= 128) {
        bestTile = top;
        ctx.audio.sfx('coin');
        ctx.hud.toast(`NEW BEST: ${top}`);
      } else {
        bestTile = Math.max(bestTile, top);
      }
      draw();
      if (!won && grid.includes(2048)) {
        won = true;
        ctx.audio.sfx('powerup');
        ctx.hud.toast('2048! KEEP GOING');
      }
      if (!canMove()) endGame();
    }
    return moved;
  };

  const undo = (): void => {
    if (over || !prev) return;
    grid = [...prev.grid];
    score = prev.score;
    prev = null;
    ctx.hud.setScore(score);
    ctx.audio.sfx('select');
    draw();
  };

  const canMove = (): boolean => {
    if (grid.includes(0)) return true;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const v = at(x, y);
        if (x < N - 1 && at(x + 1, y) === v) return true;
        if (y < N - 1 && at(x, y + 1) === v) return true;
      }
    return false;
  };

  const endGame = (): void => {
    over = true;
    ctx.gameOver(score, { best: Math.max(...grid) });
  };

  const draw = (): void => {
    tilesG.clear();
    fxG.clear();
    grid.forEach((v, i) => {
      const x = i % N;
      const y = Math.floor(i / N);
      const px = gap + x * (cell + gap);
      const py = gap + y * (cell + gap);
      const label = labels[i] as Text;
      if (v === 0) {
        label.text = '';
        return;
      }
      const sc = cellScale[i] ?? 1;
      const off = ((sc - 1) * cell) / 2;
      tilesG.roundRect(px - off, py - off, cell * sc, cell * sc, 8).fill({ color: COLORS[v] ?? 0xedc22e });
      label.text = String(v);
      label.style.fill = v <= 4 ? 0xcadc9f : 0x101018;
      label.position.set(px + cell / 2, py + cell / 2);
    });
    // hammer highlight overlay
    if (hammerArmed) {
      fxG.roundRect(0, 0, boardSize, boardSize, 12).stroke({ width: 3, color: 0xff4d4d, alpha: 0.6 });
    }
    // particles
    for (const p of particles) fxG.circle(p.x, p.y, 3 * p.life).fill({ color: p.color, alpha: p.life });
  };

  const smash = (i: number): void => {
    if (grid[i] === 0) return;
    burst(i, 0xff4d4d, 12);
    grid[i] = 0;
    hammers--;
    hammerArmed = false;
    ctx.audio.sfx('explosion');
    setLabel();
    draw();
  };

  const handle = (a: Action | Dir): void => {
    if (over) return;
    if (a === 'up' || a === 'down' || a === 'left' || a === 'right') {
      if (hammerArmed) { hammerArmed = false; setLabel(); }
      move(a);
    } else if (a === 'b' || a === 'select') undo();
    else if (a === 'a' || a === 'start') {
      if (hammers > 0) {
        hammerArmed = !hammerArmed;
        ctx.audio.sfx('select');
        setLabel();
        draw();
      }
    }
  };
  const offDown = ctx.input.on('down', handle);
  const offSwipe = ctx.input.on('swipe', handle);
  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (over || !hammerArmed) return;
    // convert virtual coords to a board cell
    const lx = x - ox - gap;
    const ly = y - oy - gap;
    const cx = Math.floor(lx / (cell + gap));
    const cy = Math.floor(ly / (cell + gap));
    if (cx < 0 || cx >= N || cy < 0 || cy >= N) return;
    // ensure the tap is inside the tile (not the gap)
    if (lx - cx * (cell + gap) > cell || ly - cy * (cell + gap) > cell) return;
    smash(cy * N + cx);
  });

  spawn();
  spawn();
  draw();
  ctx.hud.setScore(0);
  setLabel();

  return {
    update(dt) {
      let needRedraw = false;
      // decay merge bounce scale back to 1
      for (let i = 0; i < N * N; i++) {
        if (cellScale[i]! > 1) {
          cellScale[i] = Math.max(1, cellScale[i]! - dt * 4);
          needRedraw = true;
        }
      }
      // particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt * 1.8;
        if (p.life <= 0) particles.splice(i, 1);
        needRedraw = true;
      }
      // popups float up and fade
      for (let i = popups.length - 1; i >= 0; i--) {
        const pu = popups[i]!;
        pu.life -= dt * 1.4;
        pu.t.y -= 30 * dt;
        pu.t.alpha = Math.max(0, pu.life);
        if (pu.life <= 0) {
          pu.t.destroy();
          popups.splice(i, 1);
        }
      }
      if (needRedraw) draw();
    },
    destroy() {
      offDown();
      offSwipe();
      offTap();
      layer.destroy({ children: true });
    },
  };
}
