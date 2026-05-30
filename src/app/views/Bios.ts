import { el } from '@utils/dom';
import { GAMES } from '@core/Registry';
import { settings } from '@store/settings';
import { audio } from '@core/AudioManager';

const LINES = [
  'RETRO POCKET BIOS v1.0',
  '(c) 2026 C0deWiz4rd010',
  '',
  '> Detecting display........ OK',
  '> Loading audio synth...... OK',
  '> Mounting save data....... OK',
  `> ${GAMES.length} cartridges found`,
  '> READY',
];

/** Retro BIOS/POST boot screen with a typing effect. Tap to skip. See docs/02 wireframe. */
export function renderBios(onDone: () => void): HTMLElement {
  const out = el('pre', {
    style:
      'font-family:var(--font-hud);font-size:18px;line-height:1.5;color:var(--primary);text-shadow:0 0 8px var(--glow);white-space:pre-wrap;margin:0',
  });
  const cursor = el('span', { style: 'animation:led-pulse 1s steps(2) infinite' }, ['_']);

  const root = el('div', {
    class: 'scroll',
    style: 'padding:max(24px,var(--safe-t)) 22px;cursor:pointer',
    onClick: () => finish(),
  }, [out, cursor]);

  let done = false;
  const finish = (): void => {
    if (done) return;
    done = true;
    audio.sfx('powerup');
    onDone();
  };

  const reduced = settings().a11y.reducedMotion;
  if (reduced) {
    out.textContent = LINES.join('\n');
    window.setTimeout(finish, 400);
    return root;
  }

  let line = 0;
  let char = 0;
  const tick = (): void => {
    if (done) return;
    if (line >= LINES.length) {
      window.setTimeout(finish, 600);
      return;
    }
    const text = LINES[line] ?? '';
    if (char === 0 && text.startsWith('>')) audio.sfx('blip');
    out.textContent += text[char] ?? '';
    char++;
    if (char > text.length) {
      out.textContent += '\n';
      line++;
      char = 0;
      window.setTimeout(tick, 180);
    } else {
      window.setTimeout(tick, 18);
    }
  };
  tick();

  return root;
}
