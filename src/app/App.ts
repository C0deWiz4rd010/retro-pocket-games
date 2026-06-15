import { el, clear, mount } from '@utils/dom';
import { pixi } from '@core/PixiManager';
import { audio } from '@core/AudioManager';
import { GAMES, GROUP_ORDER, getGame, type GameMeta } from '@core/Registry';
import { profile, xpForLevel } from '@store/profile';
import { getBest, getLastPlayed, getCustomBest, preloadScores, clearAllLastPlayed } from '@store/scores';
import { currentStreak, playedToday, last7Days } from '@store/dailyStore';
import { isFavorite, toggleFavorite } from '@store/prefs';
import { GameHost } from './GameHost';
import { renderSettings } from './views/Settings';
import { renderBios } from './views/Bios';
import { renderAchievements } from './views/Achievements';
import { renderScores } from './views/Scores';
import { renderProfile } from './views/Profile';
import { renderAbout } from './views/About';
import { pickDailyGame, dailySeed, dailyModifier, nextDailyLabel } from './daily';
import { t } from '@i18n/index';
import { icon } from '@ui/icons';

/** Games whose `custom` payload carries a meaningful secondary best worth showing on the tile. */
const CUSTOM_BEST: Record<string, { key: string; label: string }> = {
  snake: { key: 'length', label: 'len' },
  tetris: { key: 'level', label: 'lvl' },
  invaders: { key: 'wave', label: 'wave' },
  asteroids: { key: 'wave', label: 'wave' },
  galaga: { key: 'wave', label: 'wave' },
  breakout: { key: 'level', label: 'lvl' },
  stacker: { key: 'height', label: 'h' },
  doodle: { key: 'height', label: 'h' },
  simon: { key: 'len', label: 'seq' },
  tron: { key: 'wins', label: 'wins' },
  reversi: { key: 'discs', label: 'discs' },
};

/** The application shell: builds the device layout, owns navigation and the active game. */
export class App {
  private view!: HTMLElement; // swappable DOM layer inside the screen
  private nav!: HTMLElement; // mobile drawer
  private rail!: HTMLElement; // persistent launcher rail
  private scrim!: HTMLElement;
  private host: GameHost | null = null;
  private homeFilter: GameMeta['group'] | 'all' = 'all';

  async init(): Promise<void> {
    const screen = el('div', { class: 'screen' });
    this.view = el('div', { class: 'screen__view' });
    const crt = el('div', { class: 'screen__crt' });
    this.nav = el('nav', { class: 'nav', 'aria-label': 'Games' });
    this.scrim = el('div', { class: 'nav__scrim', onClick: () => this.closeNav() });
    screen.append(crt, this.view, this.scrim, this.nav);

    const device = el('div', { class: 'device' }, [
      el('div', { class: 'device__brand' }, [
        el('span', {}, ['● RETRO POCKET']),
        el('span', { class: 'led' }),
      ]),
      screen,
      el('div', { class: 'device__grille' }, Array.from({ length: 6 }, () => el('i', {}))),
    ]);

    this.rail = el('aside', { class: 'rail', 'aria-label': 'Navigation' });

    mount(el('div', { class: 'frame' }, [this.rail, device]));

    await pixi.init(screen);
    this.buildNav();

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
    window.addEventListener('blur', () => audio.setMutedByBlur(true));
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
    const overlay = el('div', { class: 'overlay kbd-help', onClick: () => overlay.remove() }, [
      el('div', { class: 'panel', role: 'dialog', 'aria-modal': 'true', onClick: (e: Event) => e.stopPropagation() }, [
        el('div', { class: 'panel__title' }, [t('kbd.title')]),
        ...rowsData.map(([k, v]) =>
          el('div', { class: 'kbd-row' }, [el('kbd', {}, [k]), el('span', {}, [v])]),
        ),
        el('button', { class: 'btn btn--primary btn--block', onClick: () => overlay.remove() }, [t('game.resume')]),
      ]),
    ]);
    document.querySelector('.screen__view')?.append(overlay);
  }

