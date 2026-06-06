import { el } from '@utils/dom';
import { GAMES } from '@core/Registry';
import { t } from '@i18n/index';

const REPO = 'https://github.com/C0deWiz4rd010/retro-pocket-games';

/** About / credits: version, catalog size, tech stack and links. */
export function renderAbout(): HTMLElement {
  const count = GAMES.filter((g) => g.available).length;
  const version = import.meta.env.VITE_APP_VERSION ?? '1.0';

  const link = (href: string, label: string): HTMLElement =>
    el('a', { class: 'btn btn--ghost btn--block', href, target: '_blank', rel: 'noopener' }, [label]);

  return el('div', { class: 'scroll' }, [
    el('div', { class: 'about-hero' }, [
      el('div', { class: 'about-hero__logo' }, ['● RETRO POCKET']),
      el('div', { class: 'about-hero__tag' }, [t('about.tagline', { n: count })]),
      el('div', { class: 'about-hero__version' }, [`v${version}`]),
    ]),
    el('div', { class: 'section-title' }, [t('about.tech')]),
    el('div', { class: 'about-tech' }, [
      el('span', {}, ['TypeScript']),
      el('span', {}, ['PixiJS v8']),
      el('span', {}, ['Vite']),
      el('span', {}, ['PWA']),
      el('span', {}, ['Web Audio']),
      el('span', {}, ['IndexedDB']),
    ]),
    el('div', { class: 'section-title' }, [t('about.links')]),
    link(REPO, '⌨  GitHub'),
    link(`${REPO}/issues`, '🐞  ' + t('about.report')),
    el('div', { style: 'text-align:center;color:var(--text-muted);font-size:11px;padding:20px 0' }, [
      t('about.madeWith'),
    ]),
  ]);
}
