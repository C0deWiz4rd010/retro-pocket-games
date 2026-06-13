export const EMPTY = -1;

export interface GridRun {
  cells: number[];
  value: number;
}

export interface GridCollapseMove {
  from: number;
  to: number;
  value: number;
}

export const idx = (cols: number, c: number, r: number): number => r * cols + c;

export const inBounds = (cols: number, rows: number, c: number, r: number): boolean =>
  c >= 0 && c < cols && r >= 0 && r < rows;

export function findRuns(board: readonly number[], cols: number, rows: number, min = 3): GridRun[] {
  const dirs: [number, number][] = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  const runs: GridRun[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const value = board[idx(cols, c, r)] ?? EMPTY;
      if (value === EMPTY) continue;
      for (const [dx, dy] of dirs) {
        const pc = c - dx;
        const pr = r - dy;
        if (inBounds(cols, rows, pc, pr) && board[idx(cols, pc, pr)] === value) continue;
        const cells = [idx(cols, c, r)];
        let cc = c + dx;
        let rr = r + dy;
        while (inBounds(cols, rows, cc, rr) && board[idx(cols, cc, rr)] === value) {
          cells.push(idx(cols, cc, rr));
          cc += dx;
          rr += dy;
        }
        if (cells.length >= min) runs.push({ cells, value });
      }
    }
  }
  return runs;
}

export function uniqueCells(runs: readonly GridRun[]): Set<number> {
  const out = new Set<number>();
  for (const run of runs) for (const cell of run.cells) out.add(cell);
  return out;
}

export function clearCells(board: number[], cells: Iterable<number>, empty = EMPTY): number {
  let count = 0;
  for (const cell of cells) {
    if (board[cell] !== empty) {
      board[cell] = empty;
      count++;
    }
  }
  return count;
}

export function collapseColumns(board: number[], cols: number, rows: number, empty = EMPTY): GridCollapseMove[] {
  const moves: GridCollapseMove[] = [];
  for (let c = 0; c < cols; c++) {
    let write = rows - 1;
    for (let r = rows - 1; r >= 0; r--) {
      const from = idx(cols, c, r);
      const value = board[from] ?? empty;
      if (value === empty) continue;
      const to = idx(cols, c, write);
      if (to !== from) {
        board[to] = value;
        board[from] = empty;
        moves.push({ from, to, value });
      }
      write--;
    }
    for (let r = write; r >= 0; r--) board[idx(cols, c, r)] = empty;
  }
  return moves;
}
