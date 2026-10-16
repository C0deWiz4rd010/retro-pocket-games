import { el } from '@utils/dom';
import { enterPop } from './motion';

let idCounter = 0;

const FOCUSABLE = 'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';

/**
 * Trap Tab inside `panel` and move focus into it. Returns a cleanup that removes the trap.
 * `initialFocus` picks the element to focus first (default: the first focusable control).
 */
export function trapFocus(
  overlay: HTMLElement,
  panel: HTMLElement,
  initialFocus?: HTMLElement | null,
): () => void {
  const focusables = (): HTMLElement[] =>
    [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (n) => !n.hasAttribute('disabled') && n.offsetParent !== null,
    );
  (initialFocus ?? focusables()[0])?.focus();
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Tab') return;
    const items = focusables();
    if (!items.length) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  overlay.addEventListener('keydown', onKey);
  return () => overlay.removeEventListener('keydown', onKey);
}

/** Make `panel` an accessible modal: role, aria-modal and a label taken from its title. */
export function markAsDialog(panel: HTMLElement, label?: string): void {
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  const title = panel.querySelector<HTMLElement>(
    '.panel__title, .onboard__title, [data-dialog-title]',
  );
  if (title && title.textContent?.trim()) {
    if (!title.id) title.id = `dlg-title-${++idCounter}`;
    panel.setAttribute('aria-labelledby', title.id);
  } else if (label) {
    panel.setAttribute('aria-label', label);
  }
}

export interface DialogHandle {
  overlay: HTMLElement;
  close(): void;
}

/**
 * Show `panel` as a modal dialog over `parent`: focus trap, Escape to dismiss, a labelled
 * dialog role, and focus returned to whatever opened it. One implementation for every dialog.
 */
export function openDialog(opts: {
  parent: HTMLElement;
  panel: HTMLElement;
  overlayClass?: string;
  /** Escape / outside click close the dialog (default true). */
  dismissible?: boolean;
  label?: string;
  initialFocus?: HTMLElement | null;
  onClose?: () => void;
}): DialogHandle {
  const { parent, panel, dismissible = true } = opts;
  markAsDialog(panel, opts.label);
  const overlay = el(
    'div',
    { class: `overlay${opts.overlayClass ? ` ${opts.overlayClass}` : ''}` },
    [panel],
  );
  overlay.dataset.overlay = '1';
  const returnFocus = document.activeElement as HTMLElement | null;
  parent.append(overlay);
  enterPop(panel);
  const untrap = trapFocus(overlay, panel, opts.initialFocus);

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    untrap();
    overlay.remove();
    if (returnFocus?.isConnected) returnFocus.focus();
    opts.onClose?.();
  };
  if (dismissible) {
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  }
  return { overlay, close };
}
