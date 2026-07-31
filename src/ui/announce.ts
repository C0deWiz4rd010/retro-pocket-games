/**
 * Screen-reader announcements via a single polite ARIA live region. Visual-only game state
 * (score, game over) is otherwise silent for assistive tech; call `announce()` for key moments.
 */
let region: HTMLElement | null = null;

function ensureRegion(): HTMLElement {
  if (!region) {
    region = document.createElement('div');
    region.className = 'visually-hidden';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('role', 'status');
    document.body.appendChild(region);
  }
  return region;
}

/** Politely announce a message to screen readers (re-announces even if text repeats). */
export function announce(text: string): void {
  const el = ensureRegion();
  el.textContent = '';
  // A microtask gap makes assistive tech re-read identical consecutive messages.
  requestAnimationFrame(() => {
    el.textContent = text;
  });
}
