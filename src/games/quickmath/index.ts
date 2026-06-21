import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

type Problem = { label: string; answer: number; choices: number[] };

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  const g = new Graphics();
  const title = new Text({ text: 'QUICK MATH', style: { fontFamily: 'VT323, monospace', fontSize: 28, fill: 0x38bdf8 } });
  const problemText = new Text({ text: '', style: { fontFamily: 'Press Start 2P, monospace', fontSize: 22, fill: 0xffffff, align: 'center' } });
  const info = new Text({ text: '', style: { fontFamily: 'VT323, monospace', fontSize: 22, fill: 0xfacc15 } });
  title.anchor.set(0.5);
  problemText.anchor.set(0.5);
  info.anchor.set(0.5);
  title.position.set(W / 2, 54);
  problemText.position.set(W / 2, H * 0.32);
  info.position.set(W / 2, H * 0.45);
  layer.addChild(g, title, problemText, info);
  ctx.stage.addChild(layer);

  let score = 0;
  let lives = 3;
  let time = 45;
  let streak = 0;
  let shownAt = performance.now(); // Feature: speed bonus
  let problem = makeProblem();
  const labels: Text[] = [];

  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('45s');

  // Feature: difficulty ramps with score (bigger numbers + division)
  function makeProblem(): Problem {
    const level = 1 + Math.floor(score / 600);
    const maxMode = level >= 3 ? 3 : 2;
    const mode = ctx.rng.int(0, maxMode);
    let a: number, b: number, answer: number, label: string;
    if (mode === 3) {
      b = ctx.rng.int(2, 9);
      const q = ctx.rng.int(2, 9);
      a = b * q; answer = q; label = `${a} / ${b}`;
    } else {
      a = ctx.rng.int(2, mode === 2 ? 6 + level * 3 : 30 + level * 15);
      b = ctx.rng.int(2, mode === 2 ? 5 + level : 25 + level * 12);
      answer = mode === 0 ? a + b : mode === 1 ? Math.max(a, b) - Math.min(a, b) : a * b;
      label = mode === 0 ? `${a} + ${b}` : mode === 1 ? `${Math.max(a, b)} - ${Math.min(a, b)}` : `${a} x ${b}`;
    }
    const choices = new Set<number>([answer]);
    while (choices.size < 3) choices.add(Math.max(0, answer + ctx.rng.int(-10, 10) || answer + 1));
    return { label, answer, choices: [...choices].sort(() => ctx.rng.next() - 0.5) };
  }

  function choose(i: number): void {
    const picked = problem.choices[i];
    if (picked === undefined) return;
    if (picked === problem.answer) {
      streak++;
      const speed = Math.max(0, 70 - Math.round((performance.now() - shownAt) / 40)); // faster = more
      score += 80 + streak * 20 + speed;
      time = Math.min(60, time + 1); // Feature: correct answers add a little time
      if (streak % 5 === 0 && lives < 5) { lives++; ctx.hud.setLives(lives); ctx.hud.toast(`+1 LIFE (streak ${streak})`); } // Feature: streak life
      ctx.audio.sfx('coin');
      ctx.fx.floatingText(speed > 40 ? `FAST x${streak}` : `x${streak}`, W / 2, H * 0.24, 0x38bdf8);
    } else {
      streak = 0;
      lives--;
      ctx.audio.sfx('hit');
      ctx.fx.screenShake(4, 0.12);
      ctx.hud.setLives(lives);
      if (lives <= 0) {
        ctx.gameOver(score, { solved: Math.floor(score / 100) });
        return;
      }
    }
    problem = makeProblem();
    shownAt = performance.now();
    ctx.hud.setScore(score);
    draw();
  }

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (y < H * 0.58 || y > H * 0.78) return;
    choose(Math.min(2, Math.floor((x / W) * 3)));
  });
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'left') choose(0);
    else if (a === 'up' || a === 'a') choose(1);
    else if (a === 'right' || a === 'b') choose(2);
  });

  function draw(): void {
    labels.forEach((l) => l.destroy());
    labels.length = 0;
    g.clear();
    problemText.text = problem.label;
    info.text = `STREAK ${streak}`;
    const y = H * 0.62;
    problem.choices.forEach((choice, i) => {
      const x = W * (0.18 + i * 0.32);
      g.roundRect(x - 44, y, 88, 72, 10).fill({ color: 0x0f172a }).stroke({ width: 2, color: 0x38bdf8 });
      const t = new Text({ text: String(choice), style: { fontFamily: 'VT323, monospace', fontSize: 30, fill: 0xffffff } });
      t.anchor.set(0.5);
      t.position.set(x, y + 36);
      labels.push(t);
      layer.addChild(t);
    });
  }

  draw();
  return {
    update(dt) {
      time -= dt;
      ctx.hud.setLabel(`${Math.ceil(Math.max(0, time))}s`);
      if (time <= 0) ctx.gameOver(score, { solved: Math.floor(score / 100), streak });
    },
    destroy() {
      offTap();
      offDown();
      labels.forEach((l) => l.destroy());
      layer.destroy({ children: true });
    },
  };
}
