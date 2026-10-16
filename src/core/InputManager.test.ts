import { describe, expect, it } from 'vitest';
import { InputManager, type Action } from './InputManager';

const record = (im: InputManager): { downs: Action[]; ups: Action[] } => {
  const log = { downs: [] as Action[], ups: [] as Action[] };
  im.on('down', (a) => log.downs.push(a));
  im.on('up', (a) => log.ups.push(a));
  return log;
};

describe('InputManager gating', () => {
  it('delivers presses normally', () => {
    const im = new InputManager();
    const log = record(im);
    im.press('left');
    expect(im.isDown('left')).toBe(true);
    expect(log.downs).toEqual(['left']);
  });

  it('ignores game input while blocked but still lets pause through', () => {
    const im = new InputManager();
    const log = record(im);
    let pauses = 0;
    im.onPause(() => pauses++);
    im.setBlocked(true);
    im.press('a');
    im.press('pause');
    expect(im.isDown('a')).toBe(false);
    expect(log.downs).toEqual([]);
    expect(pauses).toBe(1);
  });

  it('releases held actions when it becomes blocked so nothing sticks after resume', () => {
    const im = new InputManager();
    const log = record(im);
    im.press('right');
    im.setBlocked(true);
    expect(im.isDown('right')).toBe(false);
    expect(log.ups).toContain('right');
    im.setBlocked(false);
    im.press('right');
    expect(im.isDown('right')).toBe(true);
  });

  it('releaseAll clears every held action', () => {
    const im = new InputManager();
    im.press('up');
    im.press('b');
    im.releaseAll();
    expect(im.isDown('up')).toBe(false);
    expect(im.isDown('b')).toBe(false);
  });

  it('does not emit duplicate downs for a held action', () => {
    const im = new InputManager();
    const log = record(im);
    im.press('a');
    im.press('a');
    expect(log.downs).toEqual(['a']);
  });
});

describe('aim cursor for pointer-only games', () => {
  const taps = (im: InputManager): { x: number; y: number }[] => {
    const out: { x: number; y: number }[] = [];
    im.on('tap', (p) => out.push(p));
    return out;
  };

  it('arrow keys steer the cursor and A taps at its position', () => {
    const im = new InputManager();
    im.setVirtualBounds(200, 100);
    const t = taps(im);
    im.press('right');
    im.tickCursor(0.1);
    im.release('right');
    im.press('a');
    expect(t).toHaveLength(1);
    expect(t[0]!.x).toBeGreaterThan(100); // moved right of the centre
    expect(t[0]!.y).toBe(50);
  });

  it('clamps the cursor to the playfield', () => {
    const im = new InputManager();
    im.setVirtualBounds(100, 100);
    const t = taps(im);
    im.press('left');
    for (let i = 0; i < 50; i++) im.tickCursor(0.1);
    im.press('a');
    expect(t[0]!.x).toBe(0);
  });

  it('is off when the game listens for key events itself', () => {
    const im = new InputManager();
    im.on('down', () => undefined);
    const t = taps(im);
    im.press('a');
    expect(t).toHaveLength(0);
  });

  it('is off when the game polls held keys', () => {
    const im = new InputManager();
    const t = taps(im);
    im.isDown('left'); // a game polling in update()
    im.press('a');
    expect(t).toHaveLength(0);
  });
});
