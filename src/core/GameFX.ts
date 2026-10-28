import { Container, Graphics, Text } from 'pixi.js';

interface FloatingText {
  node: Text;
  life: number;
  ttl: number;
  vy: number;
}

interface Flash {
  node: Graphics;
  life: number;
  ttl: number;
}

/** Pool + live caps: popups are spammed in busy moments and Text creation re-rasterises a texture. */
const MAX_LIVE_TEXTS = 24;
const MAX_LIVE_FLASHES = 24;
const MAX_POOLED = 16;

export class GameFX {
  private root: Container | null = null;
  private texts: FloatingText[] = [];
  private flashes: Flash[] = [];
  private textPool: Text[] = [];
  private flashPool: Graphics[] = [];
  private shakeTime = 0;
  private shakeAmp = 0;
  private shakeTotal = 0.16;

  attach(root: Container): void {
    this.root = root;
  }

  floatingText(text: string, x: number, y: number, color = 0xffffff): void {
    if (!this.root) return;
    if (this.texts.length >= MAX_LIVE_TEXTS) this.releaseText(this.texts.shift()!);
    let node = this.textPool.pop();
    if (node) {
      node.text = text;
      node.style.fill = color;
    } else {
      node = new Text({
        text,
        style: {
          fill: color,
          fontFamily: 'VT323, monospace',
          fontSize: 24,
          stroke: { color: 0x000000, width: 3 },
        },
      });
      node.anchor.set(0.5);
    }
    node.alpha = 1;
    node.position.set(x, y);
    this.root.addChild(node);
    this.texts.push({ node, life: 0.55, ttl: 0.55, vy: -34 });
  }

  flashRect(x: number, y: number, w: number, h: number, color = 0xffffff): void {
    if (!this.root) return;
    if (this.flashes.length >= MAX_LIVE_FLASHES) this.releaseFlash(this.flashes.shift()!);
    const node = this.flashPool.pop() ?? new Graphics();
    node.clear().rect(x, y, w, h).fill({ color, alpha: 0.4 });
    node.alpha = 1;
    this.root.addChild(node);
    this.flashes.push({ node, life: 0.16, ttl: 0.16 });
  }

  /** Detach a finished popup and keep it for reuse (or destroy it if the pool is full). */
  private releaseText(item: FloatingText): void {
    item.node.removeFromParent();
    if (this.textPool.length < MAX_POOLED) this.textPool.push(item.node);
    else item.node.destroy();
  }

  private releaseFlash(item: Flash): void {
    item.node.removeFromParent();
    if (this.flashPool.length < MAX_POOLED) this.flashPool.push(item.node);
    else item.node.destroy();
  }

  screenShake(amp = 6, seconds = 0.16): void {
    // Respect the reduced-motion accessibility setting (shake is a common nausea trigger).
    if (document.documentElement.classList.contains('a11y-reduced-motion')) return;
    // A stronger shake takes over; a weaker one never cuts a running shake short.
    if (amp >= this.shakeAmp * Math.max(0, this.shakeTime / this.shakeTotal)) {
      this.shakeAmp = amp;
      this.shakeTotal = Math.max(0.01, seconds);
    }
    this.shakeTime = Math.max(this.shakeTime, seconds);
  }

  update(dt: number): void {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const item = this.texts[i]!;
      item.life -= dt;
      item.node.y += item.vy * dt;
      item.node.alpha = Math.max(0, item.life / item.ttl);
      if (item.life <= 0) {
        this.releaseText(item);
        this.texts.splice(i, 1);
      }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const item = this.flashes[i]!;
      item.life -= dt;
      item.node.alpha = Math.max(0, item.life / item.ttl);
      if (item.life <= 0) {
        this.releaseFlash(item);
        this.flashes.splice(i, 1);
      }
    }
    if (this.root && this.shakeTime > 0) {
      this.shakeTime -= dt;
      const amp = this.shakeAmp * Math.max(0, this.shakeTime / this.shakeTotal);
      this.root.position.set((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp);
      if (this.shakeTime <= 0) {
        this.shakeAmp = 0;
        this.root.position.set(0, 0);
      }
    }
  }

  clear(): void {
    for (const item of this.texts) item.node.destroy();
    for (const item of this.flashes) item.node.destroy();
    for (const node of this.textPool) node.destroy();
    for (const node of this.flashPool) node.destroy();
    this.texts = [];
    this.flashes = [];
    this.textPool = [];
    this.flashPool = [];
    this.root = null;
    this.shakeTime = 0;
    this.shakeAmp = 0;
  }
}
