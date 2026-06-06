import { Container, Ticker } from 'pixi.js';
import { pixi } from '@core/PixiManager';
import { InputManager, type Action } from '@core/InputManager';
import { audio } from '@core/AudioManager';
import { haptics } from '@core/Haptics';
import { wakeLock } from '@core/WakeLock';
import { screenFX } from '@core/ScreenFX';
import { perf } from '@core/PerfMonitor';
import { RNG } from '@utils/rng';
import { el, clear } from '@utils/dom';
import { submitScore, getBest, loadScores } from '@store/scores';
import { awardRun } from '@store/profile';
import { evaluateAchievements, buildContext, type Achievement } from '@store/achievements';
import { recordDailyResult, currentStreak } from '@store/dailyStore';
import { loadLeaderboard, qualifies, addEntry } from '@store/leaderboard';
import { hasSeenTutorial, markTutorialSeen } from '@store/prefs';
import { settings, updateSettings } from '@store/settings';
import { showTutorial } from './tutorial';
import { shareScoreCard } from './shareCard';
import { t } from '@i18n/index';
import type { Game, GameContext, Hud } from '@core/types';
import type { GameMeta } from '@core/Registry';

export interface RunOptions {
  seed?: number;
  label?: string; // e.g. "DAILY" banner
  daily?: boolean; // counts toward the daily streak
  timeScale?: number; // daily modifier: simulation speed multiplier
  scoreMult?: number; // daily modifier: score multiplier applied at game over
}

/**
 * Mounts and runs a single game: builds the HUD + touch controls + pause/game-over overlays,
 * wires input, drives the Pixi ticker, and persists the score on game over. See docs/03 §6.
 */
export class GameHost {
  private input = new InputManager();
  private game: Game | null = null;
  private root = new Container();
  private tickFn: ((t: Ticker) => void) | null = null;
  private running = false;
  private destroyed = false;
  private opts: RunOptions = {};

  private hudScore!: HTMLElement;
  private hudLabel!: HTMLElement;
  private hudLives!: HTMLElement;
  private hudBest!: HTMLElement;
  private overlayHost!: HTMLElement;

  constructor(
    private screenView: HTMLElement,
    private meta: GameMeta,
    private onExit: () => void,
  ) {}

  async start(opts: RunOptions = {}): Promise<void> {
    this.opts = opts;
    await Promise.all([loadScores(this.meta.id), loadLeaderboard(this.meta.id)]);
    audio.unlock();
    void wakeLock.request();
    pixi.setVirtual(this.meta.virtual.w, this.meta.virtual.h);
    pixi.clearWorld();
    this.root = new Container();
    pixi.world.addChild(this.root);

    this.buildChrome();
    this.input.attach(pixi.canvas, pixi.screenToVirtual);

    const ctx: GameContext = {
      stage: this.root,
      width: this.meta.virtual.w,
      height: this.meta.virtual.h,
      input: this.input,
      audio,
      rng: new RNG(opts.seed ?? (Date.now() & 0xffffffff)),
      hud: this.makeHud(),
      timeScale: opts.timeScale ?? 1,
      gameOver: (score, custom) => void this.handleGameOver(score, custom),
    };

    const mod = await this.meta.loader!();
    if (this.destroyed) return;
    this.game = await mod.default(ctx);

    // CRT shader (if enabled) + dev FPS meter / auto-downgrade.
    screenFX.apply();
    perf.attach(this.screenView);

    // Pause on Start/Esc/P from keyboard or gamepad.
    this.input.on('down', (a) => {
      if (a === 'pause' || a === 'start') this.pause();
    });

    const timeScale = opts.timeScale ?? 1;
    this.tickFn = (tk: Ticker) => {
      this.input.pollGamepad();
      const dt = Math.min(tk.deltaMS / 1000, 0.05);
      screenFX.tick(dt);
      perf.tick(dt);
      if (!this.running || !this.game) return;
      // Fold the daily time-scale in, but keep the per-step dt clamped for stability.
      this.game.update(Math.min(dt * timeScale, 0.05));
    };
    pixi.app.ticker.add(this.tickFn);

    // First-run tutorial: hold the sim until dismissed, then play.
    if (!hasSeenTutorial(this.meta.id)) {
      this.running = false;
      const ov = showTutorial(this.meta, () => {
        markTutorialSeen(this.meta.id);
        this.running = true;
      });
      this.screenView.append(ov);
    } else {
      this.running = true;
    }
  }

