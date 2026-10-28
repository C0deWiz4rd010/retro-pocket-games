import type { TextStyleOptions } from 'pixi.js';

export interface Vec {
  x: number;
  y: number;
}

/** Cardinal directions keyed by InputManager action name. */
export const DIRS: Readonly<Record<string, Vec>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const PIXEL_FONT = 'VT323, monospace';

/** Pixel-font text style for in-canvas labels. */
export function pixelText(
  fontSize: number,
  fill: number | string = 0xffffff,
  extra: Partial<TextStyleOptions> = {},
): TextStyleOptions {
  return { fontFamily: PIXEL_FONT, fontSize, fill, ...extra };
}
