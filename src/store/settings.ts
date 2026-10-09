import { signal, effect } from './store';
import { read, write } from '@data/db';
import { SettingsSchema, type Settings } from '@data/schemas';
import { fxState } from '@core/fxState';

const defaults = SettingsSchema.parse({});

export const settings = signal<Settings>(defaults);

let loaded = false;

/** Load persisted settings, apply them to the DOM, and start auto-persisting on change. */
export async function loadSettings(): Promise<void> {
  const stored = await read('settings', '_', SettingsSchema, defaults);
  settings.set(stored);
  applyToDom(stored);
  if (!loaded) {
    loaded = true;
    // Persist + reflect any future change.
    effect(() => {
      const s = settings();
      applyToDom(s);
      if (loaded) {
        persistSoon(s);
        for (const fn of listeners) fn(s);
      }
    });
  }
}

// Sliders fire a change per input event; coalesce writes so IndexedDB isn't hit dozens of times.
let pending: Settings | null = null;
let persistTimer = 0;
function persistSoon(s: Settings): void {
  pending = s;
  window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(flushSettings, 300);
}
function flushSettings(): void {
  window.clearTimeout(persistTimer);
  if (!pending) return;
  const s = pending;
  pending = null;
  void write('settings', '_', s);
}
// Never lose the last change when the tab is hidden or closed.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSettings();
  });
  window.addEventListener('pagehide', flushSettings);
}

/** Side-effect hooks fired after each settings change (music sync, CRT shader, ...). */
const listeners = new Set<(s: Settings) => void>();
export function onSettingsChange(fn: (s: Settings) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Shallow-merge a settings patch. */
export function updateSettings(patch: Partial<Settings>): void {
  settings.update((s) => ({ ...s, ...patch }));
}

let lastPaletteKey = '';

function applyToDom(s: Settings): void {
  const root = document.documentElement;
  root.dataset.theme = s.theme;
  root.dataset.skin = s.skin;
  root.dataset.shell = s.shell;
  root.dataset.fx = s.screenFx.mode === 'full' && fxState.forcedCss ? 'css' : s.screenFx.mode;
  root.dataset.colorblind = s.a11y.colorblind;
  root.classList.toggle('a11y-reduced-motion', s.a11y.reducedMotion);
  root.classList.toggle('a11y-high-contrast', s.a11y.highContrast);
  root.classList.toggle('a11y-large-targets', s.a11y.largeTargets);
  root.style.setProperty('--fx-intensity', String(s.screenFx.intensity));
  root.style.setProperty('--touch-opacity', String(s.controls.touchOpacity));
  root.style.setProperty('--touch-scale', String(s.controls.touchScale));

  // Keep the browser/OS chrome color in sync with the active theme's background. Reading the
  // computed style forces a style recalc, so only do it when the palette can actually change.
  const paletteKey = `${s.theme}|${s.a11y.highContrast}`;
  if (paletteKey === lastPaletteKey) return;
  lastPaletteKey = paletteKey;
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  if (bg) {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', bg);
  }
}
