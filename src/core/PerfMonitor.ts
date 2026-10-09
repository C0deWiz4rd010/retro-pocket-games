import { screenFX } from './ScreenFX';
import { pixi } from './PixiManager';

/**
 * Rolling FPS meter. Optionally shows a tiny on-screen readout (dev) and keeps the game playable
 * on weaker devices by shedding render cost step by step when frames stay below budget:
 * CRT shader → CSS layer, then render resolution 2x → 1.5x → 1x. See docs/05 §6.
 *
 * "Below budget" is relative to what this display can actually deliver: a phone capped at 30 Hz
 * (battery saver) holding a steady 30 is healthy, a 60 Hz screen dropping to 40 is not.
 */
class PerfMonitor {
  private frames = 0;
  private acc = 0;
  private fps = 60;
  private peak = 0;
  private warmup = 0;
  private lowStreak = 0;
  private el: HTMLElement | null = null;
  private readonly dev = import.meta.env.DEV;

  attach(parent: HTMLElement): void {
    this.frames = 0;
    this.acc = 0;
    this.peak = 0;
    this.lowStreak = 0;
    this.warmup = 2; // ignore shader compilation / asset warm-up hitches
    if (!this.dev) return;
    this.el = document.createElement('div');
    this.el.className = 'fps-meter';
    parent.appendChild(this.el);
  }

  detach(): void {
    this.el?.remove();
    this.el = null;
  }

  tick(dt: number): void {
    if (this.warmup > 0) {
      this.warmup -= dt;
      return;
    }
    this.frames++;
    this.acc += dt;
    if (this.acc < 0.5) return;
    this.fps = Math.round(this.frames / this.acc);
    this.frames = 0;
    this.acc = 0;
    if (this.el) this.el.textContent = `${this.fps} FPS`;

    // The best rate seen this run approximates the display's refresh rate.
    this.peak = Math.max(this.peak, this.fps);
    const threshold = Math.min(45, this.peak * 0.75);
    this.lowStreak = this.fps < threshold ? this.lowStreak + 1 : 0;
    if (this.lowStreak >= 4) {
      // 2s sustained: shed cost one step at a time, then give the new setting time to prove itself.
      this.lowStreak = 0;
      this.warmup = 1;
      if (screenFX.isActive()) screenFX.downgrade();
      else pixi.lowerQuality();
    }
  }
}

export const perf = new PerfMonitor();
