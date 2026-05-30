import { el, clear, mount } from '@utils/dom';
import { pixi } from '@core/PixiManager';
import { audio } from '@core/AudioManager';
import { GAMES, GROUP_ORDER, getGame, type GameMeta } from '@core/Registry';
import { profile, xpForLevel } from '@store/profile';
import { getBest, preloadScores } from '@store/scores';
import { GameHost } from './GameHost';
import { renderSettings } from './views/Settings';
import { renderBios } from './views/Bios';
import { pickDailyGame, dailySeed } from './daily';

/** The application shell: builds the device layout, owns navigation and the active game. */
export class App {
  private view!: HTMLElement; // swappable DOM layer inside the screen
  private nav!: HTMLElement;
  private scrim!: HTMLElement;
  private host: GameHost | null = null;

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
    ]);
    mount(device);

    await pixi.init(screen);
    this.buildNav();

    window.addEventListener('hashchange', () => this.route());
    window.addEventListener('pointerdown', () => audio.unlock(), { once: true });

    this.route();
  }

  private route(): void {
    const hash = location.hash.replace(/^#\/?/, '');
    const [section, arg] = hash.split('/');
    this.teardownGame();
    this.closeNav();

    if (section === 'play' && arg) {
      void this.launch(arg);
    } else if (section === 'settings') {
      this.renderSettings();
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

  private async renderHome(): Promise<void> {
    const available = GAMES.filter((g) => g.available).map((g) => g.id);
    await preloadScores(available);

    clear(this.view);
    this.view.classList.remove('is-game');
    this.powerOn();

    const topbar = el('div', { class: 'topbar' }, [
      el('button', { class: 'iconbtn', 'aria-label': 'Menu', onClick: () => this.openNav() }, ['☰']),
      el('div', { class: 'topbar__title' }, ['RETRO POCKET']),
      el('button', { class: 'iconbtn', 'aria-label': 'Settings', onClick: () => this.go('settings') }, ['⚙']),
    ]);

    const body = el('div', { class: 'scroll' }, [
      this.heroDaily(),
      this.profileStrip(),
      this.gamesByGroup(),
    ]);

    this.view.append(topbar, body);
  }

  private heroDaily(): HTMLElement {
    const meta = pickDailyGame();
    return el(
      'div',
      { class: 'hero', role: 'button', onClick: () => this.go('daily') },
      [
        el('div', { class: 'hero__tag' }, ['★ DAILY CHALLENGE']),
        el('div', { class: 'hero__title' }, [meta.title]),
        el('div', { class: 'hero__sub' }, [meta.blurb]),
        el('button', { class: 'btn btn--primary' }, ['▶  Play today']),
      ],
    );
  }

  private profileStrip(): HTMLElement {
    const p = profile();
    const need = xpForLevel(p.level);
    const pct = Math.min(100, Math.round((p.xp / need) * 100));
    return el('div', { class: 'profile-strip' }, [
      el('strong', {}, [`Lv.${p.level}`]),
      el('div', { class: 'xpbar' }, [el('i', { style: `width:${pct}%` })]),
      el('span', {}, [`🪙 ${p.tokens}`]),
    ]);
  }

  private gamesByGroup(): HTMLElement {
    const wrap = el('div', {});
    for (const group of GROUP_ORDER) {
      const games = GAMES.filter((g) => g.group === group);
      if (!games.length) continue;
      wrap.append(el('div', { class: 'section-title' }, [group.toUpperCase()]));
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
        el('div', { class: 'tile__glyph' }, [g.glyph]),
        el('div', {}, [
          el('div', { class: 'tile__title' }, [g.title]),
          el('div', { class: 'tile__best' }, [
            g.available ? (best ? `★ ${best}` : '—') : 'Coming soon',
          ]),
        ]),
      ],
    );
  }

  private buildNav(): void {
    const items: (Node | string)[] = [
      el('div', { class: 'nav__head' }, ['RETRO POCKET']),
      this.navItem('⌂', 'Home', () => this.go('')),
      this.navItem('★', 'Daily Challenge', () => this.go('daily')),
      this.navItem('⚙', 'Settings', () => this.go('settings')),
    ];
    for (const group of GROUP_ORDER) {
      const games = GAMES.filter((g) => g.group === group);
      if (!games.length) continue;
      items.push(el('div', { class: 'nav__group' }, [group.toUpperCase()]));
      for (const g of games) {
        items.push(
          el(
            'button',
            {
              class: 'nav__item',
              disabled: !g.available,
              onClick: () => {
                if (g.available) this.go(`play/${g.id}`);
              },
            },
            [el('span', {}, [g.glyph]), el('span', {}, [g.title])],
          ),
        );
      }
    }
    this.nav.replaceChildren(...items);
  }

  private navItem(icon: string, label: string, onClick: () => void): HTMLElement {
    return el('button', { class: 'nav__item', onClick }, [
      el('span', {}, [icon]),
      el('span', {}, [label]),
    ]);
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

  private renderSettings(): void {
    clear(this.view);
    this.view.classList.remove('is-game');
    this.powerOn();
    this.view.append(
      el('div', { class: 'topbar' }, [
        el('button', { class: 'iconbtn', 'aria-label': 'Back', onClick: () => this.go('') }, ['‹']),
        el('div', { class: 'topbar__title' }, ['SETTINGS']),
      ]),
      renderSettings(),
    );
  }

  private renderBios(): void {
    clear(this.view);
    this.view.classList.remove('is-game');
    this.view.append(renderBios(() => this.go('')));
  }

  private async launch(id: string): Promise<void> {
    const meta = getGame(id);
    if (!meta || !meta.available || !meta.loader) {
      void this.renderHome();
      return;
    }
    this.host = new GameHost(this.view, meta, () => this.go(''));
    await this.host.start();
  }

  private async launchDaily(): Promise<void> {
    const meta = pickDailyGame();
    if (!meta.available || !meta.loader) {
      void this.renderHome();
      return;
    }
    this.host = new GameHost(this.view, meta, () => this.go(''));
    await this.host.start({ seed: dailySeed(), label: 'DAILY' });
  }

  private teardownGame(): void {
    if (this.host) {
      this.host.destroy();
      this.host = null;
    }
  }
}
