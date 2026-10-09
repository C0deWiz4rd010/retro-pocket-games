import { Emitter } from '@utils/events';

export type Action = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'start' | 'select' | 'pause';
export type Dir = 'up' | 'down' | 'left' | 'right';

type InputEvents = {
  down: Action;
  up: Action;
  swipe: Dir;
  tap: { x: number; y: number };
  pointermove: { x: number; y: number; down: boolean };
};

/** Build a code→action override map from action→code user bindings (Settings rebinding UI). */
export function keyMapFromBindings(bindings: Record<string, string>): Record<string, Action> {
  const out: Record<string, Action> = {};
  for (const [action, code] of Object.entries(bindings)) {
    if (code) out[code] = action as Action;
  }
  return out;
}

export const DEFAULT_KEY_MAP: Record<string, Action> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  KeyZ: 'a',
  KeyJ: 'a',
  Space: 'a',
  KeyX: 'b',
  KeyK: 'b',
  Enter: 'start',
  Escape: 'pause',
  KeyP: 'pause',
  ShiftLeft: 'select',
};

const GAMEPAD_BUTTONS: Record<number, Action> = {
  0: 'a',
  1: 'b',
  8: 'select',
  9: 'pause', // Start button pauses; games keep Enter as their own 'start' action
  12: 'up',
  13: 'down',
  14: 'left',
  15: 'right',
};

/**
 * Normalizes keyboard + touch + gamepad into semantic actions. Touch controls call
 * press()/release(); the host wires pointer events for swipe/tap/pointer. See docs/03 §7.
 */
export class InputManager extends Emitter<InputEvents> {
  private pressed = new Set<Action>();
  private gpDirPrev = new Set<Action>();
  private gpDirNow = new Set<Action>();
  /** Connected gamepads; the per-frame poll is skipped entirely while this is 0. */
  private padCount = 0;
  private keyMap: Record<string, Action> = { ...DEFAULT_KEY_MAP };
  private gamepadDeadzone = 0.5;
  private toVirtual: (clientX: number, clientY: number) => { x: number; y: number } = (x, y) => ({
    x,
    y,
  });

  // pointer/swipe tracking
  private pStart: { x: number; y: number; t: number } | null = null;
  private pDown = false;
  /** While blocked (paused / overlay / countdown) only the 'pause' action reaches listeners. */
  private blocked = false;

  private onKeyDown = (e: KeyboardEvent): void => {
    const a = this.keyMap[e.code];
    if (!a) return;
    e.preventDefault();
    if (!e.repeat) this.press(a);
  };
  private onPadConnected = (): void => {
    this.padCount++;
  };
  private onPadDisconnected = (): void => {
    this.padCount = Math.max(0, this.padCount - 1);
    if (this.padCount === 0) this.releaseGamepad();
  };
  private onBlur = (): void => this.releaseAll();
  private onVisibility = (): void => {
    if (document.visibilityState === 'hidden') this.releaseAll();
  };
  private onPointerCancel = (): void => {
    this.pDown = false;
    this.pStart = null;
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    const a = this.keyMap[e.code];
    if (a) this.release(a);
  };

  attach(
    canvas: HTMLElement,
    toVirtual: (cx: number, cy: number) => { x: number; y: number },
  ): void {
    this.toVirtual = toVirtual;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerCancel);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('gamepadconnected', this.onPadConnected);
    window.addEventListener('gamepaddisconnected', this.onPadDisconnected);
    // A pad that was already connected (and woken by a button press) before this game mounted.
    this.padCount = [...(navigator.getGamepads?.() ?? [])].filter(Boolean).length;
  }

  configure(opts: { keyMap?: Record<string, Action>; gamepadDeadzone?: number }): void {
    if (opts.keyMap) this.keyMap = { ...DEFAULT_KEY_MAP, ...opts.keyMap };
    if (opts.gamepadDeadzone !== undefined) this.gamepadDeadzone = opts.gamepadDeadzone;
  }

  detach(canvas: HTMLElement): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerCancel);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('gamepadconnected', this.onPadConnected);
    window.removeEventListener('gamepaddisconnected', this.onPadDisconnected);
    this.pressed.clear();
    this.blocked = false;
    this.clear();
  }

  /** Gate game input (pause/overlays). Releases anything held so nothing sticks on resume. */
  setBlocked(blocked: boolean): void {
    if (this.blocked === blocked) return;
    this.blocked = blocked;
    if (blocked) {
      this.releaseAll();
      this.pDown = false;
      this.pStart = null;
    }
  }

  /** Release every held action (blur, visibility change, pause) so inputs never get stuck. */
  releaseAll(): void {
    for (const a of [...this.pressed]) this.release(a);
    this.gpDirPrev.clear();
  }

  press(a: Action): void {
    if (this.blocked && a !== 'pause') return;
    if (this.pressed.has(a)) return;
    this.pressed.add(a);
    this.emit('down', a);
  }

  release(a: Action): void {
    if (!this.pressed.has(a)) return;
    this.pressed.delete(a);
    this.emit('up', a);
  }

  isDown(a: Action): boolean {
    return this.pressed.has(a);
  }

  /** Directional axis from held actions, range -1..1 each. */
  axis(): { x: number; y: number } {
    const x = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
    const y = (this.isDown('down') ? 1 : 0) - (this.isDown('up') ? 1 : 0);
    return { x, y };
  }

  private releaseGamepad(): void {
    for (const a of this.gpDirPrev) this.release(a);
    this.gpDirPrev.clear();
  }

  /** Poll gamepads; call once per frame from the host loop. No-op (and no allocation) without one. */
  pollGamepad(): void {
    if (this.padCount === 0) return;
    const pads = navigator.getGamepads?.() ?? [];
    const now = this.gpDirNow;
    now.clear();
    for (const pad of pads) {
      if (!pad) continue;
      for (let i = 0; i < pad.buttons.length; i++) {
        const a = GAMEPAD_BUTTONS[i];
        if (a && pad.buttons[i]!.pressed) now.add(a);
      }
      const [ax = 0, ay = 0] = pad.axes;
      if (ax < -this.gamepadDeadzone) now.add('left');
      else if (ax > this.gamepadDeadzone) now.add('right');
      if (ay < -this.gamepadDeadzone) now.add('up');
      else if (ay > this.gamepadDeadzone) now.add('down');
    }
    for (const a of now) if (!this.gpDirPrev.has(a)) this.press(a);
    for (const a of this.gpDirPrev) if (!now.has(a)) this.release(a);
    // Swap buffers instead of allocating a fresh Set every frame.
    this.gpDirNow = this.gpDirPrev;
    this.gpDirPrev = now;
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (this.blocked) return;
    this.pDown = true;
    this.pStart = { x: e.clientX, y: e.clientY, t: performance.now() };
    const v = this.toVirtual(e.clientX, e.clientY);
    this.emit('pointermove', { ...v, down: true });
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.blocked) return;
    const v = this.toVirtual(e.clientX, e.clientY);
    this.emit('pointermove', { ...v, down: this.pDown });
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (this.blocked || !this.pStart) {
      this.pStart = null;
      this.pDown = false;
      return;
    }
    const dx = e.clientX - this.pStart.x;
    const dy = e.clientY - this.pStart.y;
    const dt = performance.now() - this.pStart.t;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (Math.max(adx, ady) > 28 && dt < 600) {
      this.emit('swipe', adx > ady ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    } else if (Math.max(adx, ady) < 12 && dt < 300) {
      this.emit('tap', this.toVirtual(e.clientX, e.clientY));
    }
    this.pDown = false;
    this.pStart = null;
  };
}
