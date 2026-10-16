import { Application, Container } from 'pixi.js';

/** Screen space (CSS px) taken by HUD/controls; the game is letterboxed into what remains. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

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
export function computeLayout(
  vw: number,
  vh: number,
  screenW: number,
  screenH: number,
  insets: Insets = NO_INSETS,
): LayoutResult {
  // The play area is the screen minus whatever HUD/controls occupy (never below 1px).
  const sw = Math.max(1, screenW - insets.left - insets.right);
  const sh = Math.max(1, screenH - insets.top - insets.bottom);
  const rotated = vw > vh && sh > sw;
  if (rotated) {
    const scale = Math.min(sw / vh, sh / vw);
    return {
      rotated,
      scale,
      offsetX: insets.left + (sw + vh * scale) / 2,
      offsetY: insets.top + (sh - vw * scale) / 2,
    };
  }
  const scale = Math.min(sw / vw, sh / vh);
  return {
    rotated,
    scale,
    offsetX: insets.left + (sw - vw * scale) / 2,
    offsetY: insets.top + (sh - vh * scale) / 2,
  };
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
  private resizeObserver: ResizeObserver | null = null;
  private rect: DOMRect | null = null;
  /** True while a game is running and the ticker is rendering (menus render nothing at all). */
  private running = false;

  /** Render-resolution tiers, best first. PerfMonitor steps down when frames stay too slow. */
  private insets: Insets = NO_INSETS;
  private tiers: number[] = [2];
  private tier = 0;

  scale = 1;
  offsetX = 0;
  offsetY = 0;
  /** True when a landscape game is auto-rotated 90° to fill a portrait viewport. */
  rotated = false;

  async init(host: HTMLElement): Promise<void> {
    this.host = host;
    this.app = new Application();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.tiers = [...new Set([dpr, 1.5, 1].filter((r) => r <= dpr))].sort((a, b) => b - a);
    await this.app.init({
      backgroundAlpha: 0, // let the themed CSS shell / CRT layer show through
      antialias: false, // crisp pixels + faster on mobile
      resolution: this.tiers[0],
      autoDensity: true,
      resizeTo: host,
      preference: 'webgl', // the WebGPU renderer is never needed for 2D retro games
    });
    host.appendChild(this.app.canvas);
    this.app.canvas.style.touchAction = 'none';
    this.app.stage.addChild(this.world);
    // Menus draw nothing, so don't burn a frame loop (and battery) there.
    this.setActive(false);
    // Observe the host itself: catches rail/HUD toggles, URL-bar collapse and rotation, not just
    // window resizes. Pixi's resizeTo only listens to the window, so resize explicitly.
    this.resizeObserver = new ResizeObserver(() => {
      this.app.resize();
      this.layout();
    });
    this.resizeObserver.observe(host);
    window.addEventListener('scroll', this.invalidateRect, true);
  }

  /** Start/stop the render loop. Stopping first draws once so a cleared stage isn't left stale. */
  setActive(on: boolean): void {
    if (!this.app) return;
    this.running = on;
    if (on) {
      this.app.ticker.start();
    } else {
      try {
        this.app.render();
      } catch {
        /* renderer may already be gone */
      }
      this.app.ticker.stop();
    }
  }

  get isActive(): boolean {
    return this.running;
  }

  /**
   * Step the render resolution down one tier (2 → 1.5 → 1). Returns false when already at the
   * lowest tier. Used by PerfMonitor on devices that can't hold frame rate.
   */
  lowerQuality(): boolean {
    if (this.tier >= this.tiers.length - 1) return false;
    this.tier++;
    this.app.renderer.resolution = this.tiers[this.tier]!;
    this.app.resize();
    this.layout();
    return true;
  }

  private invalidateRect = (): void => {
    this.rect = null;
  };

  /** Reserve screen edges for HUD/controls so they never cover the playfield. */
  setInsets(insets: Insets): void {
    const a = this.insets;
    if (
      a.top === insets.top &&
      a.right === insets.right &&
      a.bottom === insets.bottom &&
      a.left === insets.left
    )
      return;
    this.insets = insets;
    this.layout();
  }

  setVirtual(w: number, h: number): void {
    this.vw = w;
    this.vh = h;
    this.layout();
  }

  layout = (): void => {
    if (!this.host) return;
    this.rect = null;
    const sw = this.host.clientWidth || window.innerWidth;
    const sh = this.host.clientHeight || window.innerHeight;
    const l = computeLayout(this.vw, this.vh, sw, sh, this.insets);
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
    // Cached: reading the rect on every pointermove would force a layout each time.
    const rect = (this.rect ??= this.app.canvas.getBoundingClientRect());
    return mapToVirtual(clientX - rect.left, clientY - rect.top, {
      rotated: this.rotated,
      scale: this.scale,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
    });
  };

  clearWorld(): void {
    this.insets = NO_INSETS;
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
