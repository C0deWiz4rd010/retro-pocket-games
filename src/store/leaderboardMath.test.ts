import { describe, it, expect } from 'vitest';
import { normalizeName, qualifies, insertEntry, LB_MAX, type LbEntry } from './leaderboardMath';

const mk = (score: number, name = 'AAA', at = score): LbEntry => ({ name, score, at });

describe('leaderboard math', () => {
  it('normalizeName trims, caps at 8, uppercases, defaults to YOU', () => {
    expect(normalizeName('  bob ')).toBe('BOB');
    expect(normalizeName('superlongname')).toBe('SUPERLON');
    expect(normalizeName('')).toBe('YOU');
    expect(normalizeName('   ')).toBe('YOU');
  });

  it('qualifies on an empty board for any positive score', () => {
    expect(qualifies([], 1)).toBe(true);
    expect(qualifies([], 0)).toBe(false);
    expect(qualifies([], -5)).toBe(false);
  });

  it('qualifies while the board is not full', () => {
    const entries = [mk(100), mk(50)];
    expect(qualifies(entries, 10)).toBe(true);
  });

  it('qualifies only above the lowest entry once full', () => {
    // entries are kept sorted desc, so the lowest is last: 100,90,…,10
    const full = Array.from({ length: LB_MAX }, (_, i) => mk((LB_MAX - i) * 10));
    expect(qualifies(full, 5)).toBe(false); // below lowest (10)
    expect(qualifies(full, 15)).toBe(true); // above lowest
  });

  it('insertEntry keeps sorted desc and caps length', () => {
    const start = [mk(100), mk(80), mk(60)];
    const { entries, rank } = insertEntry(start, mk(90, 'NEW'));
    expect(entries.map((e) => e.score)).toEqual([100, 90, 80, 60]);
    expect(rank).toBe(1);
  });

  it('insertEntry drops the lowest when over capacity', () => {
    const full = Array.from({ length: LB_MAX }, (_, i) => mk((LB_MAX - i) * 10)); // 100..10
    const { entries, rank } = insertEntry(full, mk(55, 'MID'));
    expect(entries).toHaveLength(LB_MAX);
    expect(entries.some((e) => e.name === 'MID')).toBe(true);
    expect(Math.min(...entries.map((e) => e.score))).toBe(20); // 10 pushed out
    expect(rank).toBeGreaterThanOrEqual(0);
  });
});
