import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

const N = 9;
const BOX = 3;

/** Generate a full valid Sudoku grid using constraint-based fill + backtrack. */
function generateFull(rng: { next(): number; shuffle<T>(a: T[]): T[] }): number[][] {
  const grid: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
  const rows = Array.from({ length: N }, () => new Set<number>());
  const cols = Array.from({ length: N }, () => new Set<number>());
  const boxes = Array.from({ length: N }, () => new Set<number>());
  const boxIdx = (r: number, c: number): number => Math.floor(r / BOX) * BOX + Math.floor(c / BOX);

  const fill = (pos: number): boolean => {
    if (pos === N * N) return true;
    const r = Math.floor(pos / N);
    const c = pos % N;
    const bi = boxIdx(r, c);
    const nums = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const n of nums) {
      if (!rows[r]!.has(n) && !cols[c]!.has(n) && !boxes[bi]!.has(n)) {
        grid[r]![c] = n;
        rows[r]!.add(n); cols[c]!.add(n); boxes[bi]!.add(n);
        if (fill(pos + 1)) return true;
        grid[r]![c] = 0;
        rows[r]!.delete(n); cols[c]!.delete(n); boxes[bi]!.delete(n);
      }
    }
    return false;
  };
  fill(0);
  return grid;
}

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const pad = 12;
  const boardSize = Math.min(W, H) - pad * 2;
  const cell = Math.floor(boardSize / N);
  const gw = cell * N;
  const ox = (W - gw) / 2;
  const oy = (H - gw) / 2;

  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);
  const labels: Text[] = [];
  for (let i = 0; i < N * N; i++) {
    const t = new Text({ text: '', style: { fontFamily: 'VT323, monospace', fontSize: cell * 0.58, fill: 0xffffff } });
    t.anchor.set(0.5);
    labels.push(t);
    layer.addChild(t);
  }
  // number picker row at bottom
  const pickerLabels: Text[] = [];
  for (let n = 1; n <= 9; n++) {
    const t = new Text({ text: String(n), style: { fontFamily: 'VT323, monospace', fontSize: cell * 0.7, fill: 0xffd200 } });
    t.anchor.set(0.5);
    pickerLabels.push(t);
    layer.addChild(t);
  }
  const eraseLabel = new Text({ text: 'X', style: { fontFamily: 'VT323, monospace', fontSize: cell * 0.6, fill: 0xff4d4d } });
  eraseLabel.anchor.set(0.5);
  layer.addChild(eraseLabel);

  const solution = generateFull(ctx.rng);
  const given: boolean[][] = Array.from({ length: N }, () => new Array(N).fill(false));
  const userGrid: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));

  // remove cells to create puzzle (difficulty: ~35 clues)
  const removals = ctx.rng.shuffle(Array.from({ length: N * N }, (_, i) => i));
  let removed = 0;
  const target = 46; // cells to remove = 46 → 35 clues
  for (const pos of removals) {
    if (removed >= target) break;
    const r = Math.floor(pos / N);
    const c = pos % N;
    given[r]![c] = false;
    userGrid[r]![c] = 0;
    removed++;
  }
  // mark remaining as given
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      if (userGrid[r]![c] !== 0 || solution[r]![c] !== 0) {
        if (!removals.slice(0, removed).includes(r * N + c)) {
          given[r]![c] = true;
          userGrid[r]![c] = solution[r]![c]!;
        }
      }
    }

  let sel: { r: number; c: number } | null = null;
  let selectedNum = 0;
  let over = false;
  let mistakes = 0;
  const startTime = performance.now();

  ctx.hud.setScore(0);
  ctx.hud.setLabel('TAP CELL → NUMBER');

  const pickerY = oy + gw + cell * 0.8;
  const pickerCellW = gw / 10;

  const draw = (): void => {
    g.clear();
    // board background
    g.roundRect(ox, oy, gw, gw, 4).fill({ color: 0x12122a });

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const x = ox + c * cell;
        const y = oy + r * cell;
        const i = r * N + c;
        const isGiven = given[r]![c];
        const isSel = sel?.r === r && sel?.c === c;
        const isRelated = sel && (sel.r === r || sel.c === c || (Math.floor(sel.r / BOX) === Math.floor(r / BOX) && Math.floor(sel.c / BOX) === Math.floor(c / BOX)));
        const val = userGrid[r]![c];
        const wrong = val !== 0 && !isGiven && val !== solution[r]![c];

        let bg = 0x12122a;
        if (isRelated) bg = 0x1e1e3c;
        if (isSel) bg = 0x2e2e6e;

        g.roundRect(x + 1, y + 1, cell - 2, cell - 2, 2).fill({ color: bg });

        const label = labels[i]!;
        label.text = val ? String(val) : '';
        label.style.fill = wrong ? 0xff4d4d : isGiven ? 0x9bffce : 0xffffff;
        label.style.fontSize = cell * 0.58;
        label.position.set(x + cell / 2, y + cell / 2);
      }
    }

    // box borders (thick)
    for (let b = 0; b <= BOX; b++) {
      g.rect(ox + b * cell * BOX, oy, 2, gw).fill({ color: 0x4466aa });
      g.rect(ox, oy + b * cell * BOX, gw, 2).fill({ color: 0x4466aa });
    }
    // cell grid lines (thin)
    for (let i = 1; i < N; i++) {
      if (i % BOX !== 0) {
        g.rect(ox + i * cell, oy, 1, gw).fill({ color: 0x2b2b50, alpha: 0.6 });
        g.rect(ox, oy + i * cell, gw, 1).fill({ color: 0x2b2b50, alpha: 0.6 });
      }
    }

    // number picker
    for (let n = 1; n <= 9; n++) {
      const px = ox + (n - 1) * pickerCellW + pickerCellW / 2;
      const isActive = selectedNum === n;
      g.roundRect(ox + (n - 1) * pickerCellW + 2, pickerY - cell * 0.4, pickerCellW - 4, cell * 0.8, 4)
        .fill({ color: isActive ? 0x3344aa : 0x1d1d40 });
      pickerLabels[n - 1]!.position.set(px, pickerY);
    }
    // erase button
    const ex = ox + 9 * pickerCellW + pickerCellW / 2;
    g.roundRect(ox + 9 * pickerCellW + 2, pickerY - cell * 0.4, pickerCellW - 4, cell * 0.8, 4)
      .fill({ color: selectedNum === -1 ? 0x661111 : 0x1d1d40 });
    eraseLabel.position.set(ex, pickerY);
  };

  const checkSolved = (): boolean => {
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++)
        if (userGrid[r]![c] !== solution[r]![c]) return false;
    return true;
  };

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (over) return;
    // tap on picker
    if (y > pickerY - cell * 0.5 && y < pickerY + cell * 0.5) {
      const pi = Math.floor((x - ox) / pickerCellW);
      if (pi >= 0 && pi <= 8) { selectedNum = pi + 1; draw(); return; }
      if (pi === 9) { selectedNum = -1; draw(); return; }
    }
    // tap on grid
    const c = Math.floor((x - ox) / cell);
    const r = Math.floor((y - oy) / cell);
    if (c >= 0 && c < N && r >= 0 && r < N) {
      if (selectedNum !== 0 && !given[r]![c]) {
        if (selectedNum === -1) {
          userGrid[r]![c] = 0;
        } else {
          const prev = userGrid[r]![c];
          userGrid[r]![c] = selectedNum;
          if (selectedNum !== solution[r]![c]) {
            if (prev !== selectedNum) {
              mistakes++;
              ctx.audio.sfx('hit');
              ctx.hud.setLabel(`MISTAKES ${mistakes}`);
            }
          } else {
            ctx.audio.sfx('eat');
          }
        }
        if (checkSolved()) {
          over = true;
          const elapsed = Math.round((performance.now() - startTime) / 1000);
          const timeBonus = Math.max(0, 600 - elapsed) * 10;
          const penaltyScore = Math.max(0, 5000 - mistakes * 200 + timeBonus);
          ctx.audio.sfx('powerup');
          ctx.hud.toast('SOLVED!');
          draw();
          ctx.gameOver(penaltyScore, { mistakes, seconds: elapsed });
          return;
        }
      } else {
        sel = { r, c };
      }
      draw();
    }
  });

  draw();

  return {
    update() {
      if (over) return;
      const elapsed = Math.round((performance.now() - startTime) / 1000);
      ctx.hud.setScore(elapsed);
    },
    destroy() {
      offTap();
      layer.destroy({ children: true });
    },
  };
}
