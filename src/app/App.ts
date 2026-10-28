import { el, clear, mount } from '@utils/dom';
import { glyphEl } from '@utils/glyph';
import { audio } from '@core/AudioManager';
import {
  COLLECTIONS,
  GAMES,
  GROUP_ORDER,
  getGame,
  type GameCollection,
  type GameMeta,
  type GameMode,
} from '@core/Registry';
import { profile, xpForLevel } from '@store/profile';
import {
  getBest,
  getLastPlayed,
  getCustomBest,
  preloadScores,
  clearAllLastPlayed,
} from '@store/scores';
import { currentStreak, playedToday, last7Days } from '@store/dailyStore';
import { isFavorite, toggleFavorite, hasOnboarded, markOnboarded } from '@store/prefs';
import { showOnboarding } from './onboarding';
import type { GameHost } from './GameHost';
import { renderSettings } from './views/Settings';
import { renderBios } from './views/Bios';
import { renderAchievements } from './views/Achievements';
import { renderScores } from './views/Scores';
import { renderProfile } from './views/Profile';
import { renderAbout } from './views/About';
import { pickDailyGame, dailySeed, dailyModifier, nextDailyLabel } from './daily';
import {
  t,
  hintLabel,
  gameBlurb,
  collectionLabel as localCollectionLabel,
  collectionBlurb as localCollectionBlurb,
  gameTutorialSteps,
} from '@i18n/index';
import { icon } from '@ui/icons';
import { emptyState } from '@ui/emptyState';
import { openDialog, trapFocus } from '@ui/dialog';
import { ACHIEVEMENTS, isUnlocked } from '@store/achievements';

/** Games whose `custom` payload carries a meaningful secondary best worth showing on the tile. */
const CUSTOM_BEST: Record<string, { key: string; label: string }> = {
  snake: { key: 'length', label: 'cb.len' },
  tetris: { key: 'level', label: 'cb.lvl' },
  invaders: { key: 'wave', label: 'cb.wave' },
  asteroids: { key: 'wave', label: 'cb.wave' },
  galaga: { key: 'wave', label: 'cb.wave' },
  breakout: { key: 'level', label: 'cb.lvl' },
  stacker: { key: 'height', label: 'cb.h' },
  doodle: { key: 'height', label: 'cb.h' },
  simon: { key: 'len', label: 'cb.seq' },
  tron: { key: 'wins', label: 'cb.wins' },
  reversi: { key: 'discs', label: 'cb.discs' },
};

type LibrarySort = 'recommended' | 'recent' | 'popular' | 'score' | 'new' | 'az';

/** The application shell: builds the device layout, owns navigation and the active game. */
export class App {
  private view!: HTMLElement; // swappable DOM layer inside the screen
  private nav!: HTMLElement; // mobile drawer
  private rail!: HTMLElement; // persistent launcher rail
  private scrim!: HTMLElement;
  private host: GameHost | null = null;
  private screenEl!: HTMLElement;
  private engine: Promise<typeof import('./GameHost')> | null = null;
  private engineReady = false;
  /** Bumped on every navigation so a game launch that was still loading can abort. */
  private launchSeq = 0;
  private homeFilter: GameMeta['group'] | 'all' = 'all';
  private homeCollection: GameCollection | null = null;
  private libraryQuery = '';
  private libraryActive = new Set<string>();
  private librarySort: LibrarySort = 'recommended';
  private runModes = new Map<string, GameMode>();
  /** Live handles into the rendered home screen, so taps can patch instead of re-render. */
  private homeRefs: {
    favHost: HTMLElement;
    gamesHost: HTMLElement;
    libTitle: HTMLElement;
  } | null = null;
  /** Per-render memo: cleared whenever the home screen is rebuilt (scores may have changed). */
  private memo = {
    mastery: new Map<string, number>(),
    ach: new Map<string, { total: number; unlocked: number }>(),
    last: undefined as GameMeta | null | undefined,
    tiles: new Map<string, HTMLElement>(),
  };
  private searchTimer = 0;

