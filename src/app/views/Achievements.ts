import { el } from '@utils/dom';
import { ACHIEVEMENTS, achievements, isUnlocked, unlockedCount } from '@store/achievements';
import { audio } from '@core/AudioManager';
import { t } from '@i18n/index';

type Filter = 'all' | 'unlocked' | 'locked';

/** The Achievements screen: a progress header, filter tabs, and a grid of badges. */
export function renderAchievements(): HTMLElement {
  const total = ACHIEVEMENTS.length;
  let filter: Filter = 'all';

  const container = el('div', { class: 'scroll' });
  const grid = el('div', { class: 'ach-grid' });

  const tabBtn = (f: Filter, label: string): HTMLElement =>
    el('button', {
      class: `seg-tab${filter === f ? ' on' : ''}`,
      'data-f': f,
      onClick: () => {
        filter = f;
        audio.sfx('blip');
        sync();
      },
    }, [label]);

  const tabs = el('div', { class: 'ach-tabs' }, [
    tabBtn('all', t('ach.all')),
    tabBtn('unlocked', t('ach.filterUnlocked')),
    tabBtn('locked', t('ach.filterLocked')),
  ]);

  const sync = (): void => {
    const got = unlockedCount();
    const pct = Math.round((got / total) * 100);
    bar.style.width = `${pct}%`;
    count.textContent = `${got} / ${total}`;
    tabs.querySelectorAll('.seg-tab').forEach((b) =>
      b.classList.toggle('on', (b as HTMLElement).dataset.f === filter),
    );
    renderGrid();
  };

  const renderGrid = (): void => {
    const unlockedAt = achievements().unlocked;
    // Unlocked first (most recent at top), then locked.
    const sorted = [...ACHIEVEMENTS].sort((a, b) => {
      const ua = unlockedAt[a.id] ?? 0;
      const ub = unlockedAt[b.id] ?? 0;
      if (ua && ub) return ub - ua;
      if (ua) return -1;
      if (ub) return 1;
      return 0;
    });
    const visible = sorted.filter((a) => {
      const u = isUnlocked(a.id);
      return filter === 'all' || (filter === 'unlocked' ? u : !u);
    });
    grid.replaceChildren(
      ...(visible.length
        ? visible.map((a) => card(a, unlockedAt[a.id]))
        : [el('div', { class: 'lb-empty' }, ['—'])]),
    );
  };

  const count = el('div', { class: 'ach-header__count' }, ['']);
  const bar = el('i', {});
  const header = el('div', { class: 'ach-header' }, [
    count,
    el('div', { class: 'xpbar', style: 'margin:8px 0' }, [bar]),
    el('div', { style: 'color:var(--text-muted);font-size:12px' }, [
      t('ach.progress', { a: unlockedCount(), b: total }),
    ]),
  ]);

  container.append(header, tabs, grid);
  sync();
  return container;
}

function card(a: (typeof ACHIEVEMENTS)[number], at: number | undefined): HTMLElement {
  const unlocked = Boolean(at);
  const hidden = a.secret && !unlocked;
  return el('div', { class: `ach-card${unlocked ? ' is-unlocked' : ''}` }, [
    el('div', { class: 'ach-card__icon' }, [hidden ? '❔' : a.icon]),
    el('div', { class: 'ach-card__body' }, [
      el('div', { class: 'ach-card__title' }, [hidden ? '???' : a.title]),
      el('div', { class: 'ach-card__desc' }, [hidden ? t('ach.locked') : a.desc]),
      unlocked && at ? el('div', { class: 'ach-card__date' }, [new Date(at).toLocaleDateString()]) : '',
    ]),
    el('div', { class: 'ach-card__reward' }, [unlocked ? '✓' : `🪙${a.tokens}`]),
  ]);
}
