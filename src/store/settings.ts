import { signal, effect } from './store';
import { read, write } from '@data/db';
import { SettingsSchema, type Settings } from '@data/schemas';

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
        void write('settings', '_', s);
        void onChange?.(s);
      }
    });
  }
}

/** Optional side-effect hook fired after each settings change (set by main on boot). */
let onChange: ((s: Settings) => void) | undefined;
export function onSettingsChange(fn: (s: Settings) => void): void {
  onChange = fn;
}

/** Shallow-merge a settings patch. */
export function updateSettings(patch: Partial<Settings>): void {
  settings.update((s) => ({ ...s, ...patch }));
}

function applyToDom(s: Settings): void {
  const root = document.documentElement;
  root.dataset.theme = s.theme;
  root.dataset.skin = s.skin;
  root.dataset.shell = s.shell;
  root.dataset.fx = s.screenFx.mode;
  root.dataset.colorblind = s.a11y.colorblind;
  root.classList.toggle('a11y-reduced-motion', s.a11y.reducedMotion);
  root.classList.toggle('a11y-high-contrast', s.a11y.highContrast);
  root.classList.toggle('a11y-large-targets', s.a11y.largeTargets);
  root.style.setProperty('--fx-intensity', String(s.screenFx.intensity));

  // Keep the browser/OS chrome color in sync with the active theme's background.
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
