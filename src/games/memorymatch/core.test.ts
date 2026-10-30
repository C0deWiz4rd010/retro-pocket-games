import { describe, expect, it } from 'vitest';
import { reshuffleRest } from './core';

describe('shuffle match core', () => {
  it('keeps matched cards where they are and preserves the live multiset', () => {
    const vals = [0, 0, 1, 1, 2, 2, 3, 3];
    const found = new Set([0, 1]);
    const before = vals.slice();
    let seed = 7;
    const rnd = (n: number): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % (n + 1);
    };
    const moved = reshuffleRest(vals, found, rnd);
    expect(moved).toEqual([2, 3, 4, 5, 6, 7]);
    expect(vals.slice(0, 2)).toEqual(before.slice(0, 2));
    expect([...vals.slice(2)].sort()).toEqual([...before.slice(2)].sort());
  });

  it('actually changes the layout for some seed', () => {
    const vals = [1, 2, 3, 4, 5, 6];
    const before = vals.slice();
    reshuffleRest(vals, new Set(), (n) => (n === 0 ? 0 : n - 1));
    expect(vals).not.toEqual(before);
  });
});
