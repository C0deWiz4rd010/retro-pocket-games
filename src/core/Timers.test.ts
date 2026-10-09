import { describe, expect, it } from 'vitest';
import { GameTimers } from './Timers';

describe('GameTimers', () => {
  it('fires once after the delay and not before', () => {
    const t = new GameTimers();
    let n = 0;
    t.after(1, () => n++);
    t.update(0.5);
    expect(n).toBe(0);
    t.update(0.5);
    expect(n).toBe(1);
    t.update(5);
    expect(n).toBe(1);
  });

  it('repeats with every() and catches up after a long frame', () => {
    const t = new GameTimers();
    let n = 0;
    t.every(0.25, () => n++);
    t.update(1);
    expect(n).toBe(4);
  });

  it('cancel() prevents a pending timer', () => {
    const t = new GameTimers();
    let n = 0;
    const id = t.after(1, () => n++);
    t.cancel(id);
    t.update(2);
    expect(n).toBe(0);
  });

  it('a callback can cancel a later timer in the same tick', () => {
    const t = new GameTimers();
    let n = 0;
    let victim = 0;
    t.after(1, () => t.cancel(victim));
    victim = t.after(1, () => n++);
    t.update(1);
    expect(n).toBe(0);
  });

  it('a callback can schedule a follow-up that fires on a later tick', () => {
    const t = new GameTimers();
    const log: string[] = [];
    t.after(1, () => {
      log.push('a');
      t.after(1, () => log.push('b'));
    });
    t.update(1);
    expect(log).toEqual(['a']);
    t.update(1);
    expect(log).toEqual(['a', 'b']);
  });

  it('clear() drops everything and resets the clock', () => {
    const t = new GameTimers();
    let n = 0;
    t.after(1, () => n++);
    t.update(0.5);
    t.clear();
    t.update(5);
    expect(n).toBe(0);
    expect(t.now()).toBe(5);
  });

  it('now() only advances through update (frozen while paused)', () => {
    const t = new GameTimers();
    t.update(0.2);
    expect(t.now()).toBeCloseTo(0.2);
  });
});
