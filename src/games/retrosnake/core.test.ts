import { describe, expect, it } from 'vitest';
import { cutTail, hungerDrain } from './core';

describe('tailspin core', () => {
  it('cuts the tail from the bitten segment onward', () => {
    expect(cutTail(10, 6, 3)).toEqual({ dead: false, cut: 4 });
  });

  it('is fatal to bite too close to the head', () => {
    expect(cutTail(10, 2, 3).dead).toBe(true);
    expect(cutTail(10, 3, 3).dead).toBe(false);
  });

  it('starves at the minimum length', () => {
    expect(hungerDrain(4, 3).dead).toBe(false);
    expect(hungerDrain(3, 3).dead).toBe(true);
  });
});
