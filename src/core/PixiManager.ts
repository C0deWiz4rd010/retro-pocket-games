import { Application, Container } from 'pixi.js';

/**
 * Owns the single PixiJS Application reused across games. Games render into `world`
 * using a fixed virtual resolution; PixiManager letterboxes that into the real screen
 * and maps pointer coordinates back. DPR is capped at 2 for performance. See docs/03 §8.
 */
export class PixiManager {
  app!: Application;
  readonly world = new Container();

  private host!: HTMLElement;
  private vw = 360;
  private vh = 640;

  scale = 1;
  offsetX = 0;
  offsetY = 0;

  async init(host: HTMLElement): Promise<void> {
    this.host = host;
    this.app = new Application();
    await this.app.init({
      backgroundAlpha: 0, // let the themed CSS shell / CRT layer show through
      antialias: false, // crisp pixels + faster on mobile
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      resizeTo: host,
      powerPreference: 'high-performance',
    });
    host.appendChild(this.app.canvas);
    this.app.canvas.style.touchAction = 'none';
    this.app.stage.addChild(this.world);
    window.addEventListener('resize', this.layout);
    window.addEventListener('orientationchange', this.layout);
  }

  setVirtual(w: number, h: number): void {
    this.vw = w;
    this.vh = h;
    this.layout();
  }

  layout = (): void => {
    if (!this.host) return;
    const sw = this.host.clientWidth || window.innerWidth;
    const sh = this.host.clientHeight || window.innerHeight;
    this.scale = Math.min(sw / this.vw, sh / this.vh);
    this.offsetX = (sw - this.vw * this.scale) / 2;
    this.offsetY = (sh - this.vh * this.scale) / 2;
    this.world.scale.set(this.scale);
    this.world.position.set(this.offsetX, this.offsetY);
  };

  /** Map client (CSS px) coordinates to virtual game coordinates. */
  screenToVirtual = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = this.app.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.offsetX) / this.scale,
      y: (clientY - rect.top - this.offsetY) / this.scale,
    };
  };

  clearWorld(): void {
    for (const child of this.world.removeChildren()) child.destroy({ children: true });
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  get virtualWidth(): number {
    return this.vw;
  }
  get virtualHeight(): number {
    return this.vh;
  }
}

export const pixi = new PixiManager();