  async init(): Promise<void> {
    const screen = el('div', { class: 'screen' });
    this.view = el('div', { class: 'screen__view' });
    const crt = el('div', { class: 'screen__crt' });
    this.nav = el('nav', { class: 'nav', 'aria-label': t('nav.games') });
    this.scrim = el('div', { class: 'nav__scrim', onClick: () => this.closeNav() });
    screen.append(crt, this.view, this.scrim, this.nav);

    const device = el('div', { class: 'device' }, [
      el('div', { class: 'device__brand' }, [
        el('span', {}, ['● RETRO POCKET']),
        el('span', { class: 'led' }),
      ]),
      screen,
      el(
        'div',
        { class: 'device__grille' },
        Array.from({ length: 6 }, () => el('i', {})),
      ),
    ]);

    this.rail = el('aside', { class: 'rail', 'aria-label': t('nav.navigation') });

    mount(el('div', { class: 'frame' }, [this.rail, device]));

    this.screenEl = screen;
    this.buildNav();
    this.nav.inert = true; // closed until opened
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.nav.classList.contains('open')) this.closeNav();
    });

    window.addEventListener('hashchange', () => this.route());
    window.addEventListener('pointerdown', () => audio.unlock(), { once: true });

    // Auto-pause an active game when the tab is hidden / loses focus, and (optionally) mute.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.host?.pauseExternal();
        audio.setMutedByBlur(true);
      } else {
        audio.setMutedByBlur(false);
      }
    });
    window.addEventListener('blur', () => {
      this.host?.pauseExternal();
      audio.setMutedByBlur(true);
    });
    window.addEventListener('focus', () => audio.setMutedByBlur(false));

    // Global "?" opens the keyboard shortcuts help (ignored while typing).
    window.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === '?' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        this.toggleKeyboardHelp();
      }
    });

    this.route();
    this.preloadEngineWhenIdle();

    // First-run onboarding (5 screens) over the home screen.
    if (!hasOnboarded() && (location.hash === '' || location.hash === '#/')) {
      const ov = showOnboarding(() => markOnboarded());
      (document.querySelector('.screen') ?? document.body).append(ov);
    }
  }

  private toggleKeyboardHelp(): void {
    const existing = document.querySelector('.kbd-help');
    if (existing) {
      existing.remove();
      return;
    }
    const rowsData: [string, string][] = [
      ['◀ ▶ ▲ ▼', t('kbd.move')],
      ['Z / Space', t('kbd.action')],
      ['X', t('kbd.action2')],
      ['Enter', t('kbd.start')],
      ['Esc / P', t('kbd.pause')],
      ['?', t('kbd.help')],
    ];
    const panel = el('div', { class: 'panel' }, [
      el('div', { class: 'panel__title' }, [t('kbd.title')]),
      ...rowsData.map(([k, v]) =>
        el('div', { class: 'kbd-row' }, [el('kbd', {}, [k]), el('span', {}, [v])]),
      ),
      el('button', { class: 'btn btn--primary btn--block', onClick: () => dlg.close() }, [
        t('game.resume'),
      ]),
    ]);
    const dlg = openDialog({
      parent: document.querySelector<HTMLElement>('.screen__view') ?? document.body,
      panel,
      overlayClass: 'kbd-help',
    });
  }

  /**
   * PixiJS + the game host are ~150 KB gzipped and not needed to show the menus, so they load on
   * demand (and are prefetched when the browser is idle). Shared by every launch.
   */
  private loadEngine(): Promise<typeof import('./GameHost')> {
    this.engine ??= (async () => {
      const [{ pixi }, hostModule] = await Promise.all([
        import('@core/PixiManager'),
        import('./GameHost'),
      ]);
      await pixi.init(this.screenEl);
      this.engineReady = true;
      return hostModule;
    })().catch((err) => {
      this.engine = null; // allow a retry after a network failure
      throw err;
    });
    return this.engine;
  }

  /** On the first launch (engine not prefetched yet, e.g. slow network) show a loading state. */
  private async loadEngineWithSpinner(): Promise<typeof import('./GameHost')> {
    if (this.engineReady) return this.loadEngine();
    const spinner = el('div', { class: 'overlay overlay--load', role: 'status' }, [
      el('div', { class: 'loader' }),
      el('div', { class: 'loader__text' }, [t('game.loading')]),
    ]);
    this.screenEl.append(spinner);
    try {
      return await this.loadEngine();
    } finally {
      spinner.remove();
    }
  }

  private preloadEngineWhenIdle(): void {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return; // respect Data Saver
    const run = (): void => void this.loadEngine().catch(() => undefined);
    // Safari lacks requestIdleCallback.
    const idle = (window as Window & { requestIdleCallback?: typeof requestIdleCallback })
      .requestIdleCallback;
    if (idle) idle(run, { timeout: 4000 });
    else window.setTimeout(run, 2000);
  }

  private route(): void {
    this.launchSeq++;
    this.memo.mastery.clear();
    this.memo.ach.clear();
    this.memo.last = undefined;
    this.memo.tiles.clear();
    const hash = location.hash.replace(/^#\/?/, '');
    const [section, arg] = hash.split('/');
    this.teardownGame();
    this.closeNav();
    this.view.classList.remove('is-home');

    // Menu music plays everywhere except inside an active game.
    if (section === 'play' || section === 'daily') audio.stopMusic();
    else audio.startMusic();

    if (section === 'play' && arg) {
      void this.renderGameStart(arg);
    } else if (section === 'settings') {
      this.renderSettings();
    } else if (section === 'achievements') {
      this.renderAchievements();
    } else if (section === 'scores') {
      void this.renderScores(arg);
    } else if (section === 'profile') {
      this.renderProfile();
    } else if (section === 'about') {
      this.renderAbout();
    } else if (section === 'surprise') {
      this.surpriseMe();
    } else if (section === 'bios') {
      this.renderBios();
    } else if (section === 'daily') {
      void this.launchDaily();
    } else {
      if (section === 'collection' && arg) this.homeCollection = arg as GameCollection;
      void this.renderHome();
    }
  }

  go(path: string): void {
    if (location.hash === `#/${path}`) this.route();
    else location.hash = `#/${path}`;
  }

  private powerOn(): void {
    this.view.classList.remove('power-on');
    void this.view.offsetWidth; // reflow to restart animation
    this.view.classList.add('power-on');
  }

  // ───────────────────────────── home / dashboard ─────────────────────────────
  private async renderHome(): Promise<void> {
    const available = GAMES.filter((g) => g.available).map((g) => g.id);
    await preloadScores(available);

    this.memo.mastery.clear();
    this.memo.ach.clear();
    this.memo.last = undefined;
    this.memo.tiles.clear();
    window.clearTimeout(this.searchTimer);
    clear(this.view);
    this.view.classList.remove('is-game');
    this.view.classList.add('is-home');
    this.powerOn();
    this.markActiveNav('home');

    const topbar = el('div', { class: 'topbar' }, [
      el(
        'button',
        {
          class: 'iconbtn topbar__menu',
          'aria-label': t('nav.menu'),
          'aria-expanded': 'false',
          onClick: () => this.openNav(),
        },
        [icon('menu')],
      ),
      el('div', { class: 'topbar__title' }, ['RETRO POCKET']),
      el(
        'button',
        { class: 'iconbtn', 'aria-label': t('home.surprise'), onClick: () => this.surpriseMe() },
        [icon('surprise')],
      ),
      el(
        'button',
        { class: 'iconbtn', 'aria-label': 'Settings', onClick: () => this.go('settings') },
        [icon('settings')],
      ),
    ]);

    // Live search: when non-empty, the grouped grid collapses to a flat filtered result.
    const gamesHost = el('div', { class: 'library-stage' });
    const search = el('input', {
      class: 'search',
      type: 'search',
      placeholder: t('home.search'),
      'aria-label': t('home.search'),
      onInput: (e: Event) => {
        const value = (e.target as HTMLInputElement).value.trim().toLowerCase();
        window.clearTimeout(this.searchTimer);
        this.searchTimer = window.setTimeout(() => {
          this.libraryQuery = value;
          this.refreshLibrary();
        }, 120);
      },
    });
    search.value = this.libraryQuery;
    const favHost = el('div', { class: 'section-host' }, this.favoritesSection());
    const libTitle = el('h2', { class: 'library-head__title' });
    const filters = this.libraryFilters();
    const sort = this.sortControls();
    this.homeRefs = { favHost, gamesHost, libTitle };
    this.syncLibraryTitle();
    gamesHost.append(this.libraryStage());

    const body = el('div', { class: 'scroll landing' }, [
      this.heroDaily(),
      this.dailyHistory(),
      this.statsRow(),
      ...this.continueSection(),
      favHost,
      ...this.recommendedSection(),
      this.collectionsSection(),
      el('div', { class: 'library-head' }, [
        el('div', { class: 'tile__body' }, [
          el('div', { class: 'section-title' }, [t('home.library')]),
          libTitle,
        ]),
        el('button', { class: 'btn btn--ghost', onClick: () => this.surpriseMe() }, [
          icon('surprise'),
          t('home.surprise'),
        ]),
      ]),
      el('div', { class: 'search-wrap' }, [
        el('span', { class: 'search-wrap__icon' }, [icon('search')]),
        search,
      ]),
      filters,
      sort,
      gamesHost,
      ...this.welcomeSection(),
    ]);

    this.view.append(topbar, body, this.bottomNav('home'));
  }

  private syncLibraryTitle(): void {
    if (!this.homeRefs) return;
    this.homeRefs.libTitle.textContent = this.homeCollection
      ? this.collectionLabel(this.homeCollection)
      : t('home.libraryTitle');
  }

  /** Re-apply the current filter/sort state to the library only (no full home re-render). */
  private refreshLibrary(): void {
    const refs = this.homeRefs;
    if (!refs) return;
    this.syncLibraryTitle();
    for (const chip of this.view.querySelectorAll<HTMLElement>('.cat-chip')) {
      const key = chip.dataset.filter;
      const group = chip.dataset.group;
      const sort = chip.dataset.sort;
      const on =
        key !== undefined
          ? this.libraryActive.has(key)
          : group !== undefined
            ? group === this.homeFilter && !this.homeCollection
            : sort === this.librarySort;
      chip.classList.toggle('is-active', on);
      chip.setAttribute('aria-pressed', String(on));
    }
    for (const card of this.view.querySelectorAll<HTMLElement>('.collection-card'))
      card.classList.toggle('is-active', card.dataset.collection === this.homeCollection);
    refs.gamesHost.replaceChildren(this.libraryStage());
  }

  /** Favourite toggled: flip every star for that game in place and patch the dependent bits. */
  private onFavoriteChanged(id: string): void {
    const on = isFavorite(id);
    for (const star of this.view.querySelectorAll<HTMLElement>('.tile__fav')) {
      if (star.dataset.fav !== id) continue;
      star.classList.toggle('is-fav', on);
      star.setAttribute('aria-pressed', String(on));
    }
    this.homeRefs?.favHost.replaceChildren(...this.favoritesSection());
    if (this.libraryActive.has('favorite')) this.refreshLibrary();
  }

  /** A friendly hint shown only to brand-new players (nothing played yet). */
  private welcomeSection(): HTMLElement[] {
    if (profile().stats.gamesPlayed > 0) return [];
    return [
      el('div', { class: 'welcome' }, [
        el('div', { class: 'welcome__emoji' }, ['👾']),
        el('div', { class: 'welcome__title' }, [t('home.welcome')]),
        el('div', { class: 'welcome__hint' }, [t('home.welcomeHint')]),
        el('button', { class: 'btn btn--primary', onClick: () => this.surpriseMe() }, [
          `🎲  ${t('home.surprise')}`,
        ]),
      ]),
    ];
  }

  /** Last-7-days daily completion strip. */
  private dailyHistory(): HTMLElement | string {
    const days = last7Days();
    if (!days.some((d) => d.played)) return '';
    const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return el(
      'div',
      { class: 'daily-strip' },
      days.map((d) =>
        el('div', { class: `daily-dot${d.played ? ' is-played' : ''}` }, [
          el('span', { class: 'daily-dot__d' }, [labels[d.weekday] ?? '']),
          el('span', { class: 'daily-dot__mark' }, [d.played ? '🔥' : '·']),
        ]),
      ),
    );
  }

  private searchText(g: GameMeta): string {
    return [
      g.title,
      g.blurb,
      gameBlurb(g),
      g.group,
      g.kit,
      g.orientation,
      g.difficulty,
      g.sessionLength,
      ...(g.tags ?? []),
      ...(g.controls?.hints ?? []),
      ...(g.collections ?? []),
    ]
      .join(' ')
      .toLowerCase();
  }

  private favoritesSection(): HTMLElement[] {
    const favs = GAMES.filter((g) => g.available && isFavorite(g.id));
    if (!favs.length) return [];
    return [
      el('div', { class: 'section-title' }, [t('home.favorites')]),
      el(
        'div',
        { class: 'tilegrid' },
        favs.map((g) => this.tile(g)),
      ),
    ];
  }

  private recommendedSection(): HTMLElement[] {
    const recent = GAMES.filter((g) => g.available && getLastPlayed(g.id) > 0).sort(
      (a, b) => getLastPlayed(b.id) - getLastPlayed(a.id),
    );
    const played = new Set(recent.map((g) => g.id));
    const anchor = recent[0];
    const picks = GAMES.filter((g) => g.available && !played.has(g.id))
      .sort((a, b) => this.recommendScore(b, anchor) - this.recommendScore(a, anchor))
      .slice(0, 6);
    if (!picks.length) return [];
    return [
      el('div', { class: 'section-title' }, [t('home.recommended')]),
      el(
        'div',
        { class: 'tilegrid tilegrid--compact' },
        picks.map((g) => this.tile(g)),
      ),
    ];
  }

  private recommendScore(g: GameMeta, anchor?: GameMeta): number {
    let score = 0;
    if (anchor && g.group === anchor.group) score += 6;
    if (anchor && g.kit === anchor.kit) score += 4;
    if (g.collections?.includes('quick')) score += 3;
    if (g.collections?.includes('neon')) score += 2;
    score += Math.max(0, 3 - this.masteryRank(g));
    return score;
  }

  private collectionsSection(): HTMLElement {
    return el('div', { class: 'collections' }, [
      el('div', { class: 'section-title' }, [t('home.cabinets')]),
      el(
        'div',
        { class: 'collection-grid' },
        COLLECTIONS.map((c) => {
          const count = GAMES.filter((g) => g.available && g.collections?.includes(c.id)).length;
          return el(
            'button',
            {
              class: `collection-card${this.homeCollection === c.id ? ' is-active' : ''}`,
              'data-collection': c.id,
              onClick: () => {
                this.homeCollection = c.id;
                this.homeFilter = 'all';
                this.refreshLibrary();
                this.view
                  .querySelector('.library-head')
                  ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
              },
            },
            [
              el('div', { class: 'collection-card__label' }, [localCollectionLabel(c)]),
              el('div', { class: 'collection-card__blurb' }, [localCollectionBlurb(c)]),
              el('div', { class: 'collection-card__count' }, [t('home.gamesCount', { n: count })]),
            ],
          );
        }),
      ),
    ]);
  }

  private heroDaily(): HTMLElement {
    const meta = pickDailyGame();
    const mod = dailyModifier(meta);
    const streak = currentStreak();
    const done = playedToday();
    const children: (Node | string)[] = [
      el('div', { class: 'hero__visual', style: `--tile-accent:${meta.accent}` }, [
        this.tileCover(meta),
      ]),
      el('div', { class: 'hero__content' }, [
        el('div', { class: 'hero__tag' }, [t('home.daily')]),
        el('div', { class: 'hero__title' }, [meta.title]),
        el('div', { class: 'hero__sub' }, [gameBlurb(meta)]),
        el('div', { class: 'hero__mod' }, [t(mod.label)]),
        el('button', { class: 'btn btn--primary' }, [
          icon('play'),
          done ? t('home.done') : t('home.playToday'),
        ]),
      ]),
    ];
    // After today's run, show a live countdown to the next challenge instead of a streak only.
    if (done) {
      children.push(el('div', { class: 'hero__next' }, [t('home.next', { t: nextDailyLabel() })]));
    }
    if (streak > 0)
      children.push(el('div', { class: 'hero__streak' }, [t('home.streak', { n: streak })]));
    return el('a', { class: 'hero', href: '#/daily' }, children);
  }

  /** Surprise me: jump straight into a random available game. */
  private surpriseMe(): void {
    const pool = GAMES.filter((g) => g.available);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) {
      audio.sfx('select');
      this.go(`play/${pick.id}`);
    }
  }

  private statsRow(): HTMLElement {
    const p = profile();
    const need = xpForLevel(p.level);
    const pct = Math.min(100, Math.round((p.xp / need) * 100));
    const card = (val: string | number, label: string): HTMLElement =>
      el('div', { class: 'statcard' }, [
        el('div', { class: 'statcard__val' }, [String(val)]),
        el('div', { class: 'statcard__label' }, [label]),
      ]);
    return el('div', { class: 'statgrid' }, [
      el('a', { class: 'statcard statcard--link', href: '#/profile' }, [
        el('div', { class: 'statcard__val' }, [`Lv.${p.level}`]),
        el('div', { class: 'xpbar', style: 'margin-top:6px' }, [
          el('i', { style: `width:${pct}%` }),
        ]),
        el('div', { class: 'statcard__label' }, [`${p.xp}/${need} XP`]),
      ]),
      card(`🪙 ${p.tokens}`, t('home.tokens')),
      card(p.stats.gamesPlayed, t('home.played')),
      card(p.stats.totalScore.toLocaleString(), t('home.totalScore')),
      this.achievementsCard(),
    ]);
  }

  private achievementsCard(): HTMLElement {
    return el(
      'a',
      {
        class: 'statcard statcard--link',
        href: '#/achievements',
      },
      [
        el('div', { class: 'statcard__val' }, ['🏆']),
        el('div', { class: 'statcard__label' }, [t('nav.achievements')]),
      ],
    );
  }

  private continueSection(): HTMLElement[] {
    const recent = GAMES.filter((g) => g.available && getLastPlayed(g.id) > 0).sort(
      (a, b) => getLastPlayed(b.id) - getLastPlayed(a.id),
    );
    if (!recent.length) return [];
    const cards = recent.slice(0, 8).map((g) =>
      el(
        'button',
        {
          class: 'continue-card',
          style: `--ca:${g.accent}`,
          onClick: () => this.go(`play/${g.id}`),
        },
        [
          el('div', { class: 'g' }, [glyphEl(g.glyph)]),
          el('div', { class: 't' }, [g.title]),
          el('div', { class: 's' }, [`★ ${getBest(g.id)}`]),
          el('div', { class: 'ago' }, [this.timeAgo(getLastPlayed(g.id))]),
        ],
      ),
    );
    const header = el('div', { class: 'section-title section-title--row' }, [
      el('span', {}, [t('home.recent')]),
      el('button', { class: 'section-title__action', onClick: () => this.clearHistory() }, [
        t('home.clear'),
      ]),
    ]);
    return [header, el('div', { class: 'continue-row' }, cards)];
  }

  /** Human "x ago" for the continue cards. */
  private timeAgo(ts: number): string {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return t('time.now');
    const m = Math.floor(s / 60);
    if (m < 60) return t('time.min', { n: m });
    const h = Math.floor(m / 60);
    if (h < 24) return t('time.hour', { n: h });
    return t('time.day', { n: Math.floor(h / 24) });
  }

  private clearHistory(): void {
    audio.sfx('select');
    clearAllLastPlayed();
    void this.renderHome();
  }

  private libraryFilters(): HTMLElement {
    const chip = (key: string, label: string): HTMLElement =>
      el(
        'button',
        {
          class: `cat-chip${this.libraryActive.has(key) ? ' is-active' : ''}`,
          'data-filter': key,
          'aria-pressed': String(this.libraryActive.has(key)),
          onClick: () => {
            audio.sfx('blip');
            if (this.libraryActive.has(key)) this.libraryActive.delete(key);
            else this.libraryActive.add(key);
            this.refreshLibrary();
          },
        },
        [label],
      );

    const groupChip = (group: GameMeta['group'] | 'all'): HTMLElement =>
      el(
        'button',
        {
          class: `cat-chip${group === this.homeFilter ? ' is-active' : ''}`,
          'data-group': group,
          'aria-pressed': String(group === this.homeFilter && !this.homeCollection),
          onClick: () => {
            audio.sfx('blip');
            this.homeFilter = group;
            this.homeCollection = null;
            this.refreshLibrary();
          },
        },
        [group === 'all' ? t('filter.allGenres') : t(`group.${group.toLowerCase()}`)],
      );

    return el('div', { class: 'filter-panel' }, [
      this.filterRow(
        t('filter.genre'),
        (['all', ...GROUP_ORDER] as (GameMeta['group'] | 'all')[]).map(groupChip),
      ),
      this.filterRow(t('filter.duration'), [
        chip('duration:quick', t('dur.quick')),
        chip('duration:medium', t('dur.medium')),
        chip('duration:deep', t('dur.deep')),
      ]),
      this.filterRow(t('filter.difficulty'), [
        chip('difficulty:easy', t('fdiff.easy')),
        chip('difficulty:medium', t('fdiff.medium')),
        chip('difficulty:hard', t('fdiff.hard')),
        chip('difficulty:variable', t('fdiff.variable')),
      ]),
      this.filterRow(t('filter.control'), [
        chip('control:tap', t('hint.tap')),
        chip('control:swipe', t('hint.swipe')),
        chip('control:drag', t('hint.drag')),
        chip('control:grid', t('hint.dpad')),
        chip('control:shooter', t('filter.shooter')),
        chip('control:vector', t('filter.vector')),
      ]),
      this.filterRow(t('filter.progress'), [
        chip('progress:unplayed', t('prog.unplayed')),
        chip('progress:played', t('prog.played')),
        chip('progress:in-progress', t('prog.inprogress')),
        chip('progress:mastered', t('badge.mastered')),
      ]),
      this.filterRow(t('filter.special'), [
        chip('favorite', t('spec.favorites')),
        chip('daily', t('spec.dailyReady')),
        chip('score', t('spec.scoreChasers')),
        chip('status:new', t('badge.new')),
        chip('status:hot', t('badge.hot')),
      ]),
    ]);
  }

  private filterRow(label: string, chips: HTMLElement[]): HTMLElement {
    return el('div', { class: 'filter-row' }, [
      el('div', { class: 'filter-row__label' }, [label]),
      el('div', { class: 'cat-chips cat-chips--library' }, chips),
    ]);
  }

  private sortControls(): HTMLElement {
    const options: { id: LibrarySort; label: string }[] = [
      { id: 'recommended', label: t('sort.recommended') },
      { id: 'recent', label: t('sort.recent') },
      { id: 'popular', label: t('sort.popular') },
      { id: 'score', label: t('sort.score') },
      { id: 'new', label: t('badge.new') },
      { id: 'az', label: t('sort.az') },
    ];
    return el('div', { class: 'sort-row' }, [
      el('div', { class: 'filter-row__label' }, [t('filter.sort')]),
      el(
        'div',
        { class: 'cat-chips cat-chips--library' },
        options.map((option) =>
          el(
            'button',
            {
              class: `cat-chip${this.librarySort === option.id ? ' is-active' : ''}`,
              'data-sort': option.id,
              'aria-pressed': String(this.librarySort === option.id),
              onClick: () => {
                audio.sfx('blip');
                this.librarySort = option.id;
                this.refreshLibrary();
              },
            },
            [option.label],
          ),
        ),
      ),
    ]);
  }

  private gamesByGroup(filter: GameMeta['group'] | 'all' = 'all'): HTMLElement {
    const wrap = el('div', {});
    const pool = this.filteredSortedGames().filter((g) => filter === 'all' || g.group === filter);
    const groups = GROUP_ORDER.filter((g) => pool.some((x) => x.group === g));

    for (const group of groups) {
      const games = pool.filter((g) => g.group === group);
      wrap.append(el('div', { class: 'section-title', id: `grp-${group}` }, [group.toUpperCase()]));
      const grid = el(
        'div',
        { class: 'tilegrid' },
        games.map((g) => this.libTile(g)),
      );
      wrap.append(grid);
    }
    if (!pool.length) wrap.append(this.noMatches());
    return wrap;
  }

  private libraryStage(): HTMLElement {
    if (!this.homeCollection) return this.gamesByGroup(this.homeFilter);
    const games = this.filteredSortedGames().filter((g) =>
      g.collections?.includes(this.homeCollection!),
    );
    return el('div', {}, [
      el('div', { class: 'library-note' }, [this.collectionBlurb(this.homeCollection)]),
      games.length
        ? el(
            'div',
            { class: 'tilegrid' },
            games.map((g) => this.libTile(g)),
          )
        : this.noMatches(),
    ]);
  }

  /** Empty library result with a one-tap way back to the full list. */
  private noMatches(): HTMLElement {
    return emptyState({
      icon: 'search',
      title: t('empty.library.title'),
      hint: t('empty.library.hint'),
      action: {
        label: t('empty.library.clear'),
        onClick: () => {
          this.libraryQuery = '';
          this.libraryActive.clear();
          this.homeFilter = 'all';
          this.homeCollection = null;
          const input = this.view.querySelector<HTMLInputElement>('.search');
          if (input) input.value = '';
          this.refreshLibrary();
        },
      },
    });
  }

  private filteredSortedGames(): GameMeta[] {
    const query = this.libraryQuery;
    const games = GAMES.filter((g) => g.available)
      .filter((g) => !query || this.searchText(g).includes(query))
      .filter((g) => this.matchesActiveFilters(g));
    if (this.librarySort === 'az') return games.sort((a, b) => a.title.localeCompare(b.title));
    const key = new Map(games.map((g) => [g.id, this.sortValue(g)] as const));
    return games.sort((a, b) => key.get(b.id)! - key.get(a.id)! || a.title.localeCompare(b.title));
  }

  private matchesActiveFilters(g: GameMeta): boolean {
    for (const key of this.libraryActive) {
      const [kind, value] = key.split(':');
      if (kind === 'duration' && g.sessionLength !== value) return false;
      if (kind === 'difficulty' && g.difficulty !== value) return false;
      if (kind === 'control' && g.controls?.preset !== value) return false;
      if (kind === 'progress' && !this.matchesProgress(g, value ?? '')) return false;
      if (kind === 'status' && !this.statusBadges(g).some((badge) => badge.toLowerCase() === value))
        return false;
      if (key === 'favorite' && !isFavorite(g.id)) return false;
      if (key === 'daily' && !g.dailyRules) return false;
      if (key === 'score' && !g.collections?.includes('score')) return false;
    }
    return true;
  }

  private matchesProgress(g: GameMeta, progress: string): boolean {
    const played = (profile().stats.perGamePlays[g.id] ?? 0) > 0;
    const rank = this.masteryRank(g);
    if (progress === 'unplayed') return !played;
    if (progress === 'played') return played;
    if (progress === 'in-progress') return played && rank > 0 && rank < 3;
    if (progress === 'mastered') return rank >= 3;
    return true;
  }

  private sortValue(g: GameMeta): number {
    if (this.librarySort === 'recent') return getLastPlayed(g.id);
    if (this.librarySort === 'popular') return profile().stats.perGamePlays[g.id] ?? 0;
    if (this.librarySort === 'score') return getBest(g.id);
    if (this.librarySort === 'new')
      return g.polish?.release === 'new' ? 2 : g.polish?.release === 'featured' ? 1 : 0;
    return this.recommendScore(g, this.lastPlayedGame());
  }

  private lastPlayedGame(): GameMeta | undefined {
    if (this.memo.last === undefined) {
      this.memo.last =
        GAMES.filter((g) => g.available && getLastPlayed(g.id) > 0).sort(
          (a, b) => getLastPlayed(b.id) - getLastPlayed(a.id),
        )[0] ?? null;
    }
    return this.memo.last ?? undefined;
  }

  /** Library tiles are built once per home render and just re-parented when filters change. */
  private libTile(g: GameMeta): HTMLElement {
    let node = this.memo.tiles.get(g.id);
    if (!node) {
      node = this.tile(g);
      this.memo.tiles.set(g.id, node);
    }
    return node;
  }

  private tile(g: GameMeta): HTMLElement {
    const best = g.available ? getBest(g.id) : 0;
    const mastery = this.masteryRank(g);
    const achievements = this.achievementProgressFor(g);
    const badges = g.available ? this.statusBadges(g) : ['Locked'];
    const rank = this.cardRank(g);
    return el(
      'article',
      {
        class: `tile tile--rank-${rank}${g.available ? '' : ' tile--soon'}${mastery >= 3 ? ' is-mastered' : ''}`,
        style: `--tile-accent:${g.accent}`,
      },
      [
        // The whole card is one real link (keyboard + screen reader friendly); the favourite
        // button is its sibling, so interactive elements are never nested.
        el('a', {
          class: 'tile__hit',
          href: g.available ? `#/play/${g.id}` : undefined,
          'aria-disabled': g.available ? undefined : 'true',
          'aria-label': [
            g.title,
            g.available
              ? best
                ? t('tile.best', { n: best })
                : t('tile.noScore')
              : t('tile.comingSoon'),
          ].join('. '),
        }),
        el(
          'div',
          { class: 'tile__badges' },
          badges.map((badge) =>
            el('span', { class: `tile__badge tile__badge--${badge.toLowerCase()}` }, [
              t(`badge.${badge.toLowerCase()}`),
            ]),
          ),
        ),
        g.available ? this.favStar(g.id) : '',
        this.tileCover(g),
        g.available
          ? el(
              'div',
              {
                class: `mastery mastery--${mastery}`,
                role: 'img',
                'aria-label': t('tile.masteryAria', { n: mastery }),
              },
              [el('i', { style: `width:${(mastery / 3) * 100}%` })],
            )
          : '',
        el('div', { class: 'tile__body', 'aria-hidden': 'true' }, [
          el('div', { class: 'tile__title' }, [g.title]),
          el('div', { class: 'tile__best' }, [
            g.available
              ? best
                ? t('tile.best', { n: best })
                : t('tile.noScore')
              : t('tile.comingSoon'),
          ]),
          el('div', { class: 'tile__meta' }, [`${this.sessionLabel(g)} / ${this.controlLabel(g)}`]),
          el('div', { class: 'tile__stats' }, [
            this.tileStat(t('tile.diff'), this.difficultyLabel(g)),
            this.tileStat(t('tile.goal'), String(g.reward?.targetScore ?? 1000)),
            this.tileStat(t('tile.ach'), `${achievements.unlocked}/${achievements.total}`),
          ]),
          g.available ? this.customBestLabel(g.id) : '',
          g.available ? el('div', { class: 'tile__play' }, [t('tile.play')]) : '',
        ]),
      ],
    );
  }

  private tileStat(label: string, value: string): HTMLElement {
    return el('span', { class: 'tile-stat' }, [el('b', {}, [value]), el('small', {}, [label])]);
  }

  private achievementProgressFor(g: GameMeta): { total: number; unlocked: number } {
    const hit = this.memo.ach.get(g.id);
    if (hit) return hit;
    const result = this.computeAchievementProgress(g);
    this.memo.ach.set(g.id, result);
    return result;
  }

  private computeAchievementProgress(g: GameMeta): { total: number; unlocked: number } {
    const achievements = ACHIEVEMENTS.filter(
      (a) => a.id.startsWith(`${g.id}-`) || a.desc.includes(g.title),
    );
    const total = Math.max(1, achievements.length);
    return { total, unlocked: achievements.filter((a) => isUnlocked(a.id)).length };
  }

  private statusBadges(g: GameMeta): string[] {
    const badges: string[] = [];
    if (g.polish?.release === 'new') badges.push('New');
    if (
      g.polish?.release === 'featured' ||
      getBest(g.id) >= (g.polish?.hotScore ?? Number.POSITIVE_INFINITY)
    )
      badges.push('Hot');
    if (g.dailyRules) badges.push('Daily');
    if (this.masteryRank(g) >= 3) badges.push('Mastered');
    return badges.slice(0, 3);
  }

  private cardRank(g: GameMeta): 1 | 2 | 3 {
    const best = getBest(g.id);
    const target = g.reward?.targetScore ?? 1000;
    if (this.masteryRank(g) >= 3 || best >= target * 1.5) return 3;
    if (best >= target || g.polish?.release === 'featured') return 2;
    return 1;
  }

  private difficultyLabel(g: GameMeta): string {
    if (g.difficulty === 'easy') return t('diff.easy');
    if (g.difficulty === 'medium') return t('diff.med');
    if (g.difficulty === 'hard') return t('diff.hard');
    return t('diff.var');
  }

  private sessionLabel(g: GameMeta): string {
    if (g.sessionLength === 'deep')
      return `${g.reward?.sessionMin ?? 4}-${g.reward?.sessionMax ?? 8} min`;
    if (g.sessionLength === 'medium')
      return `${g.reward?.sessionMin ?? 2}-${g.reward?.sessionMax ?? 4} min`;
    return '1-2 min';
  }

  private controlLabel(g: GameMeta): string {
    const first = g.controls?.hints[0];
    if (first) return hintLabel(first);
    if (g.controls?.preset === 'grid') return t('hint.dpad');
    return g.kit;
  }

  private masteryRank(g: GameMeta): number {
    const hit = this.memo.mastery.get(g.id);
    if (hit !== undefined) return hit;
    const rank = this.computeMastery(g);
    this.memo.mastery.set(g.id, rank);
    return rank;
  }

  private computeMastery(g: GameMeta): number {
    const best = getBest(g.id);
    let rank = 0;
    for (const goal of g.masteryGoals ?? []) {
      const value =
        goal.metric === 'score'
          ? best
          : goal.metric === 'plays'
            ? (profile().stats.perGamePlays[g.id] ?? 0)
            : getCustomBest(g.id, goal.customKey ?? '');
      if (value >= goal.target) rank++;
    }
    return Math.min(3, rank);
  }

  private collectionLabel(id: GameCollection): string {
    const c = COLLECTIONS.find((x) => x.id === id);
    return c ? localCollectionLabel(c) : t('home.collection');
  }

  private collectionBlurb(id: GameCollection): string {
    const c = COLLECTIONS.find((x) => x.id === id);
    return c ? localCollectionBlurb(c) : '';
  }

  private tileCover(g: GameMeta): HTMLElement {
    const motif =
      g.cover?.motif ??
      (g.kit === 'paddle'
        ? 'paddle'
        : g.kit === 'shooter'
          ? 'shooter'
          : g.kit === 'vector'
            ? 'vector'
            : 'grid');
    // The game's glyph is the hero of the cover; the motif shapes are a faint animated backdrop.
    const letters = !/\p{Extended_Pictographic}/u.test(g.glyph); // monogram covers (e.g. "PD") get a tighter style
    return el(
      'div',
      {
        class: `tile__cover tile__cover--${motif} tile__cover--${g.polish?.previewSpeed ?? 'medium'}`,
        'aria-hidden': 'true',
      },
      [
        el('i', {}),
        el('i', {}),
        el('i', {}),
        el('i', {}),
        el('div', { class: `tile__cover-art${letters ? ' tile__cover-art--mono' : ''}` }, [
          glyphEl(g.glyph),
        ]),
      ],
    );
  }

  /** A second line with a game-specific personal best (e.g. "lvl 7", "len 42"). */
  private customBestLabel(id: string): Node | string {
    const spec = CUSTOM_BEST[id];
    if (!spec) return '';
    const v = getCustomBest(id, spec.key);
    if (v <= 0) return '';
    return el('div', { class: 'tile__custom' }, [`${t(spec.label)} ${v}`]);
  }

  private favStar(id: string): HTMLElement {
    return el(
      'button',
      {
        class: `tile__fav${isFavorite(id) ? ' is-fav' : ''}`,
        'data-fav': id,
        'aria-label': t('tile.favorite'),
        'aria-pressed': String(isFavorite(id)),
        onClick: (e: Event) => {
          e.stopPropagation();
          toggleFavorite(id);
          audio.sfx('blip');
          this.onFavoriteChanged(id);
        },
      },
      [icon('star')],
    );
  }

  // ───────────────────────────── navigation ─────────────────────────────
  private navItems(): (Node | string)[] {
    const items: (Node | string)[] = [
      el('div', { class: 'nav__head' }, [
        el('span', { class: 'nav__mark' }, ['RP']),
        el('span', {}, ['RETRO POCKET']),
      ]),
      this.navItem(icon('home'), t('nav.home'), () => this.go(''), 'home'),
      this.navItem(icon('daily'), t('nav.daily'), () => this.go('daily'), 'daily'),
      this.navItem(icon('leaderboard'), t('nav.scores'), () => this.go('scores'), 'scores'),
      this.navItem(
        icon('trophy'),
        t('nav.achievements'),
        () => this.go('achievements'),
        'achievements',
      ),
      this.navItem(icon('profile'), t('nav.profile'), () => this.go('profile'), 'profile'),
      this.navItem(icon('info'), t('nav.about'), () => this.go('about'), 'about'),
      this.navItem(icon('settings'), t('nav.settings'), () => this.go('settings'), 'settings'),
    ];
    items.splice(
      2,
      0,
      this.navItem(icon('play'), t('nav.continue'), () => this.goLastPlayed(), 'continue'),
      this.navItem(icon('star'), t('nav.pocketShelf'), () => this.scrollHomeShelf(), 'shelf'),
    );
    items.push(el('div', { class: 'nav__group' }, [t('home.cabinets')]));
    for (const c of COLLECTIONS) {
      items.push(
        this.navItem(
          icon('search'),
          c.label,
          () => this.openCollection(c.id),
          `collection-${c.id}`,
        ),
      );
    }
    return items;
  }

  private buildNav(): void {
    // The drawer and the rail share the same item set (two independent DOM copies).
    this.nav.replaceChildren(...this.navItems());
    this.rail.replaceChildren(...this.navItems());
  }

  private goLastPlayed(): void {
    const recent = GAMES.filter((g) => g.available && getLastPlayed(g.id) > 0).sort(
      (a, b) => getLastPlayed(b.id) - getLastPlayed(a.id),
    )[0];
    if (recent) this.go(`play/${recent.id}`);
    else this.surpriseMe();
  }

  private scrollHomeShelf(): void {
    this.homeCollection = null;
    this.go('');
    window.setTimeout(
      () => this.view.querySelector('.tile__fav.is-fav')?.scrollIntoView({ block: 'center' }),
      80,
    );
  }

  private openCollection(id: GameCollection): void {
    this.homeCollection = id;
    this.homeFilter = 'all';
    this.go(`collection/${id}`);
  }

  private navItem(
    iconNode: Node | string,
    label: string,
    onClick: () => void,
    id: string,
  ): HTMLElement {
    return el('button', { class: 'nav__item', 'data-nav': id, onClick }, [
      el('span', { class: 'nav__icon' }, [iconNode]),
      el('span', {}, [label]),
    ]);
  }

  private markActiveNav(id: string): void {
    for (const root of [this.nav, this.rail]) {
      root.querySelectorAll('.nav__item').forEach((n) => n.classList.remove('active'));
      root.querySelector(`[data-nav="${id}"]`)?.classList.add('active');
    }
  }

  private navReturnFocus: HTMLElement | null = null;
  private navUntrap: (() => void) | null = null;

  private openNav(): void {
    audio.sfx('blip');
    this.navReturnFocus = document.activeElement as HTMLElement | null;
    this.nav.inert = false;
    this.nav.classList.add('open');
    this.scrim.classList.add('open');
    this.syncMenuButtons(true);
    // The drawer behaves like a modal on phones: keep Tab inside it until it closes.
    this.navUntrap = trapFocus(this.nav, this.nav);
  }
  private closeNav(): void {
    const wasOpen = this.nav.classList.contains('open');
    this.nav.classList.remove('open');
    this.scrim.classList.remove('open');
    // Closed drawer items must not stay in the tab order or the accessibility tree.
    this.nav.inert = true;
    this.syncMenuButtons(false);
    this.navUntrap?.();
    this.navUntrap = null;
    if (wasOpen && this.navReturnFocus?.isConnected) this.navReturnFocus.focus();
    this.navReturnFocus = null;
  }
  private syncMenuButtons(expanded: boolean): void {
    for (const b of document.querySelectorAll('.topbar__menu'))
      b.setAttribute('aria-expanded', String(expanded));
  }

  // ───────────────────────────── settings / bios ─────────────────────────────
  private bottomNav(active: 'home' | 'daily' | 'scores' | 'profile' | 'shelf'): HTMLElement {
    const item = (
      id: typeof active,
      iconName: Parameters<typeof icon>[0],
      label: string,
      onClick: () => void,
    ): HTMLElement =>
      el('button', { class: `bottom-tab${active === id ? ' active' : ''}`, onClick }, [
        icon(iconName),
        el('span', {}, [label]),
      ]);
    return el('nav', { class: 'bottom-nav', 'aria-label': t('nav.primary') }, [
      item('home', 'home', t('nav.home'), () => this.go('')),
      item('daily', 'daily', t('nav.dailyShort'), () => this.go('daily')),
      item('shelf', 'star', t('nav.shelf'), () => this.scrollHomeShelf()),
      item('scores', 'leaderboard', t('nav.scores'), () => this.go('scores')),
      item('profile', 'profile', t('nav.profile'), () => this.go('profile')),
    ]);
  }

  private renderSettings(): void {
    clear(this.view);
    this.view.classList.remove('is-game');
    this.powerOn();
    this.markActiveNav('settings');
    this.view.append(
      el('div', { class: 'topbar' }, [
        el(
          'button',
          {
            class: 'iconbtn topbar__menu',
            'aria-label': t('nav.menu'),
            'aria-expanded': 'false',
            onClick: () => this.openNav(),
          },
          [icon('menu')],
        ),
        el(
          'button',
          { class: 'iconbtn', 'aria-label': t('game.back'), onClick: () => this.go('') },
          [icon('back')],
        ),
        el('div', { class: 'topbar__title' }, ['SETTINGS']),
      ]),
      renderSettings(),
    );
  }

  private renderAchievements(): void {
    clear(this.view);
    this.view.classList.remove('is-game');
    this.powerOn();
    this.markActiveNav('achievements');
    this.view.append(
      el('div', { class: 'topbar' }, [
        el(
          'button',
          {
            class: 'iconbtn topbar__menu',
            'aria-label': t('nav.menu'),
            'aria-expanded': 'false',
            onClick: () => this.openNav(),
          },
          [icon('menu')],
        ),
        el(
          'button',
          { class: 'iconbtn', 'aria-label': t('game.back'), onClick: () => this.go('') },
          [icon('back')],
        ),
        el('div', { class: 'topbar__title' }, [t('ach.title')]),
      ]),
      renderAchievements(),
    );
  }

  private async renderScores(arg?: string): Promise<void> {
    clear(this.view);
    this.view.classList.remove('is-game');
    this.powerOn();
    this.markActiveNav('scores');
    const back = arg ? () => this.go('scores') : () => this.go('');
    this.view.append(
      el('div', { class: 'topbar' }, [
        el(
          'button',
          {
            class: 'iconbtn topbar__menu',
            'aria-label': t('nav.menu'),
            'aria-expanded': 'false',
            onClick: () => this.openNav(),
          },
          [icon('menu')],
        ),
        el('button', { class: 'iconbtn', 'aria-label': t('game.back'), onClick: back }, [
          icon('back'),
        ]),
        el('div', { class: 'topbar__title' }, [t('nav.scores')]),
      ]),
      await renderScores(arg),
    );
  }

  private renderProfile(): void {
    clear(this.view);
    this.view.classList.remove('is-game');
    this.powerOn();
    this.markActiveNav('profile');
    this.view.append(
      el('div', { class: 'topbar' }, [
        el(
          'button',
          {
            class: 'iconbtn topbar__menu',
            'aria-label': t('nav.menu'),
            'aria-expanded': 'false',
            onClick: () => this.openNav(),
          },
          [icon('menu')],
        ),
        el(
          'button',
          { class: 'iconbtn', 'aria-label': t('game.back'), onClick: () => this.go('') },
          [icon('back')],
        ),
        el('div', { class: 'topbar__title' }, [t('nav.profile')]),
      ]),
      renderProfile(),
    );
  }

  private renderAbout(): void {
    clear(this.view);
    this.view.classList.remove('is-game');
    this.powerOn();
    this.markActiveNav('about');
    this.view.append(
      el('div', { class: 'topbar' }, [
        el(
          'button',
          {
            class: 'iconbtn topbar__menu',
            'aria-label': t('nav.menu'),
            'aria-expanded': 'false',
            onClick: () => this.openNav(),
          },
          [icon('menu')],
        ),
        el(
          'button',
          { class: 'iconbtn', 'aria-label': t('game.back'), onClick: () => this.go('') },
          [icon('back')],
        ),
        el('div', { class: 'topbar__title' }, [t('nav.about')]),
      ]),
      renderAbout(),
    );
  }

  private renderBios(): void {
    clear(this.view);
    this.view.classList.remove('is-game');
    this.view.append(renderBios(() => this.go('')));
  }

  // ───────────────────────────── games ─────────────────────────────
  private async renderGameStart(id: string): Promise<void> {
    const meta = getGame(id);
    if (!meta || !meta.available || !meta.loader) {
      void this.renderHome();
      return;
    }
    await preloadScores([meta.id]);
    clear(this.view);
    this.view.classList.remove('is-game');
    this.powerOn();
    this.markActiveNav(meta.id);

    const best = getBest(meta.id);
    const mastery = this.masteryRank(meta);
    const nextGoal = (meta.masteryGoals ?? []).find((goal) => {
      const value =
        goal.metric === 'score'
          ? best
          : goal.metric === 'plays'
            ? (profile().stats.perGamePlays[meta.id] ?? 0)
            : getCustomBest(meta.id, goal.customKey ?? '');
      return value < goal.target;
    });
    const controls = meta.controls?.hints.map(hintLabel).join(' / ') || t('hint.tap');
    const mode = this.runModes.get(meta.id) ?? 'challenge';
    const tip = this.tipFor(meta);
    this.view.append(
      el('div', { class: 'topbar' }, [
        el(
          'button',
          {
            class: 'iconbtn topbar__menu',
            'aria-label': t('nav.menu'),
            'aria-expanded': 'false',
            onClick: () => this.openNav(),
          },
          [icon('menu')],
        ),
        el(
          'button',
          { class: 'iconbtn', 'aria-label': t('game.back'), onClick: () => this.go('') },
          [icon('back')],
        ),
        el('div', { class: 'topbar__title' }, [t('start.cartridge')]),
      ]),
      el('div', { class: 'scroll start-sheet' }, [
        el('div', { class: 'start-card', style: `--tile-accent:${meta.accent}` }, [
          el('div', { class: 'start-card__visual' }, [this.tileCover(meta)]),
          el('div', { class: 'start-card__body' }, [
            el('div', { class: 'hero__tag' }, [
              this.collectionLabel(meta.collections?.[0] ?? 'quick'),
            ]),
            el('h1', { class: 'start-card__title' }, [meta.title]),
            el('p', { class: 'start-card__sub' }, [gameBlurb(meta)]),
            el('div', { class: 'start-stats' }, [
              this.startStat(best ? String(best) : '0', t('start.best')),
              this.startStat(`${mastery}/3`, t('start.mastery')),
              this.startStat(meta.sessionLength ?? 'quick', t('start.session')),
              this.startStat(controls, t('start.controls')),
            ]),
            this.modePicker(meta, mode),
            el('div', { class: 'start-reward' }, [
              el('div', { class: 'start-reward__item' }, [
                el('b', {}, [`${meta.reward?.targetScore ?? 1000}`]),
                el('span', {}, [t('start.targetScore')]),
              ]),
              el('div', { class: 'start-reward__item' }, [
                el('b', {}, [
                  t('start.minutes', {
                    a: meta.reward?.sessionMin ?? 1,
                    b: meta.reward?.sessionMax ?? 2,
                  }),
                ]),
                el('span', {}, [t('start.pocketRun')]),
              ]),
              el('div', { class: 'start-reward__item' }, [
                el('b', {}, [mode === 'practice' ? t('start.noSave') : t('start.rewardsXp')]),
                el('span', {}, [t('start.rewards')]),
              ]),
            ]),
            nextGoal
              ? el('div', { class: 'mission-chip' }, [
                  `${t('start.nextMission')} ${t(nextGoal.label, nextGoal.labelParams)}`,
                ])
              : el('div', { class: 'mission-chip' }, [t('start.masteryDone')]),
            el('div', { class: 'tip-chip' }, [`${t('start.tip')}: ${tip}`]),
            el('div', { class: 'start-actions' }, [
              el(
                'button',
                {
                  class: 'btn btn--primary',
                  onClick: () => void this.launchWithCountdown(meta.id, mode),
                },
                [icon('play'), this.startButtonLabel(mode)],
              ),
              el(
                'button',
                {
                  class: 'btn btn--ghost',
                  onClick: () => {
                    toggleFavorite(meta.id);
                    void this.renderGameStart(meta.id);
                  },
                },
                [icon('star'), isFavorite(meta.id) ? t('tile.saved') : t('tile.favorite')],
              ),
              el('button', { class: 'btn btn--ghost', onClick: () => this.go('') }, [
                t('game.back'),
              ]),
            ]),
          ]),
        ]),
      ]),
    );
  }

  private startStat(value: string, label: string): HTMLElement {
    return el('div', { class: 'start-stat' }, [
      el('div', { class: 'start-stat__value' }, [value]),
      el('div', { class: 'start-stat__label' }, [label]),
    ]);
  }

  private modePicker(meta: GameMeta, selected: GameMode): HTMLElement {
    const modes = meta.polish?.modes ?? ['challenge'];
    return el(
      'div',
      { class: 'mode-picker', role: 'group', 'aria-label': t('mode.label') },
      modes.map((mode) =>
        el(
          'button',
          {
            class: `mode-chip${selected === mode ? ' is-active' : ''}`,
            onClick: () => {
              this.runModes.set(meta.id, mode);
              audio.sfx('blip');
              void this.renderGameStart(meta.id);
            },
          },
          [el('b', {}, [this.modeLabel(mode)]), el('span', {}, [this.modeCopy(mode)])],
        ),
      ),
    );
  }

  private modeLabel(mode: GameMode): string {
    if (mode === 'practice') return t('mode.practice');
    if (mode === 'endless') return t('mode.endless');
    return t('mode.challenge');
  }

  private modeCopy(mode: GameMode): string {
    if (mode === 'practice') return t('mode.practiceCopy');
    if (mode === 'endless') return t('mode.endlessCopy');
    return t('mode.challengeCopy');
  }

  private startButtonLabel(mode: GameMode): string {
    if (mode === 'practice') return t('start.practice');
    if (mode === 'endless') return t('start.endless');
    return t('start.challenge');
  }

  private tipFor(meta: GameMeta): string {
    const tips = meta.polish?.tips ?? gameTutorialSteps(meta);
    const index =
      Math.abs(
        [...meta.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) + new Date().getDate(),
      ) % tips.length;
    const key = tips[index] ?? gameBlurb(meta);
    // tips are i18n keys (see Registry.tipsFor); non-key fallbacks pass through t() unchanged.
    return t(key, { group: t(`group.${meta.group.toLowerCase()}`) });
  }

  private async launchWithCountdown(id: string, mode: GameMode): Promise<void> {
    const overlay = el('div', { class: 'overlay overlay--count' });
    const box = el('div', { class: 'start-countdown' }, [
      el('span', {}, [this.modeLabel(mode)]),
      el('b', {}, ['3']),
    ]);
    overlay.append(box);
    this.view.append(overlay);
    const num = box.querySelector('b')!;
    for (const value of ['3', '2', '1']) {
      num.textContent = value;
      audio.sfx('blip');
      await new Promise((resolve) => window.setTimeout(resolve, 520));
    }
    num.textContent = 'GO';
    await new Promise((resolve) => window.setTimeout(resolve, 260));
    overlay.remove();
    await this.launch(id, mode);
  }

  private async launch(id: string, mode: GameMode = 'challenge'): Promise<void> {
    const meta = getGame(id);
    if (!meta || !meta.available || !meta.loader) {
      void this.renderHome();
      return;
    }
    this.markActiveNav(id);
    const seq = this.launchSeq;
    const { GameHost } = await this.loadEngineWithSpinner();
    if (seq !== this.launchSeq) return; // navigated away while the engine was loading
    this.host = new GameHost(this.view, meta, () => this.go(''));
    await this.host.start({
      mode,
      practice: mode === 'practice',
      label: mode === 'challenge' ? undefined : this.modeLabel(mode).toUpperCase(),
    });
  }

  private async launchDaily(): Promise<void> {
    const meta = pickDailyGame();
    if (!meta.available || !meta.loader) {
      void this.renderHome();
      return;
    }
    this.markActiveNav('daily');
    const mod = dailyModifier(meta);
    const seq = this.launchSeq;
    const { GameHost } = await this.loadEngineWithSpinner();
    if (seq !== this.launchSeq) return;
    this.host = new GameHost(this.view, meta, () => this.go(''));
    await this.host.start({
      seed: dailySeed(),
      label: t('home.dailyLabel'),
      daily: true,
      timeScale: mod.timeScale,
      scoreMult: mod.scoreMult,
    });
  }

  private teardownGame(): void {
    if (this.host) {
      this.host.destroy();
      this.host = null;
    }
  }
}