  private route(): void {
    const hash = location.hash.replace(/^#\/?/, '');
    const [section, arg] = hash.split('/');
    this.teardownGame();
    this.closeNav();
    this.view.classList.remove('is-home');

    // Menu music plays everywhere except inside an active game.
    if (section === 'play' || section === 'daily') audio.stopMusic();
    else audio.startMusic();

    if (section === 'play' && arg) {
      void this.launch(arg);
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

    clear(this.view);
    this.view.classList.remove('is-game');
    this.view.classList.add('is-home');
    this.powerOn();
    this.markActiveNav('home');

    const topbar = el('div', { class: 'topbar' }, [
      el('button', { class: 'iconbtn topbar__menu', 'aria-label': 'Menu', onClick: () => this.openNav() }, [icon('menu')]),
      el('div', { class: 'topbar__title' }, ['RETRO POCKET']),
      el('button', { class: 'iconbtn', 'aria-label': t('home.surprise'), onClick: () => this.surpriseMe() }, [icon('surprise')]),
      el('button', { class: 'iconbtn', 'aria-label': 'Settings', onClick: () => this.go('settings') }, [icon('settings')]),
    ]);

    // Live search: when non-empty, the grouped grid collapses to a flat filtered result.
    const gamesHost = el('div', { class: 'library-stage' });
    const search = el('input', {
      class: 'search',
      type: 'search',
      placeholder: t('home.search'),
      'aria-label': t('home.search'),
      onInput: (e: Event) => {
        const q = (e.target as HTMLInputElement).value.trim().toLowerCase();
        gamesHost.replaceChildren(q ? this.searchResults(q) : this.gamesByGroup(this.homeFilter));
      },
    });
    const filters = this.libraryFilters((group) => {
      this.homeFilter = group;
      search.value = '';
      gamesHost.replaceChildren(this.gamesByGroup(group));
      filters.querySelectorAll('.cat-chip').forEach((chip) => chip.classList.remove('is-active'));
      filters.querySelector(`[data-filter="${group}"]`)?.classList.add('is-active');
    });
    gamesHost.append(this.gamesByGroup(this.homeFilter));

    const body = el('div', { class: 'scroll landing' }, [
      this.heroDaily(),
      this.dailyHistory(),
      this.statsRow(),
      ...this.continueSection(),
      ...this.favoritesSection(),
      el('div', { class: 'library-head' }, [
        el('div', {}, [
          el('div', { class: 'section-title' }, [t('home.library')]),
          el('h2', { class: 'library-head__title' }, [t('home.libraryTitle')]),
        ]),
        el('button', { class: 'btn btn--ghost', onClick: () => this.surpriseMe() }, [icon('surprise'), t('home.surprise')]),
      ]),
      el('div', { class: 'search-wrap' }, [el('span', { class: 'search-wrap__icon' }, [icon('search')]), search]),
      filters,
      gamesHost,
      ...this.welcomeSection(),
    ]);

    this.view.append(topbar, body);
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
    return el('div', { class: 'daily-strip' }, days.map((d) =>
      el('div', { class: `daily-dot${d.played ? ' is-played' : ''}` }, [
        el('span', { class: 'daily-dot__d' }, [labels[d.weekday] ?? '']),
        el('span', { class: 'daily-dot__mark' }, [d.played ? '🔥' : '·']),
      ]),
    ));
  }

  private searchResults(q: string): HTMLElement {
    const hits = GAMES.filter((g) => g.available && g.title.toLowerCase().includes(q));
    if (!hits.length) return el('div', { class: 'search-empty' }, ['—']);
    return el('div', { class: 'tilegrid' }, hits.map((g) => this.tile(g)));
  }

  private favoritesSection(): HTMLElement[] {
    const favs = GAMES.filter((g) => g.available && isFavorite(g.id));
    if (!favs.length) return [];
    return [
      el('div', { class: 'section-title' }, [t('home.favorites')]),
      el('div', { class: 'tilegrid' }, favs.map((g) => this.tile(g))),
    ];
  }

  private heroDaily(): HTMLElement {
    const meta = pickDailyGame();
    const mod = dailyModifier();
    const streak = currentStreak();
    const done = playedToday();
    const children: (Node | string)[] = [
      el('div', { class: 'hero__visual', style: `--tile-accent:${meta.accent}` }, [
        this.tileCover(meta),
        el('div', { class: 'hero__glyph' }, [meta.glyph]),
      ]),
      el('div', { class: 'hero__content' }, [
        el('div', { class: 'hero__tag' }, [t('home.daily')]),
        el('div', { class: 'hero__title' }, [meta.title]),
        el('div', { class: 'hero__sub' }, [meta.blurb]),
        el('div', { class: 'hero__mod' }, [t(mod.label)]),
        el('button', { class: 'btn btn--primary' }, [icon('play'), done ? t('home.done') : t('home.playToday')]),
      ]),
    ];
    // After today's run, show a live countdown to the next challenge instead of a streak only.
    if (done) {
      children.push(el('div', { class: 'hero__next' }, [t('home.next', { t: nextDailyLabel() })]));
    }
    if (streak > 0) children.push(el('div', { class: 'hero__streak' }, [t('home.streak', { n: streak })]));
    return el('div', { class: 'hero', role: 'button', onClick: () => this.go('daily') }, children);
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
      el('div', { class: 'statcard statcard--link', role: 'button', onClick: () => this.go('profile') }, [
        el('div', { class: 'statcard__val' }, [`Lv.${p.level}`]),
        el('div', { class: 'xpbar', style: 'margin-top:6px' }, [el('i', { style: `width:${pct}%` })]),
        el('div', { class: 'statcard__label' }, [`${p.xp}/${need} XP`]),
      ]),
      card(`🪙 ${p.tokens}`, t('home.tokens')),
      card(p.stats.gamesPlayed, t('home.played')),
      card(p.stats.totalScore.toLocaleString(), t('home.totalScore')),
      this.achievementsCard(),
    ]);
  }

