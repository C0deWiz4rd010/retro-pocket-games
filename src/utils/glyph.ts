import { EMOJI_MAP } from '@core/emojiMap';
import { el } from '@utils/dom';

const BASE = import.meta.env.BASE_URL;
const SVG_NS = 'http://www.w3.org/2000/svg';

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
  const file = EMOJI_MAP[glyph];
  const cls = className ? ` ${className}` : '';
  if (file) {
    // One shared sprite (public/emoji/sprite.svg, built by scripts/build-emoji-sprite.mjs) instead
    // of one image request per glyph.
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', `emoji${cls}`);
    svg.setAttribute('viewBox', '0 0 72 72');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', `${BASE}emoji/sprite.svg#e-${file.replace('.svg', '')}`);
    svg.append(use);
    return svg as unknown as HTMLElement;
  }
  return el('span', { class: `emoji-mono${cls}`, 'aria-hidden': 'true' }, [glyph]);
}
