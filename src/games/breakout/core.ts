/** Pure physics helpers for Breakout (kept free of Pixi so they can be unit-tested). */

export interface Vel {
  vx: number;
  vy: number;
}

/** Ball speed for a level: ramps up, but never beyond what the paddle can still return. */
export function levelSpeed(level: number): number {
  return Math.min(280 + level * 18, 520);
}

/**
 * Velocity after the ball hits the paddle. `hit` is the contact point from -1 (left edge) to
 * 1 (right edge); the bounce angle follows it (±60°) and the speed is preserved.
 */
export function paddleBounce(hit: number, speed: number): Vel {
  const h = Math.max(-1, Math.min(1, hit));
  const angle = h * (Math.PI / 3);
  return { vx: Math.sin(angle) * speed, vy: -Math.cos(angle) * speed };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Reflect a ball (radius r) off a brick on the axis of least penetration, so a hit on the side
 * of a brick flips vx and a hit on its top/bottom flips vy. Returns null when there is no overlap.
 */
export function brickReflect(
  ball: { x: number; y: number } & Vel,
  r: number,
  brick: Rect,
): Vel | null {
  if (
    ball.x + r <= brick.x ||
    ball.x - r >= brick.x + brick.w ||
    ball.y + r <= brick.y ||
    ball.y - r >= brick.y + brick.h
  )
    return null;
  const overlapX = Math.min(ball.x + r - brick.x, brick.x + brick.w - (ball.x - r));
  const overlapY = Math.min(ball.y + r - brick.y, brick.y + brick.h - (ball.y - r));
  if (overlapX < overlapY) {
    const left = ball.x < brick.x + brick.w / 2;
    return { vx: left ? -Math.abs(ball.vx) : Math.abs(ball.vx), vy: ball.vy };
  }
  const above = ball.y < brick.y + brick.h / 2;
  return { vx: ball.vx, vy: above ? -Math.abs(ball.vy) : Math.abs(ball.vy) };
}
