/**
 * Host-owned, game-time timers. Unlike window.setTimeout they only advance while the sim runs
 * (so they freeze during pause and follow the daily time-scale) and are dropped on teardown, so a
 * restart or exit can never be hit by a stale callback.
 */
export interface Timers {
  /** Run `fn` once after `seconds` of game time. Returns an id for cancel(). */
  after(seconds: number, fn: () => void): number;
  /** Run `fn` every `seconds` of game time until cancelled. */
  every(seconds: number, fn: () => void): number;
  cancel(id: number): void;
  /** Seconds of game time elapsed since the run started (excludes paused time). */
  now(): number;
}

interface Entry {
  at: number;
  repeat: number;
  fn: () => void;
}

export class GameTimers implements Timers {
  private entries = new Map<number, Entry>();
  private nextId = 1;
  private clock = 0;

  after(seconds: number, fn: () => void): number {
    return this.add(seconds, 0, fn);
  }

  every(seconds: number, fn: () => void): number {
    return this.add(seconds, Math.max(seconds, 0.001), fn);
  }

  cancel(id: number): void {
    this.entries.delete(id);
  }

  now(): number {
    return this.clock;
  }

  /** Advance game time; fires due timers in order (a timer may schedule or cancel others). */
  update(dt: number): void {
    this.clock += dt;
    if (this.entries.size === 0) return;
    for (const [id, e] of [...this.entries]) {
      if (!this.entries.has(id)) continue; // cancelled by an earlier callback this tick
      while (e.at <= this.clock && this.entries.has(id)) {
        if (e.repeat > 0) e.at += e.repeat;
        else this.entries.delete(id);
        e.fn();
        if (e.repeat === 0) break;
      }
    }
  }

  clear(): void {
    this.entries.clear();
    this.clock = 0;
  }

  private add(seconds: number, repeat: number, fn: () => void): number {
    const id = this.nextId++;
    this.entries.set(id, { at: this.clock + Math.max(0, seconds), repeat, fn });
    return id;
  }
}
