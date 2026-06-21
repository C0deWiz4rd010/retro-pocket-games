import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

const WORDS = ['PIXEL', 'ARCADE', 'VECTOR', 'BUTTON', 'PUZZLE', 'TOKEN', 'RETRO', 'SPRITE', 'COMBO', 'POCKET', 'JOYSTICK', 'CONSOLE', 'NEON', 'GLITCH', 'POWERUP', 'CHIPTUNE', 'CARTRIDGE', 'HIGHSCORE'];

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  const g = new Graphics();
  const title = new Text({ text: 'WORD MIX', style: { fontFamily: 'VT323, monospace', fontSize: 30, fill: 0xa78bfa } });
  const scramble = new Text({ text: '', style: { fontFamily: 'Press Start 2P, monospace', fontSize: 22, fill: 0xffffff } });
  title.anchor.set(0.5);
  scramble.anchor.set(0.5);
  title.position.set(W / 2, 56);
  scramble.position.set(W / 2, H * 0.32);
  layer.addChild(g, title, scramble);
  ctx.stage.addChild(layer);

  let answer = '';
  let choices: string[] = [];
  let score = 0;
  let lives = 3;
  let time = 50;
  let streak = 0; // Feature: streak multiplier
  let hints = 3; // Feature: 50/50 eliminate hint
  let shownAt = performance.now();
  const eliminated = new Set<number>();
  const labels: Text[] = [];

  ctx.hud.setScore(score);
  ctx.hud.setLives(lives);
  const setLabel = (): void => ctx.hud.setLabel(`${Math.ceil(Math.max(0, time))}s · 💡${hints}`);
  setLabel();

  function shuffleWord(word: string): string {
    let s = word;
    for (let i = 0; i < 8 && s === word; i++) s = word.split('').sort(() => ctx.rng.next() - 0.5).join('');
    return s;
  }

  function next(): void {
    answer = WORDS[ctx.rng.int(0, WORDS.length - 1)]!;
    const set = new Set<string>([answer]);
    while (set.size < 3) set.add(WORDS[ctx.rng.int(0, WORDS.length - 1)]!);
    choices = [...set].sort(() => ctx.rng.next() - 0.5);
    scramble.text = shuffleWord(answer);
    eliminated.clear();
    shownAt = performance.now();
    draw();
  }

  function useHint(): void {
    if (hints <= 0) return;
    const wrong = choices.map((c, i) => (c !== answer && !eliminated.has(i) ? i : -1)).filter((i) => i >= 0);
    if (!wrong.length) return;
    hints--;
    eliminated.add(ctx.rng.pick(wrong));
    ctx.audio.sfx('powerup');
    setLabel();
    draw();
  }

  function choose(i: number): void {
    if (eliminated.has(i)) return;
    if (choices[i] === answer) {
      streak++;
      const mult = 1 + Math.floor(streak / 4);
      const speed = Math.max(0, 60 - Math.round((performance.now() - shownAt) / 60));
      score += (180 + speed) * mult;
      time += 1.5;
      ctx.audio.sfx('coin');
      ctx.fx.floatingText(streak >= 4 ? `x${mult}` : '+WORD', W / 2, H * 0.22, 0xa78bfa);
      next();
    } else {
      streak = 0;
      lives--;
      ctx.audio.sfx('hit');
      ctx.fx.screenShake(4, 0.12);
      ctx.hud.setLives(lives);
      if (lives <= 0) { ctx.gameOver(score, { streak }); return; }
    }
    ctx.hud.setScore(score);
  }

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (y < H * 0.56 || y > H * 0.84) return;
    choose(Math.min(2, Math.floor((x / W) * 3)));
  });
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'start' || a === 'select') useHint();
    else if (a === 'left') choose(0);
    else if (a === 'up' || a === 'a') choose(1);
    else if (a === 'right' || a === 'b') choose(2);
  });

  function draw(): void {
    labels.forEach((l) => l.destroy());
    labels.length = 0;
    g.clear();
    const y = H * 0.62;
    choices.forEach((choice, i) => {
      const x = W * (0.18 + i * 0.32);
      const gone = eliminated.has(i);
      g.roundRect(x - 52, y, 104, 74, 10).fill({ color: gone ? 0x161122 : 0x24183f }).stroke({ width: 2, color: gone ? 0x3a3450 : 0xa78bfa, alpha: gone ? 0.4 : 1 });
      const t = new Text({ text: gone ? '✗' : choice, style: { fontFamily: 'VT323, monospace', fontSize: 22, fill: gone ? 0x5a5470 : 0xffffff } });
      t.anchor.set(0.5);
      t.position.set(x, y + 37);
      labels.push(t);
      layer.addChild(t);
    });
  }

  next();
  return {
    update(dt) {
      if (lives <= 0) return;
      time -= dt;
      setLabel();
      if (time <= 0) ctx.gameOver(score, { streak });
    },
    destroy() {
      offTap();
      offDown();
      labels.forEach((l) => l.destroy());
      layer.destroy({ children: true });
    },
  };
}