  /** Pause from outside (e.g. tab blur). Safe to call repeatedly. */
  pauseExternal(): void {
    if (this.running) this.pause();
  }

  // ── chrome: HUD, controls, pause button ──
  private buildChrome(): void {
    clear(this.screenView);
    this.screenView.classList.add('is-game', 'power-on');
    // Drives the CSS rotate-prompt for landscape games viewed in portrait.
    this.screenView.dataset.orient = this.meta.orientation;

    this.hudScore = el('div', { class: 'hud__score' }, ['0']);
    const labelText = this.opts.label ? `${this.opts.label} · ${this.meta.title.toUpperCase()}` : this.meta.title.toUpperCase();
    this.hudLabel = el('div', { class: 'hud__label' }, [labelText]);
    this.hudLives = el('div', { class: 'hud__lives' });
    // Show the current best to beat (if any) as a subtle HUD badge.
    const best = getBest(this.meta.id);
    this.hudBest = el('div', { class: 'hud__best' }, [best > 0 ? `★ ${best}` : '']);
    const pauseBtn = el('button', { class: 'iconbtn', 'aria-label': t('game.paused'), onClick: () => this.pause() }, ['⏸']);
    const hud = el('div', { class: 'hud' }, [this.hudScore, this.hudBest, this.hudLabel, this.hudLives, pauseBtn]);

    this.overlayHost = el('div', { style: 'position:absolute;inset:0;pointer-events:none' });

    this.screenView.append(hud, this.buildControls(), this.buildRotatePrompt(), this.overlayHost);
  }

  private buildRotatePrompt(): HTMLElement {
    // CSS decides visibility (only landscape games in a portrait viewport). aria-hidden when
    // not shown is handled by display:none in CSS.
    return el('div', { class: 'rotate-prompt', role: 'alert' }, [
      el('div', { class: 'rotate-prompt__icon' }, ['📱↻']),
      el('div', { class: 'rotate-prompt__title' }, [t('rotate.text')]),
      el('div', { class: 'rotate-prompt__hint' }, [t('rotate.hint')]),
    ]);
  }

  private buildControls(): HTMLElement {
    const dirBtn = (dir: Action, glyph: string) =>
      el('button', {
        class: dir,
        'aria-label': dir,
        onPointerdown: (e: Event) => {
          e.preventDefault();
          this.input.press(dir);
          haptics.tick();
        },
        onPointerup: () => this.input.release(dir),
        onPointerleave: () => this.input.release(dir),
      }, [glyph]);

    const dpad = el('div', { class: 'dpad' }, [
      dirBtn('up', '▲'),
      dirBtn('left', '◀'),
      dirBtn('right', '▶'),
      dirBtn('down', '▼'),
    ]);

    const actBtn = (cls: string, action: Action, label: string) =>
      el('button', {
        class: cls,
        'aria-label': action,
        onPointerdown: (e: Event) => {
          e.preventDefault();
          this.input.press(action);
          haptics.tick();
        },
        onPointerup: () => this.input.release(action),
        onPointerleave: () => this.input.release(action),
      }, [label]);

    const actions = el('div', { class: 'actionbtns' }, [
      actBtn('b', 'b', 'B'),
      actBtn('a', 'a', 'A'),
    ]);

    return el('div', { class: 'touch' }, [dpad, actions]);
  }

  private makeHud(): Hud {
    return {
      setScore: (n) => {
        this.hudScore.textContent = String(n);
      },
      setLives: (n) => {
        this.hudLives.textContent = '♥'.repeat(Math.max(0, n));
      },
      setLabel: (txt) => {
        this.hudLabel.textContent = txt;
      },
      toast: (txt) => this.toast(txt),
    };
  }

  private toast(text: string): void {
    const node = el('div', { class: 'toast' }, [text]);
    this.screenView.append(node);
    window.setTimeout(() => node.remove(), 1900);
  }

  /** Queue achievement-unlock toasts so they don't overlap. */
  private toastAchievements(list: Achievement[]): void {
    list.forEach((a, i) => {
      window.setTimeout(() => {
        const node = el('div', { class: 'toast toast--ach' }, [
          el('span', { class: 'toast--ach__icon' }, [a.icon]),
          el('span', {}, [
            el('div', { class: 'toast--ach__title' }, [t('ach.unlocked')]),
            el('div', {}, [a.title]),
          ]),
        ]);
        this.screenView.append(node);
        audio.sfx('coin');
        window.setTimeout(() => node.remove(), 2600);
      }, 400 + i * 700);
    });
  }

