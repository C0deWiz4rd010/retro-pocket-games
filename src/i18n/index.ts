import { settings } from '@store/settings';
import { en } from './en';
import { de } from './de';
import { COLLECTION_DE, GAME_BLURB_DE } from './content.de';

export type Dict = Record<string, string>;
const DICTS: Record<string, Dict> = { en, de };

/**
 * Tiny translation helper. `t('home.daily')` resolves against the active locale, falling
 * back to English then to the key itself. Supports `{name}` interpolation.
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const locale = settings().locale;
  const dict = DICTS[locale] ?? en;
  let str = dict[key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) str = str.replace(`{${k}}`, String(v));
  return str;
}

/** Detect a sensible default locale from the browser on first run. */
export function detectLocale(): 'en' | 'de' {
  return (navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';
}

/**
 * Localize a canonical English control hint word (e.g. "Move", "Fire") for display. Hints stay
 * English in the registry (used for search + precomputed tutorials); this only skins the live
 * UI chrome, falling back to the original word when no translation exists.
 */
export function hintLabel(word: string): string {
  const key = `hint.${word.toLowerCase()}`;
  const val = t(key);
  return val === key ? word : val;
}

/** Localized one-line description of a game (falls back to the English registry text). */
export function gameBlurb(g: { id: string; blurb: string }): string {
  return settings().locale === 'de' ? (GAME_BLURB_DE[g.id] ?? g.blurb) : g.blurb;
}

export function collectionLabel(c: { id: string; label: string }): string {
  return settings().locale === 'de' ? (COLLECTION_DE[c.id]?.label ?? c.label) : c.label;
}

export function collectionBlurb(c: { id: string; blurb: string }): string {
  return settings().locale === 'de' ? (COLLECTION_DE[c.id]?.blurb ?? c.blurb) : c.blurb;
}

/** The three first-run tutorial lines for a game: what it is, how to control it, its category. */
export function gameTutorialSteps(g: {
  id: string;
  blurb: string;
  group: string;
  controls?: { hints: string[] };
}): string[] {
  const hints = g.controls?.hints ?? [];
  return [
    gameBlurb(g),
    hints.length
      ? `${t('tut.controls')}: ${hints.map(hintLabel).join(' / ')}`
      : t('tut.tapTargets'),
    t(`group.${g.group.toLowerCase()}`),
  ];
}
