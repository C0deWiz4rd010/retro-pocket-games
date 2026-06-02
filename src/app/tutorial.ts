import { el } from '@utils/dom';
import { t } from '@i18n/index';
import type { GameMeta, Kit } from '@core/Registry';

/** Generic control-hint i18n keys per engine-kit — shown once before a game's first play. */
const HINT_KEY: Record<Kit, string> = {
  grid: 'tut.grid',
  shooter: 'tut.shooter',
  paddle: 'tut.paddle',
  vector: 'tut.vector',
  sidescroll: 'tut.sidescroll',
  standalone: 'tut.standalone',
};

/**
 * Show a one-time "How to Play" overlay. Calls `onStart` when dismissed. The host decides
 * whether to call this (based on prefs.hasSeenTutorial). Localized + keyboard-dismissable.
 */
export function showTutorial(meta: GameMeta, onStart: () => void): HTMLElement {
  const start = (): void => {
    overlay.remove();
    window.removeEventListener('keydown', onKey);
    onStart();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (['Enter', 'Space', 'KeyZ', 'Escape'].includes(e.code)) {
      e.preventDefault();
      start();
    }
  };
  window.addEventListener('keydown', onKey);

  const panel = el('div', { class: 'panel' }, [
    el('div', { class: 'tut__glyph' }, [meta.glyph]),
    el('div', { class: 'panel__title' }, [meta.title.toUpperCase()]),
    el('div', { style: 'color:var(--text-muted);font-size:13px' }, [meta.blurb]),
    el('div', { class: 'tut__hint' }, [t(HINT_KEY[meta.kit])]),
    el('button', { class: 'btn btn--primary btn--block', onClick: start }, [`▶  ${t('tut.start')}`]),
  ]);
  const overlay = el('div', { class: 'overlay' }, [panel]);
  overlay.dataset.overlay = '1';
  return overlay;
}