  // ── pause / resume / restart ──
  private pause(): void {
    if (!this.running) return;
    this.running = false;
    audio.sfx('select');
    const panel = el('div', { class: 'panel' }, [
      el('div', { class: 'panel__title' }, [t('game.paused')]),
      this.buildQuickToggles(),
      el('button', { class: 'btn btn--primary btn--block', onClick: () => this.resume() }, [`▶  ${t('game.resume')}`]),
      el('button', { class: 'btn btn--ghost btn--block', onClick: () => this.restart() }, [`↻  ${t('game.restart')}`]),
      el('button', { class: 'btn btn--ghost btn--block', onClick: () => this.confirmQuit() }, [`⌂  ${t('game.home')}`]),
    ]);
    this.showOverlay(panel);
  }

  /** Inline sound / FX quick-toggles on the pause overlay. */
  private buildQuickToggles(): HTMLElement {
    const chip = (on: boolean, label: string, onClick: () => void): HTMLElement =>
      el('button', {
        class: `quick-toggle${on ? ' on' : ''}`,
        'aria-pressed': String(on),
        onClick,
      }, [label]);
    const row = el('div', { class: 'quick-toggles' });
    const rebuild = (): void => {
      const s = settings();
      row.replaceChildren(
        chip(s.audio.sfx, `🔊 ${t('settings.sfx')}`, () => {
          updateSettings({ audio: { ...settings().audio, sfx: !settings().audio.sfx } });
          rebuild();
        }),
        chip(s.screenFx.mode !== 'off', '📺 CRT', () => {
          const mode = settings().screenFx.mode === 'off' ? 'css' : 'off';
          updateSettings({ screenFx: { ...settings().screenFx, mode } });
          rebuild();
        }),
      );
    };
    rebuild();
    return row;
  }

  /** Confirm before leaving an in-progress game, so a stray tap doesn't lose the run. */
  private confirmQuit(): void {
    const panel = el('div', { class: 'panel' }, [
      el('div', { class: 'panel__title' }, [t('game.quitConfirm')]),
      el('button', { class: 'btn btn--danger btn--block', onClick: () => this.exit() }, [`⌂  ${t('game.quit')}`]),
      el('button', { class: 'btn btn--ghost btn--block', onClick: () => this.pause() }, [t('game.keepPlaying')]),
    ]);
    this.showOverlay(panel);
  }

  private resume(): void {
    this.clearOverlay();
    if (document.documentElement.classList.contains('a11y-reduced-motion')) {
      this.running = true;
      return;
    }
    // 3-2-1 countdown so the player isn't dropped straight back into the action.
    const overlay = el('div', { class: 'overlay overlay--count' });
    overlay.dataset.overlay = '1';
    const num = el('div', { class: 'countdown' }, ['3']);
    overlay.append(num);
    this.screenView.append(overlay);
    let n = 3;
    const tick = (): void => {
      if (n <= 0) {
        overlay.remove();
        this.running = true;
        return;
      }
      num.textContent = String(n);
      num.style.animation = 'none';
      void num.offsetWidth;
      num.style.animation = '';
      audio.sfx('blip');
      n--;
      window.setTimeout(tick, 700);
    };
    tick();
  }

  private async restart(): Promise<void> {
    const opts = this.opts;
    this.teardown();
    await this.start(opts);
  }

  private exit(): void {
    this.teardown();
    this.onExit();
  }

