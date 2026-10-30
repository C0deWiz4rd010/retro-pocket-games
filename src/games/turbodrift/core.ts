/** Pure helpers for Turbo Drift (a winding road, drift charge and mini-turbos). */

/** Centre line of the road (screen x) at distance `d` travelled along the track. */
export function roadCenter(d: number, width: number): number {
  const amp = Math.min(width * 0.26, 40 + d / 90);
  return width / 2 + Math.sin(d * 0.0042) * amp + Math.sin(d * 0.0013 + 1.3) * amp * 0.45;
}

/** Road width narrows slowly with distance but stays drivable. */
export function roadWidth(d: number, width: number): number {
  return Math.max(width * 0.42, width * 0.66 - d / 1500);
}

/** Cruising speed in px/s for a distance, capped. */
export function cruiseSpeed(d: number): number {
  return Math.min(420, 190 + d / 55);
}

/** Drift charge gained this frame: needs real sideways speed, grows with it. */
export function driftGain(vx: number, dt: number): number {
  const s = Math.abs(vx);
  if (s < 110) return 0;
  return Math.min(1, (s - 110) / 220) * dt * 1.1;
}

/** Mini-turbo from a released drift: nothing below 0.3 charge, otherwise up to 1.6 s. */
export function boostFromCharge(charge: number): { seconds: number; points: number } {
  if (charge < 0.3) return { seconds: 0, points: 0 };
  const c = Math.min(1, charge);
  return { seconds: 0.5 + c * 1.1, points: Math.round(150 + c * 450) };
}
