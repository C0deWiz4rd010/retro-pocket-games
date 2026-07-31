import { Application, Container } from 'pixi.js';

export interface LayoutResult {
  rotated: boolean;
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Pure letterbox/auto-rotate math (unit-tested). Landscape games (vw > vh) shown in a
 * portrait viewport (sh > sw) rotate 90° so they fill the screen. Returns the transform
 * applied to the world container.
 */
export function computeLayout(vw: number, vh: number, sw: number, sh: number): LayoutResult {
  const rotated = vw > vh && sh > sw;
  if (rotated) {
    const scale = Math.min(sw / vh, sh / vw);
    return {
      rotated,
      scale,
      offsetX: (sw + vh * scale) / 2,
      offsetY: (sh - vw * scale) / 2,
    };
  }
  const scale = Math.min(sw / vw, sh / vh);
  return { rotated, scale, offsetX: (sw - vw * scale) / 2, offsetY: (sh - vh * scale) / 2 };
}

/** Inverse of the world transform: map viewport-local px back to virtual game coords. */
export function mapToVirtual(cx: number, cy: number, l: LayoutResult): { x: number; y: number } {
  if (l.rotated) {
    return { x: (cy - l.offsetY) / l.scale, y: (l.offsetX - cx) / l.scale };
  }
  return { x: (cx - l.offsetX) / l.scale, y: (cy - l.offsetY) / l.scale };
}

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
  /** True when a landscape game is auto-rotated 90° to fill a portrait viewport. */
  rotated = false;

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
    const l = computeLayout(this.vw, this.vh, sw, sh);
    this.rotated = l.rotated;
    this.scale = l.scale;
    this.offsetX = l.offsetX;
    this.offsetY = l.offsetY;
    this.world.rotation = l.rotated ? Math.PI / 2 : 0;
    this.world.scale.set(this.scale);
    this.world.position.set(this.offsetX, this.offsetY);
  };

  /** Map client (CSS px) coordinates to virtual game coordinates. */
  screenToVirtual = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = this.app.canvas.getBoundingClientRect();
    return mapToVirtual(clientX - rect.left, clientY - rect.top, {
      rotated: this.rotated,
      scale: this.scale,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
    });
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
