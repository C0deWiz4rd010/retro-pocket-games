import { EMOJI_MAP } from '@core/emojiMap';
import { el } from '@utils/dom';

const BASE = import.meta.env.BASE_URL;

/** Resolve a catalog glyph to its bundled OpenMoji SVG URL, or null for non-emoji monograms. */
export function emojiSrc(glyph: string): string | null {
  const file = EMOJI_MAP[glyph];
  return file ? `${BASE}emoji/${file}` : null;
}

/**
 * Render a catalog glyph: a crisp OpenMoji SVG image when the glyph is a known emoji, otherwise
 * the raw text (used by lettered monogram covers like "PD"). Sizing follows the parent's
 * font-size via `1em`, so existing glyph CSS keeps working unchanged.
 */
export function glyphEl(glyph: string, className = ''): HTMLElement {
  const src = emojiSrc(glyph);
  const cls = className ? ` ${className}` : '';
  if (src) {
    return el('img', { class: `emoji${cls}`, src, alt: glyph, loading: 'lazy', draggable: false });
  }
  return el('span', { class: `emoji-mono${cls}` }, [glyph]);
}
