/**
 * Deal the cards that are still in play (everything not in `found`) out again, in place, with a
 * Fisher–Yates shuffle over their positions. `randInt(n)` must return an integer in [0, n].
 * Matched cards never move. Returns the positions that were reshuffled.
 */
export function reshuffleRest(
  vals: number[],
  found: ReadonlySet<number>,
  randInt: (maxInclusive: number) => number,
): number[] {
  const live: number[] = [];
  for (let i = 0; i < vals.length; i++) if (!found.has(i)) live.push(i);
  const items = live.map((i) => vals[i]!);
  for (let i = items.length - 1; i > 0; i--) {
    const j = randInt(i);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  live.forEach((pos, k) => {
    vals[pos] = items[k]!;
  });
  return live;
}
