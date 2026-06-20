import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action, Dir } from '@core/InputManager';

// Hand-made levels. # wall, . goal, $ box, * box-on-goal, @ player, + player-on-goal
const LEVELS = [
  ['#######', '#.    #', '# $$  #', '# @   #', '#  ..##', '#######'],
  ['########', '#  .   #', '# $## $#', '# @  . #', '#  $.  #', '#   .  #', '########'],
  ['#######', '#.  . #', '# $$$ #', '# . @ #', '#  $. #', '#######'],
];

const DIRS: Record<string, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export default function createGame(ctx: GameContext): Game {
  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  let levelIdx = 0;
  let walls: boolean[][] = [];
  let goals: boolean[][] = [];
  let boxes: boolean[][] = [];
  let px = 0;
  let py = 0;
  let cols = 0;
  let rows = 0;
  let cell = 0;
  let ox = 0;
  let oy = 0;
  let totalPushes = 0;
  let steps = 0;
  let over = false;
  // Feature: undo history (snapshots of box layout + player + counters)
  const history: { boxes: boolean[][]; px: number; py: number; pushes: number; steps: number }[] = [];

  const load = (li: number): void => {
    const map = LEVELS[li]!;
    rows = map.length;
    cols = Math.max(...map.map((r) => r.length));
    cell = Math.floor(Math.min(ctx.width / cols, (ctx.height - 40) / rows));
    ox = (ctx.width - cols * cell) / 2;
    oy = (ctx.height - rows * cell) / 2;
    walls = [];
    goals = [];
    boxes = [];
    for (let r = 0; r < rows; r++) {
      walls[r] = [];
      goals[r] = [];
      boxes[r] = [];
      for (let c = 0; c < cols; c++) {
        const ch = map[r]![c] ?? ' ';
        walls[r]![c] = ch === '#';
        goals[r]![c] = ch === '.' || ch === '*' || ch === '+';
        boxes[r]![c] = ch === '$' || ch === '*';
        if (ch === '@' || ch === '+') {
          px = c;
          py = r;
        }
      }
    }
  };
  load(0);

  ctx.hud.setScore(0);

  const solved = (): boolean => {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (boxes[r]![c] && !goals[r]![c]) return false;
    return true;
  };
  const progress = (): { on: number; total: number } => {
    let on = 0, total = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (goals[r]![c]) total++;
      if (boxes[r]![c] && goals[r]![c]) on++;
    }
    return { on, total };
  };
  const setLabel = (): void => {
    const p = progress();
    ctx.hud.setLabel(`L${levelIdx + 1} · ${p.on}/${p.total} · ${steps} steps`);
  };
  setLabel();

  const snapshot = (): void => {
    history.push({ boxes: boxes.map((row) => row.slice()), px, py, pushes: totalPushes, steps });
    if (history.length > 200) history.shift();
  };

  const move = (a: Action | Dir): void => {
    if (over) return;
    const d = DIRS[a];
    if (!d) return;
    const nx = px + d.x;
    const ny = py + d.y;
    if (walls[ny]?.[nx]) return;
    if (boxes[ny]?.[nx]) {
      const bx = nx + d.x;
      const by = ny + d.y;
      if (walls[by]?.[bx] || boxes[by]?.[bx]) return;
      snapshot();
      boxes[ny]![nx] = false;
      boxes[by]![bx] = true;
      totalPushes++;
      ctx.audio.sfx('blip');
    } else {
      snapshot();
    }
    px = nx;
    py = ny;
    steps++;
    setLabel();
    draw();
    if (solved()) {
      ctx.audio.sfx('levelup');
      if (levelIdx < LEVELS.length - 1) {
        levelIdx++;
        ctx.hud.toast(`LEVEL ${levelIdx + 1}`);
        load(levelIdx);
        history.length = 0;
        setLabel();
        draw();
      } else {
        over = true;
        ctx.hud.toast('ALL CLEAR!');
        ctx.gameOver(Math.max(100, 3000 - totalPushes * 20 - steps * 2), { pushes: totalPushes });
      }
    }
  };

  // Feature: undo last move
  const undo = (): void => {
    if (over || !history.length) return;
    const s = history.pop()!;
    boxes = s.boxes;
    px = s.px;
    py = s.py;
    totalPushes = s.pushes;
    steps = s.steps;
    ctx.audio.sfx('select');
    setLabel();
    draw();
  };
  // Feature: restart the current level
  const restart = (): void => {
    if (over) return;
    load(levelIdx);
    history.length = 0;
    steps = 0;
    totalPushes = 0;
    ctx.audio.sfx('blip');
    setLabel();
    draw();
  };

  const onDown = (a: Action | Dir): void => {
    if (a === 'b' || a === 'select') undo();
    else if (a === 'start') restart();
    else move(a);
  };
  const offDown = ctx.input.on('down', onDown);
  const offSwipe = ctx.input.on('swipe', move);

  function draw(): void {
    g.clear();
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const x = ox + c * cell;
        const y = oy + r * cell;
        if (walls[r]![c]) g.rect(x, y, cell, cell).fill({ color: 0x4a4a5a });
        else g.rect(x, y, cell, cell).fill({ color: 0x14141f });
        if (goals[r]![c]) g.circle(x + cell / 2, y + cell / 2, cell * 0.16).fill({ color: 0x3ddc84 });
        if (boxes[r]![c])
          g.roundRect(x + 4, y + 4, cell - 8, cell - 8, 4).fill({ color: goals[r]![c] ? 0x3ddc84 : 0xa1887f });
      }
    g.circle(ox + px * cell + cell / 2, oy + py * cell + cell / 2, cell * 0.34).fill({ color: 0x00f7ff });
  }
  draw();

  return {
    update() {},
    destroy() {
      offDown();
      offSwipe();
      layer.destroy({ children: true });
    },
  };
}
