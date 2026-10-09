/**
 * Runtime display-quality state shared by ScreenFX, PerfMonitor and the settings store. Lives in
 * its own module so settings can read it without importing the Pixi-dependent ScreenFX
 * (which would create an import cycle).
 */
export const fxState = {
  /** The FPS monitor dropped the CRT shader to the CSS layer; stays so for this session. */
  forcedCss: false,
};