  private async handleGameOver(rawScore: number, custom: Record<string, number> = {}): Promise<void> {
    if (!this.running && this.game === null) return;
    this.running = false;
    audio.sfx('gameover');
    haptics.bump();

    // Daily modifier score multiplier (1 for normal play).
    const mult = this.opts.scoreMult ?? 1;
    const score = mult !== 1 ? Math.round(rawScore * mult) : rawScore;

    const prevBest = getBest(this.meta.id);
    const isBest = await submitScore(this.meta.id, score, custom);
    const reward = awardRun(this.meta.id, score);
    const { leveledUp, newLevel, xpGain } = reward;

    // Daily streak (only when this run came from the daily challenge).
    let streak = currentStreak();
    if (this.opts.daily) streak = recordDailyResult(this.meta.id, score, this.opts.label ?? '');

    // Achievements — evaluated centrally from the run payload + profile, no per-game code.
    const unlocked = evaluateAchievements(buildContext(this.meta.id, score, custom, streak));

    const scoreEl = el('div', { class: 'panel__score' }, ['0']);
    this.countUp(scoreEl, score);
    // New-best delta over the previous record (only when it's actually a new best > 0).
    const bestLine =
      isBest && prevBest > 0
        ? `${t('game.newBest')}  (+${(score - prevBest).toLocaleString()})`
        : isBest
          ? t('game.newBest')
          : t('game.best', { n: prevBest });
    const rows: (Node | string)[] = [
      el('div', { class: 'panel__title' }, [t('game.over')]),
      scoreEl,
      el('div', { style: 'color:var(--text-muted);font-size:13px' }, [bestLine]),
      el('div', { class: 'panel__xp' }, [`+${xpGain} XP`]),
    ];
    if (leveledUp) rows.push(el('div', { style: 'color:var(--ok);font-size:13px' }, [t('game.levelUp', { n: newLevel })]));

    // Leaderboard: offer a name entry if the score cracks the local top 10.
    if (qualifies(this.meta.id, score)) {
      rows.push(this.buildNameEntry(score));
    }

    if (mult !== 1) {
      rows.push(el('div', { style: 'color:var(--accent);font-size:12px' }, [`×${mult} ${t('game.bonus')}`]));
    }

    rows.push(
      el('div', { class: 'panel__row' }, [
        el('button', { class: 'btn btn--primary btn--block', onClick: () => this.restart() }, [`↻  ${t('game.retry')}`]),
        el('button', { class: 'btn btn--ghost btn--block', onClick: () => this.exit() }, [`⌂  ${t('game.home')}`]),
      ]),
      el('div', { class: 'panel__row' }, [
        el('button', {
          class: 'btn btn--ghost btn--block',
          onClick: () => {
            this.teardown();
            location.hash = `#/scores/${this.meta.id}`;
          },
        }, [`🏅  ${t('game.leaderboard')}`]),
        el('button', {
          class: 'btn btn--ghost btn--block',
          onClick: () => void shareScoreCard(this.meta, score, isBest),
        }, [`↗  ${t('game.share')}`]),
      ]),
    );

    this.showOverlay(el('div', { class: 'panel' }, rows));
    if (unlocked.length) this.toastAchievements(unlocked);
  }

  /** Animate a number from 0 → target (respecting reduced-motion). */
  private countUp(node: HTMLElement, target: number): void {
    if (target <= 0 || document.documentElement.classList.contains('a11y-reduced-motion')) {
      node.textContent = String(target);
      return;
    }
    const dur = 700;
    const start = performance.now();
    const step = (now: number): void => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      node.textContent = String(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(step);
      else node.textContent = String(target);
    };
    requestAnimationFrame(step);
  }

  private buildNameEntry(score: number): HTMLElement {
    const input = el('input', {
      class: 'name-input',
      maxlength: '8',
      placeholder: t('game.enterName'),
      value: localStorage.getItem('rp:name') ?? '',
    }) as HTMLInputElement;
    const wrap = el('div', { class: 'name-entry' }, [
      el('div', { style: 'color:var(--accent);font-size:13px;font-weight:700' }, [t('game.newRecord')]),
      el('div', { class: 'name-entry__row' }, [
        input,
        el('button', {
          class: 'btn btn--primary',
          onClick: () => {
            const name = input.value.trim() || 'YOU';
            localStorage.setItem('rp:name', name);
            void addEntry(this.meta.id, name, score);
            audio.sfx('coin');
            wrap.replaceChildren(el('div', { style: 'color:var(--ok);font-size:13px' }, ['✓']));
          },
        }, [t('game.save')]),
      ]),
    ]);
    return wrap;
  }

  private showOverlay(panel: HTMLElement): void {
    this.clearOverlay();
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    const ov = el('div', { class: 'overlay' }, [panel]);
    ov.dataset.overlay = '1';
    this.screenView.append(ov);
    // Move focus into the dialog for keyboard + screen-reader users.
    const focusable = panel.querySelector<HTMLElement>('button, input, [tabindex]');
    focusable?.focus();
  }
  private clearOverlay(): void {
    this.screenView.querySelector('[data-overlay]')?.remove();
  }

  private teardown(): void {
    this.running = false;
    void wakeLock.release();
    perf.detach();
    if (this.tickFn) pixi.app.ticker.remove(this.tickFn);
    this.tickFn = null;
    this.game?.destroy();
    this.game = null;
    this.input.detach(pixi.canvas);
    pixi.clearWorld();
  }

  /** Called by the router when navigating away from a game. */
  destroy(): void {
    this.destroyed = true;
    this.teardown();
  }
}
