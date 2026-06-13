import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom';

let activeCleanup: (() => void) | null = null;

export function attachTooltip(target: HTMLElement, text: string): void {
  target.setAttribute('data-tooltip', text);
  const show = (): void => {
    hide();
    const tip = document.createElement('div');
    tip.className = 'tooltip';
    tip.textContent = text;
    document.body.append(tip);
    activeCleanup = autoUpdate(target, tip, () => {
      void computePosition(target, tip, {
        placement: 'bottom',
        middleware: [offset(8), flip(), shift({ padding: 8 })],
      }).then(({ x, y }) => {
        Object.assign(tip.style, { left: `${x}px`, top: `${y}px` });
      });
    });
  };
  const hide = (): void => {
    activeCleanup?.();
    activeCleanup = null;
    document.querySelector('.tooltip')?.remove();
  };
  target.addEventListener('pointerenter', show);
  target.addEventListener('focus', show);
  target.addEventListener('pointerleave', hide);
  target.addEventListener('blur', hide);
}
