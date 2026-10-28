/** Pure rules for Space Invaders (wave scaling and who may shoot). */

export interface GridAlien {
  alive: boolean;
  row: number;
  col: number;
}

/** Only the lowest living alien of each column can fire (classic rule, readable threat). */
export function shooters<T extends GridAlien>(aliens: readonly T[]): T[] {
  return aliens.filter(
    (a) => a.alive && !aliens.some((o) => o.alive && o.col === a.col && o.row > a.row),
  );
}

export interface WaveParams {
  /** Seconds between formation steps for a given fraction of aliens still alive. */
  stepInterval: (aliveFraction: number) => number;
  /** Seconds between enemy shots. */
  fireInterval: number;
  /** Enemy bullet speed in px/s. */
  bulletSpeed: number;
  /** Extra downward offset of the formation's start row. */
  startOffset: number;
}

export function waveParams(wave: number): WaveParams {
  const w = Math.max(1, wave);
  const waveSpeed = 1 + Math.min(w - 1, 6) * 0.07;
  return {
    stepInterval: (f) =>
      Math.min(0.6, Math.max(0.07, (0.5 * Math.max(0, Math.min(1, f)) + 0.08) / waveSpeed)),
    fireInterval: Math.max(0.35, 0.8 - (w - 1) * 0.06),
    bulletSpeed: Math.min(400, 300 + (w - 1) * 15),
    startOffset: Math.min(w - 1, 4) * 12,
  };
}
