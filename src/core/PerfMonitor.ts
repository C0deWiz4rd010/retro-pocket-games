import { screenFX } from './ScreenFX';
import { settings } from '@store/settings';

/**
 * Rolling FPS meter. Optionally shows a tiny on-screen readout (dev), and auto-downgrades
 * the full CRT shader to the CSS layer if the frame rate stays below budget — so the effect
 * never costs playability on weaker devices. See docs/05 §6.
 */
class PerfMonitor {
  private frames = 0;
  private acc = 0;
  private fps = 60;
  private lowStreak = 0;
  private el: HTMLElement | null = null;
  private readonly dev = import.meta.env.DEV;

  attach(parent: HTMLElement): void {
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
    this.frames++;
    this.acc += dt;
    if (this.acc < 0.5) return;
    this.fps = Math.round(this.frames / this.acc);
    this.frames = 0;
    this.acc = 0;
    if (this.el) this.el.textContent = `${this.fps} FPS`;

    // Auto-downgrade: 2s sustained < 45 FPS while the shader is on.
    if (screenFX.isActive() && settings().screenFx.mode === 'full') {
      this.lowStreak = this.fps < 45 ? this.lowStreak + 1 : 0;
      if (this.lowStreak >= 4) {
        screenFX.downgrade();
        this.lowStreak = 0;
      }
    } else {
      this.lowStreak = 0;
    }
  }
}

export const perf = new PerfMonitor();
