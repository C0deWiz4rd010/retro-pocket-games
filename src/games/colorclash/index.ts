import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

const COLORS = [
  { name: 'RED', value: 0xef4444 },
  { name: 'BLUE', value: 0x38bdf8 },
  { name: 'GREEN', value: 0x22c55e },
  { name: 'YELLOW', value: 0xfacc15 },
] as const;

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  const g = new Graphics();
  const prompt = new Text({ text: 'TAP THE INK', style: { fontFamily: 'VT323, monospace', fontSize: 28, fill: 0xffffff } });
  const word = new Text({ text: '', style: { fontFamily: 'Press Start 2P, monospace', fontSize: 28, fill: 0xffffff } });
  prompt.anchor.set(0.5);
  word.anchor.set(0.5);
  prompt.position.set(W / 2, H * 0.22);
  word.position.set(W / 2, H * 0.38);
  layer.addChild(g, prompt, word);
  ctx.stage.addChild(layer);

  let score = 0;
  let lives = 3;
  let time = 35;
  let target = 0;
  let streak = 0; // Feature: streak multiplier
  let qTime = 3; // Feature: per-question timer
  let qMax = 3;
  let shownAt = performance.now();
  const labels: Text[] = [];

  ctx.hud.setScore(score);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('35s');

  function next(): void {
    const level = 1 + Math.floor(score / 1000);
    const nameIdx = ctx.rng.int(0, COLORS.length - 1);
    const inkIdx = ctx.rng.int(0, COLORS.length - 1);
    // Feature: rule flip — sometimes you must tap the WORD's meaning, not the ink
    const wordMode = level >= 2 && ctx.rng.next() < 0.35;
    target = wordMode ? nameIdx : inkIdx;
    prompt.text = wordMode ? 'TAP THE WORD' : 'TAP THE INK';
    prompt.style.fill = wordMode ? 0xfacc15 : 0xffffff;
    word.text = COLORS[nameIdx]!.name;
    word.style.fill = COLORS[inkIdx]!.value;
    qMax = Math.max(1.4, 3 - level * 0.18);
    qTime = qMax;
    shownAt = performance.now();
    draw();
  }

  function miss(): void {
    streak = 0;
    lives--;
    ctx.audio.sfx('hit');
    ctx.fx.screenShake(4, 0.1);
    ctx.hud.setLives(lives);
    if (lives <= 0) { ctx.gameOver(score, { streak }); return; }
    next();
  }

  function choose(i: number): void {
    if (i === target) {
      streak++;
      const mult = 1 + Math.floor(streak / 5);
      const speed = Math.max(0, 50 - Math.round((performance.now() - shownAt) / 30));
      score += (120 + speed) * mult;
      time += 0.8;
      ctx.audio.sfx('coin');
      ctx.fx.floatingText(streak >= 5 ? `x${mult}` : '+TIME', W / 2, H * 0.48, COLORS[target]!.value);
      ctx.hud.setScore(score);
      next();
    } else {
      ctx.hud.setScore(score);
      miss();
    }
  }

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (y < H * 0.58 || y > H * 0.86) return;
    choose(Math.min(3, Math.floor((x / W) * 4)));
  });
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'left') choose(0);
    else if (a === 'up') choose(1);
    else if (a === 'right') choose(2);
    else if (a === 'a' || a === 'b') choose(3);
  });

  function draw(): void {
    labels.forEach((l) => l.destroy());
    labels.length = 0;
    g.clear();
    // per-question timer bar
    const tw = (W * 0.6) * Math.max(0, qTime / qMax);
    g.rect(W * 0.2, H * 0.5, W * 0.6, 5).fill({ color: 0x000000, alpha: 0.4 });
    g.rect(W * 0.2, H * 0.5, tw, 5).fill({ color: qTime < qMax * 0.3 ? 0xef4444 : 0x22c55e });
    const y = H * 0.64;
    COLORS.forEach((c, i) => {
      const x = W * (0.125 + i * 0.25);
      g.roundRect(x - 38, y, 76, 76, 12).fill({ color: c.value }).stroke({ width: 2, color: 0xffffff });
      const t = new Text({ text: c.name.slice(0, 1), style: { fontFamily: 'Press Start 2P, monospace', fontSize: 16, fill: 0x0f172a } });
      t.anchor.set(0.5);
      t.position.set(x, y + 38);
      labels.push(t);
      layer.addChild(t);
    });
  }

  next();
  return {
    update(dt) {
      if (lives <= 0) return;
      time -= dt;
      qTime -= dt;
      ctx.hud.setLabel(streak >= 5 ? `${Math.ceil(Math.max(0, time))}s · x${1 + Math.floor(streak / 5)}` : `${Math.ceil(Math.max(0, time))}s`);
      if (qTime <= 0) { miss(); return; }
      if (time <= 0) ctx.gameOver(score, { streak });
      draw();
    },
    destroy() {
      offTap();
      offDown();
      labels.forEach((l) => l.destroy());
      layer.destroy({ children: true });
    },
  };
}
