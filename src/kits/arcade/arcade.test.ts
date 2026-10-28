import { describe, expect, it } from 'vitest';
import { Combo } from './combo';
import { cellAt, rectsOverlap } from './grid';
import { once } from './guard';
import { Particles } from './particles';

describe('Particles', () => {
  it('moves, applies gravity and recycles dead particles', () => {
    const p = new Particles({ gravity: 100, decay: 1 });
    p.emit({ x: 0, y: 0, vx: 10, vy: 0, life: 0.5, color: 1 });
    p.update(0.25);
    expect(p.count).toBe(1);
    p.update(0.3);
    expect(p.count).toBe(0);
    // the recycled object is reused for the next emit
    p.emit({ x: 5, y: 5, vx: 0, vy: 0, life: 1, color: 2 });
    expect(p.count).toBe(1);
  });

  it('burst emits the requested number of particles', () => {
    const p = new Particles();
    p.burst(10, 10, 0xffffff, 9);
    expect(p.count).toBe(9);
    p.clear();
    expect(p.count).toBe(0);
  });
});

describe('Combo', () => {
  it('raises the multiplier with the chain, caps it and expires', () => {
    const c = new Combo(1, 3);
    for (let i = 0; i < 12; i++) c.hit();
    expect(c.multiplier).toBe(3);
    c.update(1.1);
    expect(c.count).toBe(0);
    expect(c.multiplier).toBe(1);
  });
});

describe('grid + guard helpers', () => {
  it('finds cells and overlaps', () => {
    const m = { x: 10, y: 10, cell: 20, cols: 3, rows: 3 };
    expect(cellAt(m, 31, 12)).toEqual({ c: 1, r: 0 });
    expect(cellAt(m, 5, 12)).toBeNull();
    expect(rectsOverlap(0, 0, 10, 10, 9, 9, 5, 5)).toBe(true);
    expect(rectsOverlap(0, 0, 10, 10, 10, 0, 5, 5)).toBe(false);
  });

  it('once runs a function a single time', () => {
    let n = 0;
    const f = once(() => n++);
    f();
    f();
    expect(n).toBe(1);
  });
});
