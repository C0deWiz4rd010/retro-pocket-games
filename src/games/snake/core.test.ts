import { describe, it, expect } from 'vitest';
import { RNG } from '@utils/rng';
import { createSnake, setDir, step, spawnFood } from './core';

describe('snake core', () => {
  it('starts alive, length 3, moving right', () => {
    const s = createSnake(10, 10, new RNG(1));
    expect(s.alive).toBe(true);
    expect(s.body).toHaveLength(3);
    expect(s.dir).toEqual({ x: 1, y: 0 });
  });

  it('moves the head and keeps length when not eating', () => {
    const s = createSnake(10, 10, new RNG(1));
    s.food = { x: 9, y: 9 }; // out of the way
    const head = { ...s.body[0]! };
    step(s, new RNG(1));
    expect(s.body[0]).toEqual({ x: head.x + 1, y: head.y });
    expect(s.body).toHaveLength(3);
  });

  it('ignores 180° reversals', () => {
    const s = createSnake(10, 10, new RNG(1));
    setDir(s, { x: -1, y: 0 });
    expect(s.nextDir).toEqual({ x: 1, y: 0 });
  });

  it('wraps through walls instead of dying', () => {
    const s = createSnake(6, 6, new RNG(1));
    s.food = { x: 0, y: 0 };
    let r = step(s, new RNG(1)); // x:3->4
    r = step(s, new RNG(1)); // 4->5
    r = step(s, new RNG(1)); // 5->0 via wraparound
    expect(r).toBe('move');
    expect(s.body[0]).toEqual({ x: 0, y: 3 });
    expect(s.alive).toBe(true);
  });

  it('grows and scores when eating', () => {
    const s = createSnake(10, 10, new RNG(1));
    const head = s.body[0]!;
    s.food = { x: head.x + 1, y: head.y };
    const r = step(s, new RNG(1));
    expect(r).toBe('eat');
    expect(s.score).toBe(10);
  });

  it('dies when hitting an obstacle, unless invincible', () => {
    const s = createSnake(10, 10, new RNG(1));
    s.food = { x: 9, y: 9 };
    const head = s.body[0]!;
    s.obstacles = [{ x: head.x + 1, y: head.y }];
    const mortal = step({ ...s, body: s.body.map((b) => ({ ...b })) }, new RNG(1));
    expect(mortal).toBe('dead');
    const survives = step(s, new RNG(1), { invincible: true });
    expect(survives).toBe('move');
    expect(s.alive).toBe(true);
  });

  it('passes through itself when invincible', () => {
    const s = createSnake(10, 10, new RNG(1));
    // Force a body cell directly ahead of the head.
    const head = s.body[0]!;
    s.body.splice(1, 0, { x: head.x + 1, y: head.y });
    s.food = { x: 9, y: 9 };
    const r = step(s, new RNG(1), { invincible: true });
    expect(r).not.toBe('dead');
    expect(s.alive).toBe(true);
  });

  it('keeps food off obstacle cells', () => {
    const s = createSnake(6, 6, new RNG(3));
    s.obstacles = [];
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) if (!(x === 1 && y === 1)) s.obstacles.push({ x, y });
    // only free non-body cell is (1,1); body occupies center row though, so re-pick
    s.obstacles = s.obstacles.filter((o) => !s.body.some((b) => b.x === o.x && b.y === o.y) && !(o.x === 1 && o.y === 1));
    const f = spawnFood(s, new RNG(3));
    expect(s.obstacles.some((o) => o.x === f.x && o.y === f.y)).toBe(false);
  });

  it('is deterministic for a fixed seed', () => {
    const run = (): number => {
      const s = createSnake(12, 12, new RNG(42));
      for (let i = 0; i < 5; i++) step(s, new RNG(42 + i));
      return s.food.x * 100 + s.food.y;
    };
    expect(run()).toBe(run());
  });
});
