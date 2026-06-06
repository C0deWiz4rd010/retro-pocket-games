import { settings } from '@store/settings';

/** Per-event vibration patterns (ms). Keyed by the shared SFX names so any game that plays
 *  a sound gets matching haptic feedback for free. Subtle events are omitted (no buzz). */
const SFX_PATTERN: Record<string, number | number[]> = {
  eat: 8,
  coin: 12,
  jump: 10,
  shoot: 6,
  hit: [0, 30, 20, 30],
  explosion: [0, 40, 30, 50],
  powerup: [0, 15, 10, 25],
  clear: [0, 20, 15, 20],
  levelup: [0, 25, 20, 40],
  gameover: [0, 60, 40, 60, 40, 90],
};

/** navigator.vibrate wrapper that respects the user's haptics setting. */
export const haptics = {
  tick(): void {
    if (settings().controls.haptics) navigator.vibrate?.(8);
  },
  bump(): void {
    if (settings().controls.haptics) navigator.vibrate?.(24);
  },
  pattern(p: number | number[]): void {
    if (settings().controls.haptics) navigator.vibrate?.(p);
  },
  /** Fire the vibration that matches a sound effect, if one is mapped. */
  forSfx(name: string): void {
    const p = SFX_PATTERN[name];
    if (p !== undefined && settings().controls.haptics) navigator.vibrate?.(p);
  },
};
