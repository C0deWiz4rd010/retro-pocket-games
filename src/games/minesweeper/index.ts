import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

const NUM_COLORS = [0x000000, 0x4a7bff, 0x3ddc84, 0xff4d4d, 0x9a5bff, 0xff7b00, 0x00c2c7, 0xeeeeee, 0x9aa0ff];

export default function createGame(ctx: GameContext): Game {
  const COLS = 9;
  const ROWS = 12;
  const MINES = 16;
  const cell = Math.floor(Math.min((ctx.width - 16) / COLS, (ctx.height - 40) / ROWS));
  const boardW = COLS * cell;
  const boardH = ROWS * cell;
  const ox = (ctx.width - boardW) / 2;
  const oy = (ctx.height - boardH) / 2;

  const layer = new Container();
  layer.position.set(ox, oy);
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const mine = new Array(COLS * ROWS).fill(false);
  const revealed = new Array(COLS * ROWS).fill(false);
  const flagged = new Array(COLS * ROWS).fill(false);
  const adj = new Array(COLS * ROWS).fill(0);
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

  const reveal = (x: number, y: number): void => {
    const i = idx(x, y);
    if (revealed[i] || flagged[i]) return;
    revealed[i] = true;
    if (mine[i]) {
      over = true;
      ctx.audio.sfx('explosion');
      for (let j = 0; j < mine.length; j++) if (mine[j]) revealed[j] = true;
      draw();
      ctx.gameOver(Math.max(0, (COLS * ROWS - MINES - safeLeft) * 10), {});
      return;
    }
    safeLeft--;
    if (adj[i] === 0) for (const n of neighbors(x, y)) reveal(n % COLS, Math.floor(n / COLS));
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
      over = true;
      ctx.audio.sfx('powerup');
      ctx.hud.toast('CLEARED!');
      ctx.gameOver(1000 + Math.max(0, 300 - Math.floor(elapsed) * 3), { cleared: 1 });
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
    ctx.hud.setLabel(`${flagMode ? '🚩' : '⛏'} ${left} • ${Math.floor(elapsed)}s`);
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
  };

  setMode(false);
  ctx.hud.setScore(0);
  draw();

  let labelAcc = 0;
  return {
    update(dt) {
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
