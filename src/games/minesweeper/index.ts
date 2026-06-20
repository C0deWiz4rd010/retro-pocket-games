import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

const NUM_COLORS = [0x000000, 0x4a7bff, 0x3ddc84, 0xff4d4d, 0x9a5bff, 0xff7b00, 0x00c2c7, 0xeeeeee, 0x9aa0ff];

export default function createGame(ctx: GameContext): Game {
  const COLS = 9;
  const ROWS = 12;
  let MINES = 16;
  const cell = Math.floor(Math.min((ctx.width - 16) / COLS, (ctx.height - 40) / ROWS));
  const boardW = COLS * cell;
  const boardH = ROWS * cell;
  const ox = (ctx.width - boardW) / 2;
  const oy = (ctx.height - boardH) / 2;

  const layer = new Container();
  layer.position.set(ox, oy);
  ctx.stage.addChild(layer);
  const g = new Graphics();
  const fxG = new Graphics();
  layer.addChild(g, fxG);

  const mine = new Array(COLS * ROWS).fill(false);
  const revealed = new Array(COLS * ROWS).fill(false);
  const flagged = new Array(COLS * ROWS).fill(false);
  const adj = new Array(COLS * ROWS).fill(0);
  interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: number }
  const particles: Particle[] = [];
  let level = 1;
  let hints = 2; // Feature: safe-cell hints
  let score = 0;
  const labels: Text[] = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    const t = new Text({ text: '', style: { fontFamily: 'Inter, sans-serif', fontWeight: '800', fontSize: cell * 0.5 } });
    t.anchor.set(0.5);
    t.visible = false;
    labels.push(t);
    layer.addChild(t);
  }

  let placed = false;
  let flagMode = false;
  let over = false;
  let started = false;
  let elapsed = 0;
  let safeLeft = COLS * ROWS - MINES;
  const flaggedCount = (): number => flagged.filter(Boolean).length;
  const idx = (x: number, y: number): number => y * COLS + x;
  const inB = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < COLS && y < ROWS;

  const neighbors = (x: number, y: number): number[] => {
    const out: number[] = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if ((dx || dy) && inB(x + dx, y + dy)) out.push(idx(x + dx, y + dy));
    return out;
  };

  const place = (safeX: number, safeY: number): void => {
    const forbidden = new Set([idx(safeX, safeY), ...neighbors(safeX, safeY)]);
    let n = 0;
    while (n < MINES) {
      const i = ctx.rng.int(0, COLS * ROWS - 1);
      if (mine[i] || forbidden.has(i)) continue;
      mine[i] = true;
      n++;
    }
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        adj[idx(x, y)] = neighbors(x, y).filter((i) => mine[i]).length;
    placed = true;
  };

  const pop = (x: number, y: number, color: number, n = 5): void => {
    const cx = x * cell + cell / 2;
    const cy = y * cell + cell / 2;
    for (let k = 0; k < n; k++) {
      const a = ctx.rng.next() * Math.PI * 2;
      const s = 30 + ctx.rng.next() * 70;
      particles.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, color });
    }
  };

  const reveal = (x: number, y: number): void => {
    const i = idx(x, y);
    if (revealed[i] || flagged[i]) return;
    revealed[i] = true;
    if (mine[i]) {
      over = true;
      ctx.audio.sfx('explosion');
      for (let j = 0; j < mine.length; j++) if (mine[j]) revealed[j] = true;
      draw();
      ctx.gameOver(score, { level });
      return;
    }
    safeLeft--;
    score += 5 * level; // Feature: live scoring
    ctx.hud.setScore(score);
    pop(x, y, 0x3ddc84, 3);
    if (adj[i] === 0) for (const n of neighbors(x, y)) reveal(n % COLS, Math.floor(n / COLS));
  };

  const useHint = (): void => {
    if (over || hints <= 0 || !placed) return;
    const safe: number[] = [];
    for (let i = 0; i < COLS * ROWS; i++) if (!mine[i] && !revealed[i] && !flagged[i]) safe.push(i);
    if (!safe.length) return;
    const pick = safe[Math.floor(ctx.rng.next() * safe.length)]!;
    hints--;
    reveal(pick % COLS, Math.floor(pick / COLS));
    ctx.hud.toast(`HINT (${hints} left)`);
    ctx.audio.sfx('powerup');
    winCheck();
    draw();
  };

  const nextLevel = (): void => {
    level++;
    MINES = Math.min(COLS * ROWS - 12, MINES + 4);
    mine.fill(false);
    revealed.fill(false);
    flagged.fill(false);
    adj.fill(0);
    placed = false;
    over = false;
    started = false;
    elapsed = 0;
    safeLeft = COLS * ROWS - MINES;
    hints = Math.min(3, hints + 1);
    score += 200;
    ctx.hud.setScore(score);
    ctx.hud.toast(`LEVEL ${level} · ${MINES} MINES`);
    ctx.audio.sfx('levelup');
    updateLabel();
    draw();
  };

  const chord = (x: number, y: number): void => {
    const i = idx(x, y);
    if (!revealed[i] || adj[i] === 0) return;
    const ns = neighbors(x, y);
    const flags = ns.filter((n) => flagged[n]).length;
    if (flags !== adj[i]) return;
    for (const n of ns) if (!flagged[n] && !revealed[n]) reveal(n % COLS, Math.floor(n / COLS));
  };

  const winCheck = (): void => {
    if (!over && safeLeft <= 0) {
      // time bonus for a fast clear, then advance to a harder board
      score += Math.max(0, 300 - Math.floor(elapsed) * 3);
      ctx.hud.setScore(score);
      ctx.audio.sfx('powerup');
      ctx.hud.toast('CLEARED!');
      for (let i = 0; i < COLS * ROWS; i++) if (!mine[i]) pop(i % COLS, Math.floor(i / COLS), 0xffd200, 2);
      nextLevel();
    }
  };

  const click = (vx: number, vy: number): void => {
    if (over) return;
    const x = Math.floor((vx - ox) / cell);
    const y = Math.floor((vy - oy) / cell);
    if (!inB(x, y)) return;
    started = true;
    const i = idx(x, y);
    if (flagMode) {
      if (!revealed[i]) {
        flagged[i] = !flagged[i];
        updateLabel();
        ctx.audio.sfx('blip');
      }
    } else {
      if (flagged[i]) return;
      if (revealed[i]) {
        chord(x, y);
        winCheck();
        draw();
        return;
      }
      if (!placed) place(x, y);
      reveal(x, y);
      ctx.audio.sfx('eat');
    }
    winCheck();
    draw();
  };

  const updateLabel = (): void => {
    const left = MINES - flaggedCount();
    ctx.hud.setLabel(`${flagMode ? '🚩' : '⛏'} ${left} • L${level} • 💡${hints} • ${Math.floor(elapsed)}s`);
  };

  const setMode = (m: boolean): void => {
    flagMode = m;
    updateLabel();
  };

  const offTap = ctx.input.on('tap', ({ x, y }) => click(x, y));
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a' || a === 'b') {
      setMode(!flagMode);
      ctx.audio.sfx('select');
    } else if (a === 'start' || a === 'select') {
      useHint();
    }
  });

  const draw = (): void => {
    g.clear();
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        const i = idx(x, y);
        const px = x * cell;
        const py = y * cell;
        const lbl = labels[i]!;
        lbl.visible = false;
        if (revealed[i]) {
          g.rect(px, py, cell - 1, cell - 1).fill({ color: mine[i] ? 0xff4d4d : 0x14141f });
          if (mine[i]) {
            lbl.text = '💣';
            lbl.style.fontSize = cell * 0.5;
            lbl.position.set(px + cell / 2, py + cell / 2);
            lbl.visible = true;
          } else if (adj[i] > 0) {
            lbl.text = String(adj[i]);
            lbl.style.fill = NUM_COLORS[adj[i]] ?? 0xffffff;
            lbl.position.set(px + cell / 2, py + cell / 2);
            lbl.visible = true;
          }
        } else {
          g.roundRect(px + 1, py + 1, cell - 2, cell - 2, 3).fill({ color: 0x2b2b40 });
          if (flagged[i]) {
            lbl.text = '🚩';
            lbl.style.fontSize = cell * 0.5;
            lbl.position.set(px + cell / 2, py + cell / 2);
            lbl.visible = true;
          }
        }
      }
    fxG.clear();
    for (const p of particles) fxG.circle(p.x, p.y, 3 * Math.min(1, p.life * 2)).fill({ color: p.color, alpha: Math.min(1, p.life * 2) });
  };

  setMode(false);
  ctx.hud.setScore(0);
  ctx.hud.setLabel('TAP=DIG · A=FLAG · START=HINT');
  draw();

  let labelAcc = 0;
  return {
    update(dt) {
      // particles always animate
      let dirty = false;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
        dirty = true;
      }
      if (dirty) {
        fxG.clear();
        for (const p of particles) fxG.circle(p.x, p.y, 3 * Math.min(1, p.life * 2)).fill({ color: p.color, alpha: Math.min(1, p.life * 2) });
      }
      if (over || !started) return;
      elapsed += dt;
      labelAcc += dt;
      if (labelAcc >= 0.25) {
        labelAcc = 0;
        updateLabel();
      }
    },
    destroy() {
      offTap();
      offDown();
      layer.destroy({ children: true });
    },
  };
}
