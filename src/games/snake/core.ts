import type { RNG } from '@utils/rng';

export interface Vec {
  x: number;
  y: number;
}

export interface SnakeState {
  cols: number;
  rows: number;
  body: Vec[]; // head first
  dir: Vec;
  nextDir: Vec;
  food: Vec;
  score: number;
  alive: boolean;
  grow: number;
}

export type StepResult = 'move' | 'eat' | 'dead';

export function createSnake(cols: number, rows: number, rng: RNG): SnakeState {
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);
  const body = [
    { x: cx, y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ];
  const state: SnakeState = {
    cols,
    rows,
    body,
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    food: { x: 0, y: 0 },
    score: 0,
    alive: true,
    grow: 0,
  };
  state.food = spawnFood(state, rng);
  return state;
}

/** Queue a direction; ignores 180° reversals. */
export function setDir(s: SnakeState, dir: Vec): void {
  if (dir.x === -s.dir.x && dir.y === -s.dir.y) return;
  if (dir.x === 0 && dir.y === 0) return;
  s.nextDir = dir;
}

export function spawnFood(s: SnakeState, rng: RNG): Vec {
  const free: Vec[] = [];
  for (let y = 0; y < s.rows; y++) {
    for (let x = 0; x < s.cols; x++) {
      if (!s.body.some((b) => b.x === x && b.y === y)) free.push({ x, y });
    }
  }
  return free.length ? (rng.pick(free) as Vec) : { x: 0, y: 0 };
}

/** Advance one tick. Returns what happened. */
export function step(s: SnakeState, rng: RNG): StepResult {
  if (!s.alive) return 'dead';
  s.dir = s.nextDir;
  const head = s.body[0] as Vec;
  const nx = head.x + s.dir.x;
  const ny = head.y + s.dir.y;

  if (nx < 0 || ny < 0 || nx >= s.cols || ny >= s.rows) {
    s.alive = false;
    return 'dead';
  }
  // self collision (tail tip moves away unless growing — but classic uses full body)
  if (s.body.some((b, i) => i < s.body.length - 1 && b.x === nx && b.y === ny)) {
    s.alive = false;
    return 'dead';
  }

  s.body.unshift({ x: nx, y: ny });
  if (nx === s.food.x && ny === s.food.y) {
    s.score += 10;
    s.grow += 2;
    s.food = spawnFood(s, rng);
    return 'eat';
  }
  if (s.grow > 0) s.grow--;
  else s.body.pop();
  return 'move';
}
