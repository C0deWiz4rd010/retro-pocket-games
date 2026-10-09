import { describe, expect, it } from 'vitest';
import { RNG } from '@utils/rng';
import { BOX, N, countSolutions, generateSolved, makePuzzle, type Grid } from './core';

const valid = (g: Grid): boolean => {
  const ok = (cells: number[]): boolean =>
    new Set(cells).size === N && cells.every((v) => v >= 1 && v <= 9);
  for (let i = 0; i < N; i++) {
    if (!ok(g[i]!)) return false;
    if (!ok(g.map((row) => row[i]!))) return false;
  }
  for (let br = 0; br < N; br += BOX)
    for (let bc = 0; bc < N; bc += BOX) {
      const cells: number[] = [];
      for (let r = 0; r < BOX; r++) for (let c = 0; c < BOX; c++) cells.push(g[br + r]![bc + c]!);
      if (!ok(cells)) return false;
    }
  return true;
};

describe('sudoku core', () => {
  it('generates valid solved grids', () => {
    for (const seed of [1, 2, 3, 99]) expect(valid(generateSolved(new RNG(seed)))).toBe(true);
  });

  it('is deterministic for a seed', () => {
    expect(generateSolved(new RNG(7))).toEqual(generateSolved(new RNG(7)));
  });

  it('counts exactly one solution for a full grid and caps at the limit for an empty one', () => {
    const solved = generateSolved(new RNG(5));
    expect(countSolutions(solved, 2)).toBe(1);
    const empty: Grid = Array.from({ length: N }, () => new Array<number>(N).fill(0));
    expect(countSolutions(empty, 2)).toBe(2);
  });

  it('rejects a grid with conflicting givens', () => {
    const solved = generateSolved(new RNG(5));
    const bad = solved.map((r) => [...r]);
    bad[0]![0] = bad[0]![1]!;
    expect(countSolutions(bad, 2)).toBe(0);
  });

  it('makePuzzle keeps the puzzle uniquely solvable and consistent with the solution', () => {
    const rng = new RNG(11);
    const solved = generateSolved(rng);
    const { puzzle, removed } = makePuzzle(rng, solved, 46);
    expect(removed).toBeGreaterThanOrEqual(40);
    expect(countSolutions(puzzle, 2)).toBe(1);
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) if (puzzle[r]![c]) expect(puzzle[r]![c]).toBe(solved[r]![c]);
  });
});