  private achievementsCard(): HTMLElement {
    return el('div', {
      class: 'statcard statcard--link',
      role: 'button',
      onClick: () => this.go('achievements'),
    }, [
      el('div', { class: 'statcard__val' }, ['🏆']),
      el('div', { class: 'statcard__label' }, [t('nav.achievements')]),
    ]);
  }

  private continueSection(): HTMLElement[] {
    const recent = GAMES.filter((g) => g.available && getLastPlayed(g.id) > 0).sort(
      (a, b) => getLastPlayed(b.id) - getLastPlayed(a.id),
    );
    if (!recent.length) return [];
    const cards = recent.slice(0, 8).map((g) =>
      el('button', { class: 'continue-card', style: `--ca:${g.accent}`, onClick: () => this.go(`play/${g.id}`) }, [
        el('div', { class: 'g' }, [g.glyph]),
        el('div', { class: 't' }, [g.title]),
        el('div', { class: 's' }, [`★ ${getBest(g.id)}`]),
        el('div', { class: 'ago' }, [this.timeAgo(getLastPlayed(g.id))]),
      ]),
    );
    const header = el('div', { class: 'section-title section-title--row' }, [
      el('span', {}, [t('home.recent')]),
      el('button', { class: 'section-title__action', onClick: () => this.clearHistory() }, [t('home.clear')]),
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

  private libraryFilters(onPick: (group: GameMeta['group'] | 'all') => void): HTMLElement {
    const filters: (GameMeta['group'] | 'all')[] = ['all', ...GROUP_ORDER];
    return el('div', { class: 'cat-chips cat-chips--library' }, filters.map((group) =>
      el('button', {
        class: `cat-chip${group === this.homeFilter ? ' is-active' : ''}`,
        'data-filter': group,
        onClick: () => {
          audio.sfx('blip');
          onPick(group);
        },
      }, [group === 'all' ? t('home.allGames') : group]),
    ));
  }

  private gamesByGroup(filter: GameMeta['group'] | 'all' = 'all'): HTMLElement {
    const wrap = el('div', {});
    const groups = GROUP_ORDER.filter((g) => (filter === 'all' || g === filter) && GAMES.some((x) => x.group === g));

    for (const group of groups) {
      const games = GAMES.filter((g) => g.group === group);
      wrap.append(el('div', { class: 'section-title', id: `grp-${group}` }, [group.toUpperCase()]));
      const grid = el('div', { class: 'tilegrid' }, games.map((g) => this.tile(g)));
      wrap.append(grid);
    }
    return wrap;
  }

  private tile(g: GameMeta): HTMLElement {
    const best = g.available ? getBest(g.id) : 0;
    return el(
      'button',
      {
        class: `tile${g.available ? '' : ' tile--soon'}`,
        style: `--tile-accent:${g.accent}`,
        onClick: () => {
          if (g.available) this.go(`play/${g.id}`);
        },
        'aria-label': g.title,
      },
      [
        g.available ? '' : el('span', { class: 'tile__badge' }, ['SOON']),
        g.available ? this.favStar(g.id) : '',
        this.tileCover(g),
        el('div', { class: 'tile__glyph' }, [g.glyph]),
        el('div', {}, [
          el('div', { class: 'tile__title' }, [g.title]),
          el('div', { class: 'tile__best' }, [
            g.available ? (best ? `★ ${best}` : '—') : 'Coming soon',
          ]),
          el('div', { class: 'tile__meta' }, [g.tags?.[1] ?? g.kit]),
          g.available ? this.customBestLabel(g.id) : '',
        ]),
      ],
    );
  }

  private tileCover(g: GameMeta): HTMLElement {
    const motif = g.cover?.motif ?? (g.kit === 'paddle' ? 'paddle' : g.kit === 'shooter' ? 'shooter' : g.kit === 'vector' ? 'vector' : 'grid');
    return el('div', { class: `tile__cover tile__cover--${motif}`, 'aria-hidden': 'true' }, [
      el('i', {}),
      el('i', {}),
      el('i', {}),
      el('i', {}),
    ]);
  }

  /** A second line with a game-specific personal best (e.g. "lvl 7", "len 42"). */
  private customBestLabel(id: string): Node | string {
    const spec = CUSTOM_BEST[id];
    if (!spec) return '';
    const v = getCustomBest(id, spec.key);
    if (v <= 0) return '';
    return el('div', { class: 'tile__custom' }, [`${spec.label} ${v}`]);
  }

  private favStar(id: string): HTMLElement {
    return el('button', {
      class: `tile__fav${isFavorite(id) ? ' is-fav' : ''}`,
      'aria-label': 'Favorite',
      onClick: (e: Event) => {
        e.stopPropagation();
        toggleFavorite(id);
        audio.sfx('blip');
        void this.renderHome();
      },
    }, [isFavorite(id) ? '★' : '☆']);
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
      this.navItem(icon('trophy'), t('nav.achievements'), () => this.go('achievements'), 'achievements'),
      this.navItem(icon('profile'), t('nav.profile'), () => this.go('profile'), 'profile'),
      this.navItem(icon('info'), t('nav.about'), () => this.go('about'), 'about'),
      this.navItem(icon('settings'), t('nav.settings'), () => this.go('settings'), 'settings'),
    ];
    for (const group of GROUP_ORDER) {
      const games = GAMES.filter((g) => g.group === group);
      if (!games.length) continue;
      items.push(el('div', { class: 'nav__group' }, [group.toUpperCase()]));
      for (const g of games) {
        const best = g.available ? getBest(g.id) : 0;
        items.push(
          el(
            'button',
            {
              class: 'nav__item',
              'data-nav': g.id,
              disabled: !g.available,
              onClick: () => {
                if (g.available) this.go(`play/${g.id}`);
              },
            },
            [
              el('span', {}, [g.glyph]),
              el('span', { class: 'nav__item-title' }, [g.title]),
              best > 0 ? el('span', { class: 'nav__item-best' }, [`★${best}`]) : '',
            ],
          ),
        );
      }
    }
    return items;
  }

  private buildNav(): void {
    // The drawer and the rail share the same item set (two independent DOM copies).
    this.nav.replaceChildren(...this.navItems());
    this.rail.replaceChildren(...this.navItems());
  }

  private navItem(iconNode: Node | string, label: string, onClick: () => void, id: string): HTMLElement {
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

  private openNav(): void {
    audio.sfx('blip');
    this.nav.classList.add('open');
    this.scrim.classList.add('open');
  }

  private closeNav(): void {
    this.nav.classList.remove('open');
    this.scrim.classList.remove('open');
  }

  // ───────────────────────────── settings / bios ─────────────────────────────
  private renderSettings(): void {
    clear(this.view);
    this.view.classList.remove('is-game');
    this.powerOn();
    this.markActiveNav('settings');
    this.view.append(
      el('div', { class: 'topbar' }, [
        el('button', { class: 'iconbtn topbar__menu', 'aria-label': 'Menu', onClick: () => this.openNav() }, ['☰']),
        el('button', { class: 'iconbtn', 'aria-label': 'Back', onClick: () => this.go('') }, ['‹']),
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
        el('button', { class: 'iconbtn topbar__menu', 'aria-label': 'Menu', onClick: () => this.openNav() }, ['☰']),
        el('button', { class: 'iconbtn', 'aria-label': 'Back', onClick: () => this.go('') }, ['‹']),
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
        el('button', { class: 'iconbtn topbar__menu', 'aria-label': 'Menu', onClick: () => this.openNav() }, ['☰']),
        el('button', { class: 'iconbtn', 'aria-label': 'Back', onClick: back }, ['‹']),
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
        el('button', { class: 'iconbtn topbar__menu', 'aria-label': 'Menu', onClick: () => this.openNav() }, ['☰']),
        el('button', { class: 'iconbtn', 'aria-label': 'Back', onClick: () => this.go('') }, ['‹']),
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
        el('button', { class: 'iconbtn topbar__menu', 'aria-label': 'Menu', onClick: () => this.openNav() }, ['☰']),
        el('button', { class: 'iconbtn', 'aria-label': 'Back', onClick: () => this.go('') }, ['‹']),
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
  private async launch(id: string): Promise<void> {
    const meta = getGame(id);
    if (!meta || !meta.available || !meta.loader) {
      void this.renderHome();
      return;
    }
    this.markActiveNav(id);
    this.host = new GameHost(this.view, meta, () => this.go(''));
    await this.host.start();
  }

  private async launchDaily(): Promise<void> {
    const meta = pickDailyGame();
    if (!meta.available || !meta.loader) {
      void this.renderHome();
      return;
    }
    this.markActiveNav('daily');
    const mod = dailyModifier();
    this.host = new GameHost(this.view, meta, () => this.go(''));
    await this.host.start({
      seed: dailySeed(),
      label: 'DAILY',
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
