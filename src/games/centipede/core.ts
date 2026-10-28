/** Pure centipede movement (one cell per tick, segments queue in from the left edge). */

export interface Segment {
  col: number;
  row: number;
  dir: number;
  head: boolean;
}

/**
 * Advance one segment by one tick. Segments still waiting off-screen to the left (col < 0,
 * heading right) simply walk in; everything else turns and drops a row at the board edge or
 * when a mushroom is in the way.
 */
export function stepSegment(
  s: Segment,
  cols: number,
  rows: number,
  mushroomAt: (col: number, row: number) => boolean,
): void {
  let nc = s.col + s.dir;
  const entering = s.col < 0 && s.dir > 0;
  const blocked = nc >= 0 && nc < cols && mushroomAt(nc, s.row);
  if (!entering && (nc < 0 || nc >= cols || blocked)) {
    s.dir *= -1;
    s.row = Math.min(rows - 1, s.row + 1);
    nc = s.col + s.dir;
  }
  s.col = entering ? nc : Math.max(0, Math.min(cols - 1, nc));
}
