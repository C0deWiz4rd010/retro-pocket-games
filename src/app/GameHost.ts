import { Container, Ticker } from 'pixi.js';
import { pixi } from '@core/PixiManager';
import { InputManager, type Action } from '@core/InputManager';
import { controlsForGame } from '@core/controlProfiles';
import { GameFX } from '@core/GameFX';
import { audio } from '@core/AudioManager';
import { haptics } from '@core/Haptics';
import { wakeLock } from '@core/WakeLock';
import { screenFX } from '@core/ScreenFX';
import { perf } from '@core/PerfMonitor';
import { RNG } from '@utils/rng';
import { el, clear } from '@utils/dom';
import { submitScore, getBest, loadScores } from '@store/scores';
import { awardRun, addPlayTime } from '@store/profile';
import { evaluateAchievements, buildContext, type Achievement } from '@store/achievements';
import { recordDailyResult, currentStreak } from '@store/dailyStore';
import { loadLeaderboard, qualifies, addEntry } from '@store/leaderboard';
import { hasSeenTutorial, markTutorialSeen } from '@store/prefs';
import { settings, updateSettings } from '@store/settings';
import { showTutorial } from './tutorial';
import { shareScoreCard } from './shareCard';
import { confettiBurst } from './confetti';
import { GAMES } from '@core/Registry';
import { t } from '@i18n/index';
import { icon } from '@ui/icons';
import { enterPop } from '@ui/motion';
import { attachTooltip } from '@ui/tooltip';
import type { Game, GameContext, Hud } from '@core/types';
import type { GameMeta, GameMode } from '@core/Registry';

export interface RunOptions {
  seed?: number;
  label?: string; // e.g. "DAILY" banner
  daily?: boolean; // counts toward the daily streak
  timeScale?: number; // daily modifier: simulation speed multiplier
  scoreMult?: number; // daily modifier: score multiplier applied at game over
  mode?: GameMode;
  practice?: boolean; // does not save scores, rewards, daily streaks, or achievements
}

/**
 * Mounts and runs a single game: builds the HUD + touch controls + pause/game-over overlays,
 * wires input, drives the Pixi ticker, and persists the score on game over. See docs/03 §6.
 */
export class GameHost {
  private input = new InputManager();
  private fx = new GameFX();
  private game: Game | null = null;
  private root = new Container();
  private tickFn: ((t: Ticker) => void) | null = null;
  private running = false;
  private destroyed = false;
  private startedAt = 0;
  private opts: RunOptions = {};

  private hudScore!: HTMLElement;
  private hudLabel!: HTMLElement;
  private hudLives!: HTMLElement;
  private hudBest!: HTMLElement;
  private overlayHost!: HTMLElement;
  private lastHudScore = 0;
  private lastHudLives = 0;

  constructor(
    private screenView: HTMLElement,
    private meta: GameMeta,
    private onExit: () => void,
  ) {}

