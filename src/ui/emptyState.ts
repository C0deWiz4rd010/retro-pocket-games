import { el } from '@utils/dom';
import { icon, type IconName } from './icons';

/**
 * Consistent "nothing here" block: a large muted icon, a headline, an optional hint, and an
 * optional recovery action (e.g. clear filters) so the user is never left at a dead end.
 */
export function emptyState(opts: {
  icon: IconName;
  title: string;
  hint?: string;
  action?: { label: string; onClick: () => void };
}): HTMLElement {
  const children: (Node | string)[] = [
    el('div', { class: 'empty-state__icon' }, [icon(opts.icon)]),
    el('div', { class: 'empty-state__title' }, [opts.title]),
  ];
  if (opts.hint) children.push(el('div', { class: 'empty-state__hint' }, [opts.hint]));
  if (opts.action)
    children.push(
      el('button', { class: 'btn btn--ghost', onClick: opts.action.onClick }, [opts.action.label]),
    );
  return el('div', { class: 'empty-state', role: 'status' }, children);
}
