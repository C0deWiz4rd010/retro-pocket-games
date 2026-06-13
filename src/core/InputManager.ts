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

const DEFAULT_KEY_MAP: Record<string, Action> = {
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
  9: 'start',
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
  private keyMap: Record<string, Action> = { ...DEFAULT_KEY_MAP };
  private gamepadDeadzone = 0.5;
  private toVirtual: (clientX: number, clientY: number) => { x: number; y: number } = (x, y) => ({
    x,
    y,
  });

  // pointer/swipe tracking
  private pStart: { x: number; y: number; t: number } | null = null;
  private pDown = false;

  private onKeyDown = (e: KeyboardEvent): void => {
    const a = this.keyMap[e.code];
    if (!a) return;
    e.preventDefault();
    if (!e.repeat) this.press(a);
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    const a = this.keyMap[e.code];
    if (a) this.release(a);
  };

  attach(canvas: HTMLElement, toVirtual: (cx: number, cy: number) => { x: number; y: number }): void {
    this.toVirtual = toVirtual;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
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
    this.pressed.clear();
    this.clear();
  }

  press(a: Action): void {
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

  /** Poll gamepads; call once per frame from the host loop. */
  pollGamepad(): void {
    const pads = navigator.getGamepads?.() ?? [];
    const now = new Set<Action>();
    for (const pad of pads) {
      if (!pad) continue;
      pad.buttons.forEach((btn, i) => {
        const a = GAMEPAD_BUTTONS[i];
        if (a && btn.pressed) now.add(a);
      });
      const [ax = 0, ay = 0] = pad.axes;
      if (ax < -this.gamepadDeadzone) now.add('left');
      else if (ax > this.gamepadDeadzone) now.add('right');
      if (ay < -this.gamepadDeadzone) now.add('up');
      else if (ay > this.gamepadDeadzone) now.add('down');
    }
    for (const a of now) if (!this.gpDirPrev.has(a)) this.press(a);
    for (const a of this.gpDirPrev) if (!now.has(a)) this.release(a);
    this.gpDirPrev = now;
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.pDown = true;
    this.pStart = { x: e.clientX, y: e.clientY, t: performance.now() };
    const v = this.toVirtual(e.clientX, e.clientY);
    this.emit('pointermove', { ...v, down: true });
  };

  private onPointerMove = (e: PointerEvent): void => {
    const v = this.toVirtual(e.clientX, e.clientY);
    this.emit('pointermove', { ...v, down: this.pDown });
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.pStart) {
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
