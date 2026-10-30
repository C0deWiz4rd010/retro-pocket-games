/** Pure rules for Tailspin (tail cutting + hunger). */

export interface CutResult {
  /** True when the bite leaves fewer than `minLen` segments, which ends the run. */
  dead: boolean;
  /** Segments removed from the tail by the bite. */
  cut: number;
}

/**
 * Biting your own body at index `hitIdx` removes everything from that segment to the tail.
 * Biting so close to the head that the snake would shrink below `minLen` is fatal.
 */
export function cutTail(length: number, hitIdx: number, minLen: number): CutResult {
  const cut = length - hitIdx;
  return { dead: hitIdx < minLen, cut };
}

/** Hunger drains one tail segment; at `minLen` the snake starves. */
export function hungerDrain(length: number, minLen: number): { dead: boolean } {
  return { dead: length <= minLen };
}
