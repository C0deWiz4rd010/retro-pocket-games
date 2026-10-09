import { Graphics } from 'pixi.js';
import type { RNG } from '@utils/rng';

export interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  color: number;
  size: number;
}

export const clamp = (n: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, n));
export const dist = (ax: number, ay: number, bx: number, by: number): number =>
  Math.hypot(ax - bx, ay - by);

export function burst(
  sparks: Spark[],
  rng: RNG,
  x: number,
  y: number,
  color: number,
  count = 14,
  power = 120,
): void {
  for (let i = 0; i < count; i++) {
    const a = rng.next() * Math.PI * 2;
    const speed = power * (0.35 + rng.next() * 0.75);
    const ttl = 0.35 + rng.next() * 0.35;
    sparks.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: ttl,
      ttl,
      color,
      size: 2 + rng.next() * 3,
    });
  }
}

export function updateSparks(sparks: Spark[], dt: number): void {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]!;
    s.life -= dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy += 80 * dt;
    if (s.life <= 0) sparks.splice(i, 1);
  }
}

export function drawSparks(g: Graphics, sparks: readonly Spark[]): void {
  for (const s of sparks) {
    const alpha = clamp(s.life / s.ttl, 0, 1);
    g.circle(s.x, s.y, s.size * alpha).fill({ color: s.color, alpha });
  }
}

/**
 * Static + slowly-animated background layers living *under* a game's per-frame Graphics.
 * Backdrops used to be re-tessellated into the game graphic every frame (hundreds of primitives);
 * now the unchanging part is drawn once and the animated part only ~15x per second.
 */
export interface BackdropLayers {
  still: Graphics;
  anim: Graphics;
  /** Key of what `still` currently shows; redraw when it changes. */
  stillKey: string;
  /** Game time of the last `anim` redraw. */
  lastAnim: number;
  /** True for the frame in which `anim` was just cleared and redrawn. */
  animFresh: boolean;
  /** Game time of the last backdropLayers() call, so several helpers in one frame agree. */
  lastCall: number;
}

const layerCache = new WeakMap<Graphics, BackdropLayers>();
const ANIM_STEP = 1 / 15;

/** Layers for `g`, created on first use as siblings beneath it. Null if `g` isn't mounted yet. */
export function backdropLayers(g: Graphics, t: number): BackdropLayers | null {
  let layers = layerCache.get(g);
  if (!layers) {
    const parent = g.parent;
    if (!parent) return null;
    const at = parent.getChildIndex(g);
    const still = new Graphics();
    const anim = new Graphics();
    parent.addChildAt(still, at);
    parent.addChildAt(anim, at + 1);
    layers = { still, anim, stillKey: '', lastAnim: -Infinity, animFresh: false, lastCall: NaN };
    layerCache.set(g, layers);
  }
  if (layers.lastCall === t) return layers; // same frame: backdrop() then city() share one decision
  layers.lastCall = t;
  // Time can restart (new run on the same graphic); also redraw on the very first call.
  const due = t - layers.lastAnim >= ANIM_STEP || t < layers.lastAnim;
  layers.animFresh = due;
  if (due) {
    layers.lastAnim = t;
    layers.anim.clear();
  }
  return layers;
}

export function drawBackdrop(
  g: Graphics,
  w: number,
  h: number,
  t: number,
  a = 0x10132a,
  b = 0x050510,
): void {
  const layers = backdropLayers(g, t);
  const still = layers?.still ?? g;
  const anim = layers?.anim ?? g;
  const key = `${w}|${h}|${a}|${b}`;
  if (!layers || layers.stillKey !== key) {
    if (layers) {
      layers.stillKey = key;
      still.clear();
    }
    still.rect(0, 0, w, h).fill({ color: b });
    for (let x = 0; x < w; x += 32) still.rect(x, 0, 1, h).fill({ color: a, alpha: 0.2 });
  }
  if (!layers || layers.animFresh) {
    for (let y = -24; y < h + 48; y += 24) {
      const yy = (y + ((t * 18) % 24)) | 0;
      anim.rect(0, yy, w, 1).fill({ color: a, alpha: 0.35 });
    }
  }
}
