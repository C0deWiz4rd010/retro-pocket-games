import { el } from '@utils/dom';
import { glyphEl } from '@utils/glyph';
import { profile, xpForLevel } from '@store/profile';
import { unlockedCount, ACHIEVEMENTS } from '@store/achievements';
import { daily } from '@store/dailyStore';
import { GAMES, getGame } from '@core/Registry';
import { t } from '@i18n/index';

/** Compact play-time formatter ("3h 12m" / "12m" / "<1m"). */
function formatPlayTime(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 1) return '<1m';
  const h = Math.floor(min / 60);
  return h > 0 ? `${h}h ${min % 60}m` : `${min}m`;
}

/** Player profile: level/XP, tokens, lifetime stats, favorite game, streak, achievements. */
export function renderProfile(): HTMLElement {
  const p = profile();
  const need = xpForLevel(p.level);
  const pct = Math.min(100, Math.round((p.xp / need) * 100));

  // Most-played game = "favorite".
  let favId = '';
  let favPlays = 0;
  for (const [id, n] of Object.entries(p.stats.perGamePlays)) {
    if (n > favPlays) {
      favPlays = n;
      favId = id;
    }
  }
  const favMeta = favId ? getGame(favId) : undefined;
  const distinct = Object.keys(p.stats.perGamePlays).length;

  const stat = (val: string | number, label: string): HTMLElement =>
    el('div', { class: 'statcard' }, [
      el('div', { class: 'statcard__val' }, [String(val)]),
      el('div', { class: 'statcard__label' }, [label]),
    ]);

  return el('div', { class: 'scroll' }, [
    // level header
    el('div', { class: 'profile-hero' }, [
      el('div', { class: 'profile-hero__level' }, [`Lv.${p.level}`]),
      el('div', { class: 'xpbar', style: 'margin:10px 0 4px' }, [el('i', { style: `width:${pct}%` })]),
      el('div', { style: 'color:var(--text-muted);font-size:12px' }, [`${p.xp} / ${need} XP`]),
    ]),
    el('div', { class: 'statgrid' }, [
      stat(`🪙 ${p.tokens}`, t('home.tokens')),
      stat(p.stats.gamesPlayed, t('home.played')),
      stat(p.stats.totalScore.toLocaleString(), t('home.totalScore')),
      stat(`${distinct}/${GAMES.filter((g) => g.available).length}`, t('home.unlocked')),
      stat(`🔥 ${daily().bestStreak}`, t('profile.bestStreak')),
      stat(`🏆 ${unlockedCount()}/${ACHIEVEMENTS.length}`, t('nav.achievements')),
      stat(`⏱ ${formatPlayTime(p.stats.playTimeMs)}`, t('profile.playTime')),
    ]),
    favMeta
      ? el('button', {
          class: 'fav-game',
          onClick: () => (location.hash = `#/play/${favMeta.id}`),
        }, [
          el('span', { class: 'fav-game__glyph' }, [glyphEl(favMeta.glyph)]),
          el('div', {}, [
            el('div', { class: 'fav-game__label' }, [t('profile.favorite')]),
            el('div', { class: 'fav-game__title' }, [`${favMeta.title} · ${favPlays}×`]),
          ]),
        ])
      : '',
    el('div', { class: 'panel__row', style: 'margin-top:14px' }, [
      el('button', { class: 'btn btn--ghost btn--block', onClick: () => (location.hash = '#/achievements') }, [
        `🏆 ${t('nav.achievements')}`,
      ]),
      el('button', { class: 'btn btn--ghost btn--block', onClick: () => (location.hash = '#/scores') }, [
        `🏅 ${t('nav.scores')}`,
      ]),
    ]),
  ]);
}
