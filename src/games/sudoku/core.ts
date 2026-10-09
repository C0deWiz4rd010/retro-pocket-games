import type { RNG } from '@utils/rng';

export const N = 9;
export const BOX = 3;
export type Grid = number[][];

const ALL = 0x3fe; // bits 1..9

const boxOf = (r: number, c: number): number => Math.floor(r / BOX) * BOX + Math.floor(c / BOX);
const popcount = (m: number): number => {
  let n = 0;
  for (let x = m; x; x &= x - 1) n++;
  return n;
};

/**
 * Count solutions of a (possibly partial) grid, stopping at `limit`. Bitmask backtracking that
 * always branches on the empty cell with the fewest candidates, so even sparse puzzles resolve
 * in well under a millisecond or two. Used to guarantee generated puzzles are uniquely solvable.
 */
export function countSolutions(puzzle: Grid, limit = 2): number {
  const cells = new Int8Array(N * N);
  const rows = new Int16Array(N);
  const cols = new Int16Array(N);
  const boxes = new Int16Array(N);
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const v = puzzle[r]![c]!;
      cells[r * N + c] = v;
      if (v) {
        const bit = 1 << v;
        if (rows[r]! & bit || cols[c]! & bit || boxes[boxOf(r, c)]! & bit) return 0; // invalid
        rows[r]! |= bit;
        cols[c]! |= bit;
        boxes[boxOf(r, c)]! |= bit;
      }
    }

  let found = 0;
  const solve = (): void => {
    // pick the most constrained empty cell
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < N * N; i++) {
      if (cells[i]) continue;
      const r = Math.floor(i / N);
      const c = i % N;
      const mask = ALL & ~(rows[r]! | cols[c]! | boxes[boxOf(r, c)]!);
      const n = popcount(mask);
      if (n < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = n;
        if (n <= 1) break;
      }
    }
    if (best === -1) {
      found++;
      return;
    }
    if (bestCount === 0) return;
    const r = Math.floor(best / N);
    const c = best % N;
    const b = boxOf(r, c);
    for (let v = 1; v <= 9 && found < limit; v++) {
      const bit = 1 << v;
      if (!(bestMask & bit)) continue;
      cells[best] = v;
      rows[r]! |= bit;
      cols[c]! |= bit;
      boxes[b]! |= bit;
      solve();
      cells[best] = 0;
      rows[r]! &= ~bit;
      cols[c]! &= ~bit;
      boxes[b]! &= ~bit;
    }
  };
  solve();
  return found;
}

/** A full valid grid, randomised through the seeded RNG. */
export function generateSolved(rng: RNG): Grid {
  const grid: Grid = Array.from({ length: N }, () => new Array<number>(N).fill(0));
  const rows = Array.from({ length: N }, () => new Set<number>());
  const cols = Array.from({ length: N }, () => new Set<number>());
  const boxes = Array.from({ length: N }, () => new Set<number>());

  const fill = (pos: number): boolean => {
    if (pos === N * N) return true;
    const r = Math.floor(pos / N);
    const c = pos % N;
    const bi = boxOf(r, c);
    for (const n of rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (rows[r]!.has(n) || cols[c]!.has(n) || boxes[bi]!.has(n)) continue;
      grid[r]![c] = n;
      rows[r]!.add(n);
      cols[c]!.add(n);
      boxes[bi]!.add(n);
      if (fill(pos + 1)) return true;
      grid[r]![c] = 0;
      rows[r]!.delete(n);
      cols[c]!.delete(n);
      boxes[bi]!.delete(n);
    }
    return false;
  };
  fill(0);
  return grid;
}

/**
 * Dig holes in a solved grid, keeping a hole only if the puzzle stays uniquely solvable, until
 * `removeTarget` cells are blank (or no more can be removed). So every entry that matches the
 * stored solution is a legitimate answer and nothing else can be.
 */
export function makePuzzle(
  rng: RNG,
  solved: Grid,
  removeTarget: number,
): { puzzle: Grid; removed: number } {
  const puzzle = solved.map((row) => [...row]);
  let removed = 0;
  for (const pos of rng.shuffle(Array.from({ length: N * N }, (_, i) => i))) {
    if (removed >= removeTarget) break;
    const r = Math.floor(pos / N);
    const c = pos % N;
    const v = puzzle[r]![c]!;
    puzzle[r]![c] = 0;
    if (countSolutions(puzzle, 2) === 1) removed++;
    else puzzle[r]![c] = v;
  }
  return { puzzle, removed };
}
