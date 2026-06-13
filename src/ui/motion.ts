import { animate } from 'motion/mini';

const reduceMotion = (): boolean => document.documentElement.classList.contains('a11y-reduced-motion');

export function enterPop(node: Element): void {
  if (reduceMotion()) return;
  void animate(node, { opacity: [0, 1], y: [8, 0], scale: [0.98, 1] }, {
    duration: 0.18,
    ease: 'easeOut',
  });
}

export function pressPop(node: Element): void {
  if (reduceMotion()) return;
  void animate(node, { scale: [1, 0.96, 1] }, {
    duration: 0.16,
    ease: 'easeOut',
  });
}
