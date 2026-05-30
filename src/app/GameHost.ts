import { Container, Ticker } from 'pixi.js';
import { pixi } from '@core/PixiManager';
import { InputManager, type Action } from '@core/InputManager';
import { audio } from '@core/AudioManager';
import { haptics } from '@core/Haptics';
import { RNG } from '@utils/rng';
import { el, clear } from '@utils/dom';
import { submitScore, getBest, loadScores } from '@store/scores';
import { awardRun } from '@store/profile';
import type { Game, GameContext, Hud } from '@core/types';
import type { GameMeta } from '@core/Registry';

export interface RunOptions {
  seed?: number;
  label?: string; // e.g. "DAILY" banner
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

  private hudScore!: HTMLElement;
  private hudLabel!: HTMLElement;
  private hudLives!: HTMLElement;
  private overlayHost!: HTMLElement;

  constructor(
    private screenView: HTMLElement,
    private meta: GameMeta,
    private onExit: () => void,
  ) {}

  async start(opts: RunOptions = {}): Promise<void> {
    await loadScores(this.meta.id);
    audio.unlock();
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
      gameOver: (score, custom) => void this.handleGameOver(score, custom),
    };

    const mod = await this.meta.loader!();
    if (this.destroyed) return;
    this.game = await mod.default(ctx);

    this.running = true;
    this.tickFn = (t: Ticker) => {
      this.input.pollGamepad();
      if (!this.running || !this.game) return;
      const dt = Math.min(t.deltaMS / 1000, 0.05);
      this.game.update(dt);
    };
    pixi.app.ticker.add(this.tickFn);
  }

  // ── chrome: HUD, controls, pause button ──
  private buildChrome(): void {
    clear(this.screenView);
    this.screenView.classList.add('is-game', 'power-on');

    this.hudScore = el('div', { class: 'hud__score' }, ['0']);
    this.hudLabel = el('div', { class: 'hud__label' }, [this.meta.title.toUpperCase()]);
    this.hudLives = el('div', { class: 'hud__lives' });
    const pauseBtn = el('button', { class: 'iconbtn', 'aria-label': 'Pause', onClick: () => this.pause() }, ['⏸']);
    const hud = el('div', { class: 'hud' }, [this.hudScore, this.hudLabel, this.hudLives, pauseBtn]);

    this.overlayHost = el('div', { style: 'position:absolute;inset:0;pointer-events:none' });

    this.screenView.append(hud, this.buildControls(), this.overlayHost);
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
      setLabel: (t) => {
        this.hudLabel.textContent = t;
      },
      toast: (t) => this.toast(t),
    };
  }

  private toast(text: string): void {
    const node = el('div', { class: 'toast' }, [text]);
    this.screenView.append(node);
    window.setTimeout(() => node.remove(), 1900);
  }

  // ── pause / resume / restart ──
  private pause(): void {
    if (!this.running) return;
    this.running = false;
    audio.sfx('select');
    const panel = el('div', { class: 'panel' }, [
      el('div', { class: 'panel__title' }, ['PAUSED']),
      el('button', { class: 'btn btn--primary btn--block', onClick: () => this.resume() }, ['▶  Resume']),
      el('button', { class: 'btn btn--ghost btn--block', onClick: () => this.restart() }, ['↻  Restart']),
      el('button', { class: 'btn btn--ghost btn--block', onClick: () => this.exit() }, ['⌂  Home']),
    ]);
    this.showOverlay(panel);
  }

  private resume(): void {
    this.clearOverlay();
    this.running = true;
  }

  private async restart(): Promise<void> {
    this.teardown();
    await this.start();
  }

  private exit(): void {
    this.teardown();
    this.onExit();
  }

  private async handleGameOver(score: number, custom?: Record<string, number>): Promise<void> {
    if (!this.running && this.game === null) return;
    this.running = false;
    audio.sfx('gameover');
    haptics.bump();
    const isBest = await submitScore(this.meta.id, score, custom);
    const { leveledUp, newLevel } = awardRun(this.meta.id, score);

    const panel = el('div', { class: 'panel' }, [
      el('div', { class: 'panel__title' }, ['GAME OVER']),
      el('div', { class: 'panel__score' }, [String(score)]),
      el('div', { style: 'color:var(--text-muted);font-size:13px' }, [
        isBest ? '★ NEW BEST!' : `Best ${getBest(this.meta.id)}`,
      ]),
      leveledUp ? el('div', { style: 'color:var(--ok);font-size:13px' }, [`LEVEL UP → ${newLevel}`]) : '',
      el('div', { class: 'panel__row' }, [
        el('button', { class: 'btn btn--primary btn--block', onClick: () => this.restart() }, ['↻  Retry']),
        el('button', { class: 'btn btn--ghost btn--block', onClick: () => this.exit() }, ['⌂  Home']),
      ]),
    ]);
    this.showOverlay(panel);
  }

  private showOverlay(panel: HTMLElement): void {
    this.clearOverlay();
    const ov = el('div', { class: 'overlay' }, [panel]);
    ov.dataset.overlay = '1';
    this.screenView.append(ov);
  }
  private clearOverlay(): void {
    this.screenView.querySelector('[data-overlay]')?.remove();
  }

  private teardown(): void {
    this.running = false;
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
