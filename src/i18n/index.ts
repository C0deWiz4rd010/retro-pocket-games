import { settings } from '@store/settings';
import { en } from './en';
import { de } from './de';

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
