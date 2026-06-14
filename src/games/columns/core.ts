import { EMPTY, clearCells, collapseColumns, findRuns, idx, uniqueCells } from '@kits/grid/core';
import type { RNG } from '@utils/rng';

export const COLS = 7;
export const ROWS = 14;
export const JEWELS = 6;

export type JewelStack = [number, number, number];

export interface ColumnsPiece {
  col: number;
  row: number;
  cells: JewelStack;
}

export interface ColumnsState {
  cols: number;
  rows: number;
  board: number[];
  piece: ColumnsPiece;
  next: JewelStack;
  score: number;
  level: number;
  combo: number;
  over: boolean;
  lastClear: number;
}

export function createColumns(rng: RNG, cols = COLS, rows = ROWS): ColumnsState {
  return {
    cols,
    rows,
    board: new Array(cols * rows).fill(EMPTY),
    piece: nextPiece(rng, cols),
    next: nextCells(rng),
    score: 0,
    level: 1,
    combo: 0,
    over: false,
    lastClear: 0,
  };
}

export function nextPiece(rng: RNG, cols = COLS): ColumnsPiece {
  return {
    col: Math.floor(cols / 2),
    row: 0,
    cells: nextCells(rng),
  };
}

export function nextCells(rng: RNG): JewelStack {
  return [rng.int(0, JEWELS - 1), rng.int(0, JEWELS - 1), rng.int(0, JEWELS - 1)];
}

export function at(s: ColumnsState, c: number, r: number): number {
  return s.board[idx(s.cols, c, r)] ?? EMPTY;
}

export function pieceCells(s: ColumnsState, piece = s.piece): { c: number; r: number; value: number }[] {
  return piece.cells.map((value, i) => ({ c: piece.col, r: piece.row + i, value }));
}

export function pieceOverlapsBoard(s: ColumnsState, piece = s.piece): boolean {
  return pieceCells(s, piece).some(({ c, r }) => r >= 0 && r < s.rows && at(s, c, r) !== EMPTY);
}

export function canFall(s: ColumnsState): boolean {
  const r = s.piece.row + s.piece.cells.length;
  return r < s.rows && at(s, s.piece.col, r) === EMPTY;
}

export function canMove(s: ColumnsState, dc: -1 | 1): boolean {
  const c = s.piece.col + dc;
  if (c < 0 || c >= s.cols) return false;
  for (let i = 0; i < s.piece.cells.length; i++) {
    const r = s.piece.row + i;
    if (r >= 0 && r < s.rows && at(s, c, r) !== EMPTY) return false;
  }
  return true;
}

export function movePiece(s: ColumnsState, dc: -1 | 1): boolean {
  if (!canMove(s, dc)) return false;
  s.piece.col += dc;
  return true;
}

export function cyclePiece(s: ColumnsState): void {
  const [a, b, c] = s.piece.cells;
  s.piece.cells = [c, a, b];
}

export function hardDrop(s: ColumnsState): number {
  let rows = 0;
  while (canFall(s)) {
    s.piece.row++;
    rows++;
  }
  lockPiece(s);
  return rows;
}

export function softDrop(s: ColumnsState): boolean {
  if (!canFall(s)) return false;
  s.piece.row++;
  return true;
}

export function lockPiece(s: ColumnsState): void {
  for (let i = 0; i < s.piece.cells.length; i++) {
    const r = s.piece.row + i;
    if (r >= 0 && r < s.rows) s.board[idx(s.cols, s.piece.col, r)] = s.piece.cells[i]!;
  }
}

export function spawnPiece(s: ColumnsState, rng: RNG): void {
  s.piece = { col: Math.floor(s.cols / 2), row: 0, cells: [...s.next] };
  s.next = nextCells(rng);
  if (pieceOverlapsBoard(s)) s.over = true;
}

export interface ResolveResult {
  cleared: number;
  combo: number;
  scoreDelta: number;
}

export function resolveMatches(s: ColumnsState): ResolveResult {
  const marked = uniqueCells(findRuns(s.board, s.cols, s.rows, 3));
  const cleared = clearCells(s.board, marked);
  s.lastClear = cleared;
  if (cleared <= 0) {
    s.combo = 0;
    return { cleared: 0, combo: 0, scoreDelta: 0 };
  }
  s.combo++;
  const scoreDelta = cleared * 20 * s.level * s.combo;
  s.score += scoreDelta;
  s.level = 1 + Math.floor(s.score / 1000);
  collapseColumns(s.board, s.cols, s.rows);
  return { cleared, combo: s.combo, scoreDelta };
}
