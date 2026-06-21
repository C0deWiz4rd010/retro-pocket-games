import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

const WORDS = ['PIXEL', 'ARCADE', 'POCKET', 'VECTOR', 'BUTTON', 'PUZZLE', 'RETRO', 'SCREEN', 'JOYSTICK', 'CARTRIDGE', 'HIGHSCORE', 'POWERUP', 'NEON', 'CONSOLE', 'CHIPTUNE', 'GLITCH'];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  const title = new Text({ text: '', style: { fontFamily: 'VT323, monospace', fontSize: 30, fill: 0x7dd3fc, align: 'center' } });
  const wordText = new Text({ text: '', style: { fontFamily: 'VT323, monospace', fontSize: 34, fill: 0xffffff, align: 'center' } });
  const info = new Text({ text: '', style: { fontFamily: 'VT323, monospace', fontSize: 20, fill: 0xffd200, align: 'center' } });
  title.anchor.set(0.5);
  wordText.anchor.set(0.5);
  info.anchor.set(0.5);
  title.position.set(W / 2, 44);
  wordText.position.set(W / 2, H * 0.38);
  info.position.set(W / 2, H * 0.47);
  layer.addChild(g, title, wordText, info);
  const tempTexts: Text[] = [];
  const addTemp = (node: Text): void => {
    tempTexts.push(node);
    layer.addChild(node);
  };
  const cleanTemps = (): void => {
    for (const node of tempTexts) node.destroy();
    tempTexts.length = 0;
  };

  let word = ctx.rng.pick(WORDS);
  const guessed = new Set<string>();
  let misses = 0;
  let over = false;
  let score = 0;
  let round = 1; // Feature: round progression
  let hints = 2; // Feature: reveal-a-letter hint
  const maxMisses = 6;

  ctx.hud.setScore(0);
  const setLabel = (): void => ctx.hud.setLabel(`ROUND ${round} · ✗${misses}/${maxMisses} · 💡${hints}`);
  setLabel();

  const newWord = (): void => {
    word = ctx.rng.pick(WORDS);
    guessed.clear();
    misses = 0;
    round++;
    setLabel();
  };

  const visibleWord = (): string => word.split('').map((l) => (guessed.has(l) ? l : '_')).join(' ');
  const hasWon = (): boolean => word.split('').every((l) => guessed.has(l));

  const guess = (letter: string): void => {
    if (over || guessed.has(letter)) return;
    guessed.add(letter);
    if (word.includes(letter)) {
      score += 100;
      ctx.audio.sfx('coin');
      ctx.fx.floatingText('+100', W / 2, H * 0.32, 0xffd200);
    } else {
      misses++;
      ctx.audio.sfx('hit');
      ctx.fx.screenShake(4, 0.12);
    }
    if (hasWon()) {
      // Feature: solved → bank a bonus and advance to the next word
      score += Math.max(0, maxMisses - misses) * 250 + round * 100;
      ctx.audio.sfx('levelup');
      ctx.fx.floatingText('SOLVED!', W / 2, H * 0.3, 0x3ddc84);
      ctx.hud.setScore(score);
      newWord();
      draw();
      return;
    } else if (misses >= maxMisses) {
      over = true;
      ctx.gameOver(score, { misses, round });
    }
    setLabel();
    ctx.hud.setScore(score);
    draw();
  };

  const useHint = (): void => {
    if (over || hints <= 0) return;
    const unrevealed = word.split('').filter((l) => !guessed.has(l));
    if (!unrevealed.length) return;
    hints--;
    guess(ctx.rng.pick(unrevealed)); // reveals a correct letter (guess handles win)
  };

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    const cols = 7;
    const keyW = W / cols;
    const keyH = 38;
    const top = H * 0.58;
    const c = Math.floor(x / keyW);
    const r = Math.floor((y - top) / keyH);
    const index = r * cols + c;
    const letter = LETTERS[index];
    if (letter) guess(letter);
  });
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'b' || a === 'start') { useHint(); return; }
    if (a === 'a') {
      const next = LETTERS.find((l) => !guessed.has(l));
      if (next) guess(next);
    }
  });
  const onKey = (e: KeyboardEvent): void => {
    const letter = e.key.toUpperCase();
    if (/^[A-Z]$/.test(letter)) guess(letter);
  };
  window.addEventListener('keydown', onKey);

  function draw(): void {
    cleanTemps();
    g.clear();
    title.text = 'GUESS THE WORD';
    wordText.text = visibleWord();
    info.text = over ? word : `MISSES ${misses}/${maxMisses}`;

    g.roundRect(W * 0.22, H * 0.1, W * 0.56, H * 0.18, 10).stroke({ width: 3, color: 0x7dd3fc, alpha: 0.8 });
    g.moveTo(W * 0.34, H * 0.26).lineTo(W * 0.34, H * 0.13).lineTo(W * 0.55, H * 0.13).lineTo(W * 0.55, H * 0.17).stroke({ width: 4, color: 0xdbeafe });
    if (misses > 0) g.circle(W * 0.55, H * 0.2, 15).stroke({ width: 3, color: 0xffffff });
    if (misses > 1) g.moveTo(W * 0.55, H * 0.215).lineTo(W * 0.55, H * 0.26).stroke({ width: 3, color: 0xffffff });
    if (misses > 2) g.moveTo(W * 0.55, H * 0.23).lineTo(W * 0.51, H * 0.25).stroke({ width: 3, color: 0xffffff });
    if (misses > 3) g.moveTo(W * 0.55, H * 0.23).lineTo(W * 0.59, H * 0.25).stroke({ width: 3, color: 0xffffff });
    if (misses > 4) g.moveTo(W * 0.55, H * 0.26).lineTo(W * 0.52, H * 0.29).stroke({ width: 3, color: 0xffffff });
    if (misses > 5) g.moveTo(W * 0.55, H * 0.26).lineTo(W * 0.58, H * 0.29).stroke({ width: 3, color: 0xffffff });

    const cols = 7;
    const keyW = W / cols;
    const keyH = 38;
    const top = H * 0.58;
    LETTERS.forEach((letter, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = c * keyW + 4;
      const y = top + r * keyH;
      const used = guessed.has(letter);
      // Feature: colour feedback — green for correct guesses, red for wrong
      const keyColor = used ? (word.includes(letter) ? 0x1d6e44 : 0x7a2424) : 0x164e63;
      g.roundRect(x, y, keyW - 8, keyH - 6, 7).fill({ color: keyColor }).stroke({ width: 1, color: 0x7dd3fc, alpha: used ? 0.25 : 0.9 });
      const t = new Text({ text: letter, style: { fontFamily: 'VT323, monospace', fontSize: 20, fill: used ? 0xcccccc : 0xffffff } });
      t.anchor.set(0.5);
      t.position.set(c * keyW + keyW / 2, y + keyH / 2 - 2);
      addTemp(t);
    });
  }

  draw();
  return {
    update() {},
    destroy() {
      offTap();
      offDown();
      window.removeEventListener('keydown', onKey);
      cleanTemps();
      layer.destroy({ children: true });
    },
  };
}
