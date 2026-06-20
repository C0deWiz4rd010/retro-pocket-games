import { el } from '@utils/dom';
import { audio } from '@core/AudioManager';
import { t } from '@i18n/index';

interface Screen { glyph: string; title: string; body: string }

const SCREENS: () => Screen[] = () => [
  { glyph: '🕹️', title: t('onboard.s1t'), body: t('onboard.s1b') },
  { glyph: '▶️', title: t('onboard.s2t'), body: t('onboard.s2b') },
  { glyph: '⭐', title: t('onboard.s3t'), body: t('onboard.s3b') },
  { glyph: '📅', title: t('onboard.s4t'), body: t('onboard.s4b') },
  { glyph: '📲', title: t('onboard.s5t'), body: t('onboard.s5b') },
];

/**
 * First-run app onboarding: a 5-screen carousel explaining Retro Pocket, XP/tokens, the
 * daily challenge, touch controls and installing the PWA. Calls `onDone` when finished/skipped.
 */
export function showOnboarding(onDone: () => void): HTMLElement {
  const screens = SCREENS();
  let i = 0;

  const glyph = el('div', { class: 'onboard__glyph' });
  const title = el('div', { class: 'onboard__title' });
  const body = el('div', { class: 'onboard__body' });
  const dots = el('div', { class: 'onboard__dots' }, screens.map(() => el('span', { class: 'onboard__dot' })));
  const nextBtn = el('button', { class: 'btn btn--primary btn--block' }, []);

  const render = (): void => {
    const s = screens[i]!;
    glyph.textContent = s.glyph;
    title.textContent = s.title;
    body.textContent = s.body;
    Array.from(dots.children).forEach((d, k) => d.classList.toggle('is-on', k === i));
    nextBtn.textContent = i === screens.length - 1 ? t('onboard.start') : t('onboard.next');
  };

  const finish = (): void => {
    overlay.remove();
    onDone();
  };

  nextBtn.addEventListener('click', () => {
    audio.sfx('blip');
    if (i < screens.length - 1) {
      i++;
      render();
    } else {
      audio.sfx('coin');
      finish();
    }
  });

  const skip = el('button', { class: 'onboard__skip', onClick: () => finish() }, [t('onboard.skip')]);

  const card = el('div', { class: 'onboard__card', role: 'dialog', 'aria-modal': 'true' }, [
    skip,
    glyph,
    title,
    body,
    dots,
    nextBtn,
  ]);
  const overlay = el('div', { class: 'overlay onboard' }, [card]);
  overlay.dataset.overlay = '1';
  render();
  return overlay;
}