  async start(opts: RunOptions = {}): Promise<void> {
    this.opts = opts;
    this.startedAt = performance.now();
    await Promise.all([loadScores(this.meta.id), loadLeaderboard(this.meta.id)]);
    audio.unlock();
    void wakeLock.request();
    pixi.setVirtual(this.meta.virtual.w, this.meta.virtual.h);
    pixi.clearWorld();
    this.root = new Container();
    pixi.world.addChild(this.root);
    this.fx.attach(this.root);

    this.buildChrome();
    const profile = this.meta.controls ?? controlsForGame({ id: this.meta.id, kit: this.meta.kit, orientation: this.meta.orientation });
    this.input.configure({ gamepadDeadzone: profile.gamepadDeadzone });
    this.input.attach(pixi.canvas, pixi.screenToVirtual);

    const ctx: GameContext = {
      stage: this.root,
      width: this.meta.virtual.w,
      height: this.meta.virtual.h,
      input: this.input,
      audio,
      rng: new RNG(opts.seed ?? (Date.now() & 0xffffffff)),
      hud: this.makeHud(),
      fx: this.fx,
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
      this.fx.update(dt);
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
    this.lastHudScore = 0;
    this.lastHudLives = 0;
    // Show the current best to beat (if any) as a subtle HUD badge.
    const best = getBest(this.meta.id);
    this.hudBest = el('div', { class: 'hud__best' }, [best > 0 ? `★ ${best}` : '']);
    const muteBtn = el('button', {
      class: 'iconbtn',
      'aria-label': t('settings.sfx'),
      onClick: (e: Event) => {
        const on = !settings().audio.sfx;
        updateSettings({ audio: { ...settings().audio, sfx: on } });
        (e.currentTarget as HTMLElement).textContent = on ? '🔊' : '🔇';
        if (on) audio.sfx('blip');
      },
    }, [settings().audio.sfx ? '🔊' : '🔇']);
    const pauseBtn = el('button', { class: 'iconbtn', 'aria-label': t('game.paused'), onClick: () => this.pause() }, ['⏸']);
    muteBtn.replaceChildren(icon(settings().audio.sfx ? 'soundOn' : 'soundOff'));
    attachTooltip(muteBtn, t('settings.sfx'));
    muteBtn.addEventListener('click', () => {
      window.setTimeout(() => muteBtn.replaceChildren(icon(settings().audio.sfx ? 'soundOn' : 'soundOff')));
    });
    pauseBtn.replaceChildren(icon('pause'));
    attachTooltip(pauseBtn, t('game.paused'));
    const hud = el('div', { class: 'hud' }, [this.hudScore, this.hudBest, this.hudLabel, this.hudLives, muteBtn, pauseBtn]);

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
    const profile = this.meta.controls ?? controlsForGame({ id: this.meta.id, kit: this.meta.kit, orientation: this.meta.orientation });
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

    return el('div', {
      class: `touch touch--${profile.preset} touch--${settings().controls.touchLayout}`,
      'data-pointer': profile.pointerMode,
    }, [dpad, actions]);
  }

  private makeHud(): Hud {
    return {
      setScore: (n) => {
        const delta = n - this.lastHudScore;
        this.hudScore.textContent = String(n);
        if (delta > 0) this.pulseHud(this.hudScore, 'is-up', delta >= 100 ? `+${delta}` : '');
        this.lastHudScore = n;
      },
      setLives: (n) => {
        this.hudLives.textContent = '♥'.repeat(Math.max(0, n));
        if (this.lastHudLives > 0 && n < this.lastHudLives) this.pulseHud(this.hudLives, 'is-hit');
        else if (n > this.lastHudLives) this.pulseHud(this.hudLives, 'is-up');
        this.lastHudLives = n;
      },
      setLabel: (txt) => {
        if (this.hudLabel.textContent !== txt) this.pulseHud(this.hudLabel, 'is-change');
        this.hudLabel.textContent = txt;
      },
      toast: (txt) => this.toast(txt),
    };
  }

  private pulseHud(node: HTMLElement, cls: string, delta = ''): void {
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
    window.setTimeout(() => node.classList.remove(cls), 360);
    if (!delta) return;
    const badge = el('span', { class: 'hud-delta' }, [delta]);
    node.append(badge);
    window.setTimeout(() => badge.remove(), 720);
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

    const practice = Boolean(this.opts.practice);
    const prevBest = getBest(this.meta.id);
    const isBest = practice ? false : await submitScore(this.meta.id, score, custom);
    const masteryRank = this.masteryRankForRun(score, custom);
    const reward = practice
      ? {
        leveledUp: false,
        newLevel: 0,
        xpGain: 0,
        tokenGain: 0,
        breakdown: { base: 0, score: 0, improvement: 0, daily: 0, mastery: 0 },
      }
      : awardRun(this.meta.id, score, {
        reward: this.meta.reward,
        previousBest: prevBest,
        daily: Boolean(this.opts.daily),
        masteryRank,
      });
    const { leveledUp, newLevel, xpGain } = reward;

    // Daily streak (only when this run came from the daily challenge).
    let streak = currentStreak();
    if (this.opts.daily && !practice) streak = recordDailyResult(this.meta.id, score, this.opts.label ?? '');

    // Achievements — evaluated centrally from the run payload + profile, no per-game code.
    const unlocked = practice ? [] : evaluateAchievements(buildContext(this.meta.id, score, custom, streak));

    const scoreEl = el('div', { class: 'panel__score' }, ['0']);
    this.countUp(scoreEl, score);
    // New-best delta over the previous record (only when it's actually a new best > 0).
    const bestLine =
      isBest && prevBest > 0
        ? `${t('game.newBest')}  (+${(score - prevBest).toLocaleString()})`
        : isBest
          ? t('game.newBest')
          : practice
            ? 'Practice run - score not saved'
            : t('game.best', { n: prevBest });
    const ratio = this.scoreRatio(score);
    const title = this.gameOverTitle(ratio, isBest, practice);
    const rows: (Node | string)[] = [
      el('div', { class: 'panel__title' }, [title]),
      scoreEl,
      el('div', { style: 'color:var(--text-muted);font-size:13px' }, [bestLine]),
      el('div', { class: 'run-comment' }, [this.gameOverComment(ratio, isBest, practice)]),
      this.performanceGrid(score, prevBest, ratio, custom),
      el('div', { class: 'panel__xp' }, [practice ? 'Practice mode: rewards paused' : `+${xpGain} Pixel XP  +${reward.tokenGain} Pocket Chips`]),
      this.rewardBreakdown(reward.breakdown),
    ];
    if (leveledUp) rows.push(el('div', { style: 'color:var(--ok);font-size:13px' }, [t('game.levelUp', { n: newLevel })]));
    if (this.opts.daily) rows.push(el('div', { class: 'daily-progress' }, [
      `Daily target: ${Math.min(score, this.meta.dailyRules?.targetScore ?? score)} / ${this.meta.dailyRules?.targetScore ?? score}`,
    ]));

    // Leaderboard: offer a name entry if the score cracks the local top 10.
    if (!practice && qualifies(this.meta.id, score)) {
      rows.push(this.buildNameEntry(score));
    }

    if (mult !== 1) {
      rows.push(el('div', { style: 'color:var(--accent);font-size:12px' }, [`×${mult} ${t('game.bonus')}`]));
    }

    rows.push(
      el('div', { class: 'panel__row' }, [
        el('button', { class: 'btn btn--primary btn--block', onClick: () => this.restart() }, [`↻  ${t('game.retry')}`]),
        el('button', { class: 'btn btn--ghost btn--block', onClick: () => this.nextGame() }, [`⏭  ${t('game.next')}`]),
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
      el('button', { class: 'btn btn--ghost btn--block', onClick: () => this.exit() }, [`⌂  ${t('game.home')}`]),
    );

    this.showOverlay(el('div', { class: 'panel' }, rows));
    // Celebrate a genuine new best with a confetti burst over the screen.
    if (isBest && prevBest > 0) confettiBurst(this.screenView);
    if (unlocked.length) this.toastAchievements(unlocked);
  }

  /** Jump to a random different game, keeping the player in flow. */
  private nextGame(): void {
    const pool = GAMES.filter((g) => g.available && g.id !== this.meta.id);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.teardown();
    location.hash = pick ? `#/play/${pick.id}` : '#/';
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

  private scoreRatio(score: number): number {
    return score / Math.max(1, this.meta.reward?.targetScore ?? 1000);
  }

  private gameOverTitle(ratio: number, isBest: boolean, practice: boolean): string {
    if (practice) return 'PRACTICE COMPLETE';
    if (isBest) return 'NEW PERSONAL BEST';
    if (ratio >= 1.2) return 'ELITE RUN';
    if (ratio >= 0.65) return 'SOLID RUN';
    return 'WARM-UP RUN';
  }

  private gameOverComment(ratio: number, isBest: boolean, practice: boolean): string {
    if (practice) return 'Good rehearsal. Switch to Challenge when the rhythm feels locked in.';
    if (isBest && ratio >= 1) return 'Clean execution and a new record. That one belongs on the shelf.';
    if (ratio >= 1.2) return 'Great run. You beat the target pace and left room for a leaderboard push.';
    if (ratio >= 0.65) return 'Nice middle stretch. One fewer risky mistake and this turns into a record chase.';
    return 'Rough start, useful data. Reset fast and focus on the first safe scoring pattern.';
  }

  private performanceGrid(score: number, prevBest: number, ratio: number, custom: Record<string, number>): HTMLElement {
    const delta = prevBest > 0 ? score - prevBest : score;
    return el('div', { class: 'performance-grid' }, [
      this.performanceCell(`${Math.round(ratio * 100)}%`, 'Target'),
      this.performanceCell(delta >= 0 ? `+${delta}` : String(delta), 'Best delta'),
      this.performanceCell(`${this.masteryRankForRun(score, custom)}/3`, 'Mastery'),
    ]);
  }

  private performanceCell(value: string, label: string): HTMLElement {
    return el('div', { class: 'performance-cell' }, [
      el('b', {}, [value]),
      el('span', {}, [label]),
    ]);
  }

  private masteryRankForRun(score: number, custom: Record<string, number>): number {
    let rank = 0;
    for (const goal of this.meta.masteryGoals ?? []) {
      const value = goal.metric === 'score' ? score : goal.metric === 'custom' ? custom[goal.customKey ?? ''] ?? 0 : 0;
      if (value >= goal.target) rank++;
    }
    return Math.min(3, rank);
  }

  private rewardBreakdown(breakdown: {
    base: number;
    score: number;
    improvement: number;
    daily: number;
    mastery: number;
  }): HTMLElement {
    const rows = [
      ['Base', breakdown.base],
      ['Score', breakdown.score],
      ['Improvement', breakdown.improvement],
      ['Daily', breakdown.daily],
      ['Mastery', breakdown.mastery],
    ].filter(([, value]) => Number(value) > 0);
    return el('div', { class: 'reward-breakdown' }, rows.map(([label, value]) =>
      el('div', { class: 'reward-breakdown__row' }, [
        el('span', {}, [String(label)]),
        el('b', {}, [`+${value}`]),
      ]),
    ));
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
    enterPop(panel);
    // Move focus into the dialog for keyboard + screen-reader users.
    const focusable = panel.querySelector<HTMLElement>('button, input, [tabindex]');
    focusable?.focus();
  }
  private clearOverlay(): void {
    this.screenView.querySelector('[data-overlay]')?.remove();
  }

  private teardown(): void {
    this.running = false;
    if (this.startedAt > 0) {
      addPlayTime(performance.now() - this.startedAt);
      this.startedAt = 0;
    }
    void wakeLock.release();
    perf.detach();
    if (this.tickFn) pixi.app.ticker.remove(this.tickFn);
    this.tickFn = null;
    this.game?.destroy();
    this.game = null;
    this.fx.clear();
    this.input.detach(pixi.canvas);
    pixi.clearWorld();
  }

  /** Called by the router when navigating away from a game. */
  destroy(): void {
    this.destroyed = true;
    this.teardown();
  }
}
