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
    im.setBlocked(true);
    im.press('a');
    im.press('pause');
    expect(im.isDown('a')).toBe(false);
    expect(log.downs).toEqual(['pause']);
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
