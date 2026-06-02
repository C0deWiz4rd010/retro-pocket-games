import { el } from '@utils/dom';
import { ACHIEVEMENTS, achievements, isUnlocked, unlockedCount } from '@store/achievements';
import { t } from '@i18n/index';

/** The Achievements screen: a progress header + a grid of locked/unlocked badges. */
export function renderAchievements(): HTMLElement {
  const total = ACHIEVEMENTS.length;
  const got = unlockedCount();
  const pct = Math.round((got / total) * 100);
  const unlockedAt = achievements().unlocked;

  const header = el('div', { class: 'ach-header' }, [
    el('div', { class: 'ach-header__count' }, [`${got} / ${total}`]),
    el('div', { class: 'xpbar', style: 'margin:8px 0' }, [el('i', { style: `width:${pct}%` })]),
    el('div', { style: 'color:var(--text-muted);font-size:12px' }, [t('ach.progress', { a: got, b: total })]),
  ]);

  const grid = el(
    'div',
    { class: 'ach-grid' },
    ACHIEVEMENTS.map((a) => {
      const unlocked = isUnlocked(a.id);
      const hidden = a.secret && !unlocked;
      const at = unlockedAt[a.id];
      return el('div', { class: `ach-card${unlocked ? ' is-unlocked' : ''}` }, [
        el('div', { class: 'ach-card__icon' }, [hidden ? '❔' : a.icon]),
        el('div', { class: 'ach-card__body' }, [
          el('div', { class: 'ach-card__title' }, [hidden ? '???' : a.title]),
          el('div', { class: 'ach-card__desc' }, [hidden ? t('ach.locked') : a.desc]),
          unlocked && at
            ? el('div', { class: 'ach-card__date' }, [new Date(at).toLocaleDateString()])
            : '',
        ]),
        el('div', { class: 'ach-card__reward' }, [unlocked ? '✓' : `🪙${a.tokens}`]),
      ]);
    }),
  );

  return el('div', { class: 'scroll' }, [header, grid]);
}
