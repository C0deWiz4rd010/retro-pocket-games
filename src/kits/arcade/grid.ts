export interface GridMetrics {
  x: number;
  y: number;
  cell: number;
  cols: number;
  rows: number;
}

/** Cell under a point, or null when outside the grid. */
export function cellAt(m: GridMetrics, px: number, py: number): { c: number; r: number } | null {
  const c = Math.floor((px - m.x) / m.cell);
  const r = Math.floor((py - m.y) / m.cell);
  return c >= 0 && r >= 0 && c < m.cols && r < m.rows ? { c, r } : null;
}

/** Top-left pixel of a cell. */
export function cellOrigin(m: GridMetrics, c: number, r: number): { x: number; y: number } {
  return { x: m.x + c * m.cell, y: m.y + r * m.cell };
}

/** Axis-aligned rectangle overlap. */
export function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
