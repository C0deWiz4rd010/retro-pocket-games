import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  const g = new Graphics();
  const title = new Text({ text: 'NUMBER HUNT', style: { fontFamily: 'VT323, monospace', fontSize: 28, fill: 0x34d399 } });
  const prompt = new Text({ text: '', style: { fontFamily: 'Press Start 2P, monospace', fontSize: 18, fill: 0xffffff } });
  title.anchor.set(0.5);
  prompt.anchor.set(0.5);
  title.position.set(W / 2, 46);
  prompt.position.set(W / 2, 92);
  layer.addChild(g, title, prompt);
  ctx.stage.addChild(layer);

  const nums = Array.from({ length: 16 }, (_, i) => i + 1).sort(() => ctx.rng.next() - 0.5);
  const labels: Text[] = [];
  let target = 1;
  let score = 0;
  let lives = 3;
  let time = 45;

  ctx.hud.setScore(score);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('45s');

  function pick(index: number): void {
    const n = nums[index];
    if (!n) return;
    if (n === target) {
      score += 100 + target * 8;
      target++;
      ctx.audio.sfx('coin');
      ctx.fx.floatingText('+', W / 2, 112, 0x34d399);
      if (target > 16) {
        ctx.gameOver(score + Math.floor(time * 25), { cleared: 1 });
        return;
      }
    } else {
      lives--;
      ctx.audio.sfx('hit');
      ctx.fx.screenShake(4, 0.1);
      ctx.hud.setLives(lives);
      if (lives <= 0) {
        ctx.gameOver(score, { target });
        return;
      }
    }
    ctx.hud.setScore(score);
    draw();
  }

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    const size = Math.min(W - 42, H - 170);
    const cell = size / 4;
    const ox = (W - size) / 2;
    const oy = H - size - 36;
    const c = Math.floor((x - ox) / cell);
    const r = Math.floor((y - oy) / cell);
    if (c < 0 || c >= 4 || r < 0 || r >= 4) return;
    pick(r * 4 + c);
  });

  function draw(): void {
    labels.forEach((l) => l.destroy());
    labels.length = 0;
    g.clear();
    prompt.text = `TAP ${target}`;
    const size = Math.min(W - 42, H - 170);
    const cell = size / 4;
    const ox = (W - size) / 2;
    const oy = H - size - 36;
    for (let i = 0; i < 16; i++) {
      const r = Math.floor(i / 4);
      const c = i % 4;
      const n = nums[i]!;
      const done = n < target;
      const x = ox + c * cell;
      const y = oy + r * cell;
      g.roundRect(x + 4, y + 4, cell - 8, cell - 8, 8)
        .fill({ color: done ? 0x052e1a : 0x10251f })
        .stroke({ width: n === target ? 3 : 1, color: n === target ? 0x34d399 : 0x1f6b4f });
      const t = new Text({
        text: done ? '' : String(n),
        style: { fontFamily: 'Press Start 2P, monospace', fontSize: 16, fill: n === target ? 0x34d399 : 0xffffff },
      });
      t.anchor.set(0.5);
      t.position.set(x + cell / 2, y + cell / 2);
      labels.push(t);
      layer.addChild(t);
    }
  }

  draw();
  return {
    update(dt) {
      time -= dt;
      ctx.hud.setLabel(`${Math.ceil(Math.max(0, time))}s`);
      if (time <= 0) ctx.gameOver(score, { target });
    },
    destroy() {
      offTap();
      labels.forEach((l) => l.destroy());
      layer.destroy({ children: true });
    },
  };
}
