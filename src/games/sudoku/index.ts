import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import { BOX, N, generateSolved, makePuzzle } from './core';
import { PIXEL_FONT } from '@kits/arcade/constants';

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
    const t = new Text({
      text: '',
      style: { fontFamily: PIXEL_FONT, fontSize: cell * 0.58, fill: 0xffffff },
    });
    t.anchor.set(0.5);
    labels.push(t);
    layer.addChild(t);
  }
  // number picker row at bottom
  const pickerLabels: Text[] = [];
  for (let n = 1; n <= 9; n++) {
    const t = new Text({
      text: String(n),
      style: { fontFamily: PIXEL_FONT, fontSize: cell * 0.7, fill: 0xffd200 },
    });
    t.anchor.set(0.5);
    pickerLabels.push(t);
    layer.addChild(t);
  }
  const eraseLabel = new Text({
    text: 'X',
    style: { fontFamily: PIXEL_FONT, fontSize: cell * 0.6, fill: 0xff4d4d },
  });
  eraseLabel.anchor.set(0.5);
  layer.addChild(eraseLabel);

  const timeText = new Text({
    text: '0:00',
    style: { fontFamily: PIXEL_FONT, fontSize: cell * 0.6, fill: 0x9bffce },
  });
  timeText.anchor.set(0.5);
  timeText.position.set(ox + gw / 2, Math.max(cell * 0.5, oy - cell * 0.6));
  layer.addChild(timeText);

  const solution = generateSolved(ctx.rng);
  // ~35 clues; makePuzzle only digs holes that keep the puzzle uniquely solvable.
  const { puzzle } = makePuzzle(ctx.rng, solution, 46);
  const given: boolean[][] = puzzle.map((row) => row.map((v) => v !== 0));
  const userGrid: number[][] = puzzle.map((row) => [...row]);

  let sel: { r: number; c: number } | null = null;
  let selectedNum = 0;
  let over = false;
  let mistakes = 0;
  let hints = 3; // Feature: hint power-up
  const MAX_MISTAKES = 3; // Feature: three-strikes limit
  const startTime = ctx.timers.now() * 1000;

  const correctCount = (): number => {
    let n = 0;
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) if (!given[r]![c] && userGrid[r]![c] === solution[r]![c]) n++;
    return n;
  };
  ctx.hud.setScore(0);
  const setLabel = (): void => ctx.hud.setLabel(`✗ ${mistakes}/${MAX_MISTAKES} · 💡${hints}`);
  setLabel();

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
        const isRelated =
          sel &&
          (sel.r === r ||
            sel.c === c ||
            (Math.floor(sel.r / BOX) === Math.floor(r / BOX) &&
              Math.floor(sel.c / BOX) === Math.floor(c / BOX)));
        const val = userGrid[r]![c];
        const wrong = val !== 0 && !isGiven && val !== solution[r]![c];
        // Feature: highlight every cell holding the same number as the selection
        const selVal = sel ? userGrid[sel.r]![sel.c] : 0;
        const sameNum = selVal !== 0 && val === selVal;

        let bg = 0x12122a;
        if (isRelated) bg = 0x1e1e3c;
        if (sameNum) bg = 0x244a3a;
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
      g.roundRect(
        ox + (n - 1) * pickerCellW + 2,
        pickerY - cell * 0.4,
        pickerCellW - 4,
        cell * 0.8,
        4,
      ).fill({ color: isActive ? 0x3344aa : 0x1d1d40 });
      pickerLabels[n - 1]!.position.set(px, pickerY);
    }
    // erase button
    const ex = ox + 9 * pickerCellW + pickerCellW / 2;
    g.roundRect(
      ox + 9 * pickerCellW + 2,
      pickerY - cell * 0.4,
      pickerCellW - 4,
      cell * 0.8,
      4,
    ).fill({ color: selectedNum === -1 ? 0x661111 : 0x1d1d40 });
    eraseLabel.position.set(ex, pickerY);
  };

  const checkSolved = (): boolean => {
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) if (userGrid[r]![c] !== solution[r]![c]) return false;
    return true;
  };

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (over) return;
    // tap on picker
    if (y > pickerY - cell * 0.5 && y < pickerY + cell * 0.5) {
      const pi = Math.floor((x - ox) / pickerCellW);
      if (pi >= 0 && pi <= 8) {
        selectedNum = pi + 1;
        draw();
        return;
      }
      if (pi === 9) {
        selectedNum = -1;
        draw();
        return;
      }
    }
    // tap on grid
    const c = Math.floor((x - ox) / cell);
    const r = Math.floor((y - oy) / cell);
    if (c >= 0 && c < N && r >= 0 && r < N) {
      if (selectedNum !== 0 && !given[r]![c]) {
        place(r, c);
        if (over) return;
      } else {
        sel = { r, c };
      }
      draw();
    }
  });

  const finishIfSolved = (): void => {
    if (!checkSolved()) return;
    over = true;
    const elapsed = Math.round((ctx.timers.now() * 1000 - startTime) / 1000);
    const timeBonus = Math.max(0, 600 - elapsed) * 10;
    ctx.audio.sfx('powerup');
    ctx.hud.toast('SOLVED!');
    draw();
    ctx.gameOver(Math.max(0, 5000 - mistakes * 200 + timeBonus + hints * 150), {
      mistakes,
      seconds: elapsed,
    });
  };

  const useHint = (): void => {
    if (over || hints <= 0) return;
    // fill the selected empty/wrong cell, else the first incorrect cell
    let target: { r: number; c: number } | null = null;
    if (sel && !given[sel.r]![sel.c] && userGrid[sel.r]![sel.c] !== solution[sel.r]![sel.c])
      target = sel;
    if (!target) {
      outer: for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++)
          if (!given[r]![c] && userGrid[r]![c] !== solution[r]![c]) {
            target = { r, c };
            break outer;
          }
    }
    if (!target) return;
    hints--;
    userGrid[target.r]![target.c] = solution[target.r]![target.c]!;
    given[target.r]![target.c] = true; // lock the revealed cell
    ctx.audio.sfx('powerup');
    ctx.hud.toast(`HINT (${hints})`);
    setLabel();
    draw();
    finishIfSolved();
  };
  const place = (r: number, c: number): void => {
    if (selectedNum === 0 || given[r]![c]) return;
    if (selectedNum === -1) {
      userGrid[r]![c] = 0;
    } else {
      const prev = userGrid[r]![c];
      userGrid[r]![c] = selectedNum;
      if (selectedNum !== solution[r]![c]) {
        if (prev !== selectedNum) {
          mistakes++;
          ctx.audio.sfx('hit');
          setLabel();
          if (mistakes >= MAX_MISTAKES) {
            over = true;
            ctx.audio.sfx('gameover');
            ctx.hud.toast('THREE STRIKES!');
            draw();
            ctx.gameOver(0, { mistakes });
            return;
          }
        }
      } else {
        ctx.audio.sfx('eat');
      }
    }
    finishIfSolved();
  };

  // Keyboard / gamepad: D-pad moves the cursor, A places the picked number, B cycles the picked
  // number (1-9, erase), Enter/Select asks for a hint.
  const offDown = ctx.input.on('down', (a) => {
    if (over) return;
    if (a === 'start' || a === 'select') {
      useHint();
      return;
    }
    if (a === 'up' || a === 'down' || a === 'left' || a === 'right') {
      const cur = sel ?? { r: 4, c: 4 };
      const dr = a === 'down' ? 1 : a === 'up' ? -1 : 0;
      const dc = a === 'right' ? 1 : a === 'left' ? -1 : 0;
      sel = { r: (cur.r + dr + N) % N, c: (cur.c + dc + N) % N };
    } else if (a === 'b') {
      selectedNum = selectedNum === -1 ? 1 : selectedNum === 9 ? -1 : selectedNum + 1;
    } else if (a === 'a') {
      if (!sel) sel = { r: 4, c: 4 };
      place(sel.r, sel.c);
    } else return;
    if (!over) draw();
  });

  draw();

  return {
    update() {
      if (over) return;
      // HUD score = cells you solved yourself; the clock lives on the board so the HUD doesn't
      // pulse every second.
      ctx.hud.setScore(correctCount() * 10);
      const elapsed = Math.floor((ctx.timers.now() * 1000 - startTime) / 1000);
      const text = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
      if (timeText.text !== text) timeText.text = text;
    },
    destroy() {
      offTap();
      offDown();
      layer.destroy({ children: true });
    },
  };
}
