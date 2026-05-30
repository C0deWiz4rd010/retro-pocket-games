import { settings } from '@store/settings';

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
};
