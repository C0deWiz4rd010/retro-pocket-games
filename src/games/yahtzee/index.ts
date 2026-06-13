import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

const comboScore = (dice: readonly number[]): { label: string; points: number } => {
  const counts = Array.from({ length: 7 }, (_, i) => dice.filter((d) => d === i).length);
  const sorted = dice.slice().sort((a, b) => a - b).join('');
  const sum = dice.reduce((a, b) => a + b, 0);
  if (counts.includes(5)) return { label: 'FIVE OF A KIND', points: 1500 };
  if (counts.includes(4)) return { label: 'FOUR OF A KIND', points: 800 + sum * 10 };
  if (counts.includes(3) && counts.includes(2)) return { label: 'FULL HOUSE', points: 650 };
  if (sorted === '12345' || sorted === '23456') return { label: 'BIG STRAIGHT', points: 700 };
  if (counts.includes(3)) return { label: 'THREE OF A KIND', points: 350 + sum * 10 };
  return { label: 'CHANCE', points: sum * 25 };
};

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  const label = new Text({ text: '', style: { fontFamily: 'VT323, monospace', fontSize: 28, fill: 0xfacc15, align: 'center' } });
  const hint = new Text({ text: '', style: { fontFamily: 'VT323, monospace', fontSize: 19, fill: 0xffffff, align: 'center' } });
  label.anchor.set(0.5);
  hint.anchor.set(0.5);
  label.position.set(W / 2, 58);
  hint.position.set(W / 2, H - 52);
  layer.addChild(g, label, hint);

  let dice = [1, 1, 1, 1, 1];
  const held = new Set<number>();
  let rolls = 3;
  let round = 1;
  let score = 0;
  let over = false;

  ctx.hud.setScore(0);
  ctx.hud.setLabel('ROUND 1/5');

  const roll = (): void => {
    if (over || rolls <= 0) return;
    dice = dice.map((d, i) => (held.has(i) ? d : ctx.rng.int(1, 6)));
    rolls--;
    ctx.audio.sfx('select');
    ctx.fx.screenShake(3, 0.1);
    draw();
  };

  const bank = (): void => {
    if (over || rolls === 3) return;
    const combo = comboScore(dice);
    score += combo.points;
    ctx.hud.setScore(score);
    ctx.fx.floatingText(`+${combo.points}`, W / 2, H * 0.28, 0xfacc15);
    round++;
    held.clear();
    rolls = 3;
    if (round > 5) {
      over = true;
      ctx.gameOver(score, { combo: combo.points });
    } else {
      ctx.hud.setLabel(`ROUND ${round}/5`);
      roll();
    }
  };

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    const dieSize = W * 0.16;
    const startX = (W - dieSize * 5 - 8 * 4) / 2;
    const dieY = H * 0.36;
    for (let i = 0; i < 5; i++) {
      const dx = startX + i * (dieSize + 8);
      if (x >= dx && x <= dx + dieSize && y >= dieY && y <= dieY + dieSize) {
        if (held.has(i)) held.delete(i);
        else held.add(i);
        ctx.audio.sfx('blip');
        draw();
        return;
      }
    }
    if (y > H * 0.68 && y < H * 0.78) roll();
    else if (y > H * 0.8 && y < H * 0.9) bank();
  });
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a') roll();
    if (a === 'b') bank();
  });

  function draw(): void {
    g.clear();
    label.text = comboScore(dice).label;
    hint.text = `ROLLS ${rolls}  |  A ROLL  B BANK`;
    const dieSize = W * 0.16;
    const startX = (W - dieSize * 5 - 8 * 4) / 2;
    const dieY = H * 0.36;
    dice.forEach((d, i) => {
      const x = startX + i * (dieSize + 8);
      const heldDie = held.has(i);
      g.roundRect(x, dieY, dieSize, dieSize, 10).fill({ color: heldDie ? 0xfacc15 : 0xf8fafc }).stroke({ width: 2, color: 0x0f172a });
      const pip = (px: number, py: number): void => {
        g.circle(x + px * dieSize, dieY + py * dieSize, dieSize * 0.06).fill({ color: 0x111827 });
      };
      if ([1, 3, 5].includes(d)) pip(0.5, 0.5);
      if (d >= 2) { pip(0.28, 0.28); pip(0.72, 0.72); }
      if (d >= 4) { pip(0.72, 0.28); pip(0.28, 0.72); }
      if (d === 6) { pip(0.28, 0.5); pip(0.72, 0.5); }
    });
    g.roundRect(W * 0.18, H * 0.68, W * 0.64, 42, 10).fill({ color: rolls > 0 ? 0x1e40af : 0x334155 });
    g.roundRect(W * 0.18, H * 0.8, W * 0.64, 42, 10).fill({ color: rolls < 3 ? 0x166534 : 0x334155 });
  }

  roll();
  return {
    update() {},
    destroy() {
      offTap();
      offDown();
      layer.destroy({ children: true });
    },
  };
}
