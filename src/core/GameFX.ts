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

export class GameFX {
  private root: Container | null = null;
  private texts: FloatingText[] = [];
  private flashes: Flash[] = [];
  private shakeTime = 0;
  private shakeAmp = 0;

  attach(root: Container): void {
    this.root = root;
  }

  floatingText(text: string, x: number, y: number, color = 0xffffff): void {
    if (!this.root) return;
    const node = new Text({
      text,
      style: {
        fill: color,
        fontFamily: 'VT323, monospace',
        fontSize: 24,
        stroke: { color: 0x000000, width: 3 },
      },
    });
    node.anchor.set(0.5);
    node.position.set(x, y);
    this.root.addChild(node);
    this.texts.push({ node, life: 0.55, ttl: 0.55, vy: -34 });
  }

  flashRect(x: number, y: number, w: number, h: number, color = 0xffffff): void {
    if (!this.root) return;
    const node = new Graphics();
    node.rect(x, y, w, h).fill({ color, alpha: 0.4 });
    this.root.addChild(node);
    this.flashes.push({ node, life: 0.16, ttl: 0.16 });
  }

  screenShake(amp = 6, seconds = 0.16): void {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeTime = Math.max(this.shakeTime, seconds);
  }

  update(dt: number): void {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const item = this.texts[i]!;
      item.life -= dt;
      item.node.y += item.vy * dt;
      item.node.alpha = Math.max(0, item.life / item.ttl);
      if (item.life <= 0) {
        item.node.destroy();
        this.texts.splice(i, 1);
      }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const item = this.flashes[i]!;
      item.life -= dt;
      item.node.alpha = Math.max(0, item.life / item.ttl);
      if (item.life <= 0) {
        item.node.destroy();
        this.flashes.splice(i, 1);
      }
    }
    if (this.root && this.shakeTime > 0) {
      this.shakeTime -= dt;
      const amp = this.shakeAmp * Math.max(0, this.shakeTime / 0.16);
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
    this.texts = [];
    this.flashes = [];
    this.root = null;
    this.shakeTime = 0;
    this.shakeAmp = 0;
  }
}
