import { describe, expect, it } from 'vitest';
import { stepSegment, type Segment } from './core';

const none = (): boolean => false;

describe('centipede core', () => {
  it('walks queued segments in without dropping a row', () => {
    const s: Segment = { col: -3, row: 0, dir: 1, head: false };
    stepSegment(s, 10, 12, none);
    expect(s).toMatchObject({ col: -2, row: 0, dir: 1 });
  });

  it('turns and descends at the right edge', () => {
    const s: Segment = { col: 9, row: 2, dir: 1, head: true };
    stepSegment(s, 10, 12, none);
    expect(s).toMatchObject({ col: 8, row: 3, dir: -1 });
  });

  it('turns and descends when a mushroom blocks the way', () => {
    const s: Segment = { col: 4, row: 1, dir: 1, head: true };
    stepSegment(s, 10, 12, (c, r) => c === 5 && r === 1);
    expect(s).toMatchObject({ row: 2, dir: -1 });
  });

  it('never leaves the board vertically', () => {
    const s: Segment = { col: 0, row: 11, dir: -1, head: true };
    stepSegment(s, 10, 12, none);
    expect(s.row).toBe(11);
  });
});
