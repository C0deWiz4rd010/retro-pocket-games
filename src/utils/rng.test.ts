import { describe, it, expect } from 'vitest';
import { RNG, seedFromString } from './rng';

describe('RNG', () => {
  it('is deterministic for a given seed', () => {
    const a = new RNG(12345);
    const b = new RNG(12345);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different streams for different seeds', () => {
    const a = Array.from({ length: 10 }, (() => {
      const r = new RNG(1);
      return () => r.next();
    })());
    const b = Array.from({ length: 10 }, (() => {
      const r = new RNG(2);
      return () => r.next();
    })());
    expect(a).not.toEqual(b);
  });

  it('next() stays within [0, 1)', () => {
    const r = new RNG(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(min, max) is inclusive and in range', () => {
    const r = new RNG(99);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = r.int(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
      seen.add(v);
    }
    expect(seen).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  it('pick() returns an element of the array', () => {
    const r = new RNG(3);
    const arr = ['a', 'b', 'c', 'd'];
    for (let i = 0; i < 50; i++) expect(arr).toContain(r.pick(arr));
  });

  it('shuffle() is a permutation (no loss, deterministic per seed)', () => {
    const base = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const s1 = new RNG(42).shuffle([...base]);
    const s2 = new RNG(42).shuffle([...base]);
    expect(s1).toEqual(s2); // deterministic
    expect([...s1].sort((a, b) => a - b)).toEqual(base); // permutation
  });

  it('seedFromString is stable and differs by input', () => {
    expect(seedFromString('2026-06-02')).toBe(seedFromString('2026-06-02'));
    expect(seedFromString('2026-06-02')).not.toBe(seedFromString('2026-06-03'));
    expect(seedFromString('')).toBeTypeOf('number');
  });
});
