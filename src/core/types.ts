import type { Container } from 'pixi.js';
import type { InputManager } from './InputManager';
import type { AudioManager } from './AudioManager';
import type { RNG } from '@utils/rng';

/** Status display the host renders as a DOM overlay above the canvas. */
export interface Hud {
  setScore(n: number): void;
  setLives(n: number): void;
  setLabel(text: string): void;
  toast(text: string): void;
}

/** Everything a game needs from the host. Games work in virtual coordinates. */
export interface GameContext {
  /** Virtual-coordinate world container — add all display objects here. */
  stage: Container;
  width: number;
  height: number;
  input: InputManager;
  audio: AudioManager;
  rng: RNG;
  hud: Hud;
  /**
   * Simulation speed multiplier from daily modifiers (1 for normal play). The host already
   * folds this into the dt it passes to update(); exposed for games that tune their own timers.
   */
  timeScale?: number;
  /** Signal the run is over; the host shows the game-over overlay and persists the score. */
  gameOver(score: number, custom?: Record<string, number>): void;
}

export interface Game {
  /** Advance simulation. dt is seconds, clamped by the loop. */
  update(dt: number): void;
  resize?(width: number, height: number): void;
  destroy(): void;
}

export type GameFactory = (ctx: GameContext) => Game | Promise<Game>;

export interface GameModule {
  default: GameFactory;
}
