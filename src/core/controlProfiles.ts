import type { Action } from './InputManager';
import type { Kit, Orientation } from './Registry';

export type TouchSurface = 'dpad' | 'actions' | 'swipe' | 'tap' | 'drag';
export type PointerMode = 'none' | 'tap' | 'drag' | 'aim';

export interface ControlActionHint {
  action: Action;
  label: string;
}

export interface ControlProfile {
  preset: 'grid' | 'falling' | 'swipe' | 'tap' | 'drag' | 'shooter' | 'vector' | 'dual' | 'none';
  surfaces: TouchSurface[];
  pointerMode: PointerMode;
  primaryActions: ControlActionHint[];
  hints: string[];
  gamepadDeadzone: number;
}

const base = (profile: Omit<ControlProfile, 'gamepadDeadzone'>): ControlProfile => ({
  ...profile,
  gamepadDeadzone: 0.5,
});

export const CONTROL_PROFILES = {
  grid: base({
    preset: 'grid',
    surfaces: ['dpad', 'actions', 'swipe'],
    pointerMode: 'none',
    primaryActions: [{ action: 'a', label: 'A' }],
    hints: ['Move', 'Action'],
  }),
  falling: base({
    preset: 'falling',
    surfaces: ['dpad', 'actions', 'swipe'],
    pointerMode: 'none',
    primaryActions: [
      { action: 'a', label: 'Cycle' },
      { action: 'b', label: 'Drop' },
    ],
    hints: ['Move', 'Cycle', 'Drop'],
  }),
  swipe: base({
    preset: 'swipe',
    surfaces: ['swipe'],
    pointerMode: 'none',
    primaryActions: [],
    hints: ['Swipe'],
  }),
  tap: base({
    preset: 'tap',
    surfaces: ['tap'],
    pointerMode: 'tap',
    primaryActions: [],
    hints: ['Tap'],
  }),
  drag: base({
    preset: 'drag',
    surfaces: ['drag', 'actions'],
    pointerMode: 'drag',
    primaryActions: [{ action: 'a', label: 'Launch' }],
    hints: ['Drag', 'Action'],
  }),
  shooter: base({
    preset: 'shooter',
    surfaces: ['dpad', 'actions', 'drag'],
    pointerMode: 'drag',
    primaryActions: [{ action: 'a', label: 'Fire' }],
    hints: ['Move', 'Fire'],
  }),
  vector: base({
    preset: 'vector',
    surfaces: ['dpad', 'actions'],
    pointerMode: 'none',
    primaryActions: [
      { action: 'a', label: 'Thrust' },
      { action: 'b', label: 'Fire' },
    ],
    hints: ['Rotate', 'Thrust', 'Fire'],
  }),
  none: base({
    preset: 'none',
    surfaces: [],
    pointerMode: 'none',
    primaryActions: [],
    hints: [],
  }),
} satisfies Record<string, ControlProfile>;

const explicit: Record<string, ControlProfile> = {
  columns: CONTROL_PROFILES.falling,
  tetris: CONTROL_PROFILES.falling,
  g2048: CONTROL_PROFILES.swipe,
  match3: CONTROL_PROFILES.tap,
  minesweeper: CONTROL_PROFILES.tap,
  memory: CONTROL_PROFILES.tap,
  lightsout: CONTROL_PROFILES.tap,
  mastermind: CONTROL_PROFILES.tap,
  simon: CONTROL_PROFILES.tap,
  blackjack: CONTROL_PROFILES.tap,
  pong: CONTROL_PROFILES.drag,
  breakout: CONTROL_PROFILES.drag,
  bubble: CONTROL_PROFILES.drag,
  missile: CONTROL_PROFILES.tap,
  asteroids: CONTROL_PROFILES.vector,
  lander: CONTROL_PROFILES.vector,
  crystalvault: CONTROL_PROFILES.tap,
  starforge: CONTROL_PROFILES.tap,
  runereactor: CONTROL_PROFILES.tap,
  cometsweep: CONTROL_PROFILES.tap,
  gearlock: CONTROL_PROFILES.tap,
  echorunner: CONTROL_PROFILES.tap,
  driftracer: CONTROL_PROFILES.vector,
  pinball: base({
    preset: 'dual',
    surfaces: ['actions'],
    pointerMode: 'none',
    primaryActions: [
      { action: 'a', label: 'Left' },
      { action: 'b', label: 'Right' },
    ],
    hints: ['Flippers'],
  }),
};

export function controlsForGame(args: { id: string; kit: Kit; orientation: Orientation }): ControlProfile {
  const byId = explicit[args.id];
  if (byId) return byId;
  if (args.kit === 'shooter') return CONTROL_PROFILES.shooter;
  if (args.kit === 'paddle') return CONTROL_PROFILES.drag;
  if (args.kit === 'vector') return CONTROL_PROFILES.vector;
  if (args.kit === 'standalone') return CONTROL_PROFILES.tap;
  return CONTROL_PROFILES.grid;
}
