import { el } from '@utils/dom';
import { GAMES, getGame } from '@core/Registry';
import { loadScores, getBest } from '@store/scores';
import { loadLeaderboard, getEntries } from '@store/leaderboard';
import { t } from '@i18n/index';

/**
 * Scores hub. With no argument it lists every game's personal best (linking into detail);
 * with a gameId it shows that game's local top-10 leaderboard.
 */
export async function renderScores(gameId?: string): Promise<HTMLElement> {
  if (gameId && getGame(gameId)) return renderOne(gameId);
  return renderAll();
}

async function renderAll(): Promise<HTMLElement> {
  const available = GAMES.filter((g) => g.available);
  await Promise.all(available.map((g) => loadScores(g.id)));
  const withScores = available
    .map((g) => ({ g, best: getBest(g.id) }))
    .filter((x) => x.best > 0)
    .sort((a, b) => b.best - a.best);

  const list =
    withScores.length === 0
      ? el('div', { class: 'lb-empty' }, [t('lb.empty')])
      : el(
          'div',
          { class: 'score-list' },
          withScores.map(({ g, best }) =>
            el('button', { class: 'score-row', onClick: () => (location.hash = `#/scores/${g.id}`) }, [
              el('span', { class: 'score-row__glyph' }, [g.glyph]),
              el('span', { class: 'score-row__title' }, [g.title]),
              el('span', { class: 'score-row__best' }, [`★ ${best.toLocaleString()}`]),
            ]),
          ),
        );

  return el('div', { class: 'scroll' }, [el('div', { class: 'section-title' }, [t('scores.title')]), list]);
}

async function renderOne(gameId: string): Promise<HTMLElement> {
  const meta = getGame(gameId)!;
  await loadLeaderboard(gameId);
  const entries = getEntries(gameId);

  const board =
    entries.length === 0
      ? el('div', { class: 'lb-empty' }, [t('lb.empty')])
      : el(
          'div',
          { class: 'lb-list' },
          entries.map((e, i) =>
            el('div', { class: `lb-row${i === 0 ? ' lb-row--top' : ''}` }, [
              el('span', { class: 'lb-row__rank' }, [`${i + 1}`]),
              el('span', { class: 'lb-row__name' }, [e.name]),
              el('span', { class: 'lb-row__score' }, [e.score.toLocaleString()]),
            ]),
          ),
        );

  return el('div', { class: 'scroll' }, [
    el('div', { class: 'lb-hero' }, [
      el('div', { class: 'lb-hero__glyph' }, [meta.glyph]),
      el('div', { class: 'lb-hero__title' }, [meta.title]),
      el('button', { class: 'btn btn--primary', onClick: () => (location.hash = `#/play/${gameId}`) }, [
        `▶  ${t('home.playToday')}`,
      ]),
    ]),
    el('div', { class: 'section-title' }, [t('lb.title')]),
    board,
  ]);
}
