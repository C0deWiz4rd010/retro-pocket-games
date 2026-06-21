import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

const CHOICES = ['ROCK', 'PAPER', 'SCISSORS'] as const;

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  const result = new Text({ text: 'BEST OF FIVE', style: { fontFamily: 'VT323, monospace', fontSize: 32, fill: 0xfb7185, align: 'center' } });
  const sub = new Text({ text: '', style: { fontFamily: 'VT323, monospace', fontSize: 22, fill: 0xffffff, align: 'center' } });
  result.anchor.set(0.5);
  sub.anchor.set(0.5);
  result.position.set(W / 2, H * 0.22);
  sub.position.set(W / 2, H * 0.32);
  layer.addChild(g, result, sub);
  const tempTexts: Text[] = [];
  const addTemp = (node: Text): void => {
    tempTexts.push(node);
    layer.addChild(node);
  };
  const cleanTemps = (): void => {
    for (const node of tempTexts) node.destroy();
    tempTexts.length = 0;
  };

  let player = 0;
  let cpu = 0;
  let rounds = 0;
  let over = false;
  let matchNo = 1; // Feature: match progression
  let totalScore = 0;
  let streak = 0; // Feature: round-win streak bonus
  const history: number[] = []; // Feature: CPU learns the player's pattern

  ctx.hud.setScore(0);
  ctx.hud.setLabel('MATCH 1 · 0-0');

  const predictFoe = (): number => {
    const predictChance = Math.min(0.78, 0.25 + matchNo * 0.16);
    if (history.length >= 3 && ctx.rng.next() < predictChance) {
      // counter the player's most frequent recent pick
      const recent = history.slice(-6);
      const freq = [0, 0, 0];
      for (const p of recent) freq[p]!++;
      let pred = 0;
      for (let i = 1; i < 3; i++) if (freq[i]! > freq[pred]!) pred = i;
      return (pred + 1) % 3; // the move that beats `pred`
    }
    return ctx.rng.int(0, 2);
  };

  const play = (pick: number): void => {
    if (over) return;
    const foe = predictFoe();
    history.push(pick);
    rounds++;
    const win = (pick - foe + 3) % 3;
    if (win === 1) {
      player++;
      streak++;
      if (streak >= 2) { totalScore += streak * 30; }
      result.text = streak >= 2 ? `YOU WIN (STREAK x${streak})` : 'YOU WIN';
      ctx.audio.sfx('coin');
    } else if (win === 2) {
      cpu++;
      streak = 0;
      result.text = 'RIVAL WINS';
      ctx.audio.sfx('hit');
    } else {
      result.text = 'DRAW';
      ctx.audio.sfx('blip');
    }
    sub.text = `${CHOICES[pick]} vs ${CHOICES[foe]}`;
    ctx.hud.setScore(totalScore + player * 100 - cpu * 50);
    ctx.hud.setLabel(`MATCH ${matchNo} · ${player} - ${cpu}`);
    if (player === 3) {
      // Feature: win the match → bank it and start a harder one
      totalScore += 500 + matchNo * 200 - cpu * 80;
      matchNo++;
      player = 0; cpu = 0; rounds = 0;
      ctx.hud.toast(`MATCH WON! → ${matchNo}`);
      ctx.audio.sfx('levelup');
      ctx.hud.setScore(totalScore);
      ctx.hud.setLabel(`MATCH ${matchNo} · 0 - 0`);
    } else if (cpu === 3) {
      over = true;
      ctx.gameOver(Math.max(0, totalScore), { matches: matchNo - 1, wins: player, rounds });
    }
    draw();
  };

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (y < H * 0.58 || y > H * 0.8) return;
    play(Math.min(2, Math.floor((x / W) * 3)));
  });
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'left') play(0);
    else if (a === 'up' || a === 'a') play(1);
    else if (a === 'right' || a === 'b') play(2);
  });

  function draw(): void {
    cleanTemps();
    g.clear();
    const y = H * 0.6;
    CHOICES.forEach((choice, i) => {
      const x = W * (0.18 + i * 0.32);
      g.roundRect(x - 48, y, 96, 86, 12).fill({ color: 0x1f1723 }).stroke({ width: 2, color: 0xfb7185 });
      const t = new Text({ text: choice, style: { fontFamily: 'VT323, monospace', fontSize: 18, fill: 0xffffff, align: 'center' } });
      t.anchor.set(0.5);
      t.position.set(x, y + 43);
      addTemp(t);
    });
  }

  draw();
  return {
    update() {},
    destroy() {
      offTap();
      offDown();
      cleanTemps();
      layer.destroy({ children: true });
    },
  };
}
