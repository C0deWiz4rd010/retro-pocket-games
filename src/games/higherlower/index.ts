import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  const g = new Graphics();
  const card = new Text({ text: '', style: { fontFamily: 'Press Start 2P, monospace', fontSize: 44, fill: 0xf8fafc } });
  const msg = new Text({ text: 'HIGHER OR LOWER?', style: { fontFamily: 'VT323, monospace', fontSize: 28, fill: 0xfacc15 } });
  const hint = new Text({ text: '', style: { fontFamily: 'VT323, monospace', fontSize: 22, fill: 0x9bb3c9 } });
  const bankLabel = new Text({ text: 'BANK', style: { fontFamily: 'VT323, monospace', fontSize: 16, fill: 0xffffff } });
  card.anchor.set(0.5);
  msg.anchor.set(0.5);
  hint.anchor.set(0.5);
  bankLabel.anchor.set(0.5);
  card.position.set(W / 2, H * 0.34);
  msg.position.set(W / 2, H * 0.52);
  hint.position.set(W / 2, H * 0.59);
  bankLabel.position.set(W - 70, 40);
  layer.addChild(g, card, msg, hint, bankLabel);
  ctx.stage.addChild(layer);

  // Feature: a real 52-card deck dealt without replacement, so probabilities matter
  let deck: number[] = [];
  const buildDeck = (): void => {
    deck = [];
    for (let s = 0; s < 4; s++) for (let r = 0; r < RANKS.length; r++) deck.push(r);
    deck = ctx.rng.shuffle(deck);
  };
  buildDeck();
  let current = deck.pop()!;
  let score = 0;
  let lives = 3;
  let streak = 0;
  let pot = 0; // Feature: unbanked pot you can cash out

  // Feature: probability hint — remaining cards higher / lower than the current card
  const remaining = (): { hi: number; lo: number; eq: number } => {
    let hi = 0, lo = 0, eq = 0;
    for (const r of deck) { if (r > current) hi++; else if (r < current) lo++; else eq++; }
    return { hi, lo, eq };
  };

  ctx.hud.setScore(score);
  ctx.hud.setLives(lives);
  const setLabel = (): void => ctx.hud.setLabel(pot > 0 ? `POT ${pot} · CARDS ${deck.length}` : `CARDS ${deck.length}`);
  setLabel();

  const bank = (): void => {
    if (pot <= 0) return;
    score += pot;
    ctx.hud.setScore(score);
    ctx.fx.floatingText(`BANKED +${pot}`, W / 2, H * 0.2, 0x3ddc84);
    ctx.audio.sfx('powerup');
    pot = 0;
    streak = 0;
    setLabel();
    draw();
  };

  function guess(higher: boolean): void {
    if (deck.length === 0) buildDeck();
    const next = deck.pop()!;
    const correct = next === current ? true : higher ? next > current : next < current; // ties are safe
    msg.text = `${RANKS[current]} -> ${RANKS[next]}`;
    current = next;
    if (correct) {
      streak++;
      const mult = 1 + Math.floor(streak / 4); // Feature: streak multiplier
      pot += (100 + streak * 25) * mult;
      ctx.audio.sfx('coin');
      ctx.fx.floatingText(`STREAK ${streak}${mult > 1 ? ` x${mult}` : ''}`, W / 2, H * 0.2, 0xfacc15);
    } else {
      pot = 0; // lose the unbanked pot
      streak = 0;
      lives--;
      ctx.audio.sfx('hit');
      ctx.fx.screenShake(5, 0.12);
      ctx.hud.setLives(lives);
      if (lives <= 0) {
        score += pot;
        ctx.gameOver(score, { streak });
        return;
      }
    }
    setLabel();
    draw();
  }

  const bankBtn = { x: W - 70, y: 40, w: 120, h: 34 };
  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (Math.abs(x - bankBtn.x) < bankBtn.w / 2 && Math.abs(y - bankBtn.y) < bankBtn.h / 2) { bank(); return; }
    if (y < H * 0.6) return;
    guess(x >= W / 2);
  });
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'left' || a === 'b') guess(false);
    else if (a === 'right' || a === 'a') guess(true);
    else if (a === 'start' || a === 'select') bank();
  });

  function draw(): void {
    g.clear();
    g.roundRect(W / 2 - 72, H * 0.2, 144, 180, 14).fill({ color: 0x111827 }).stroke({ width: 4, color: 0xf8fafc });
    card.text = RANKS[current] ?? '?';
    const rem = remaining();
    const y = H * 0.66;
    g.roundRect(28, y, W / 2 - 42, 78, 12).fill({ color: 0x7f1d1d }).stroke({ width: 2, color: 0xfca5a5 });
    g.roundRect(W / 2 + 14, y, W / 2 - 42, 78, 12).fill({ color: 0x14532d }).stroke({ width: 2, color: 0x86efac });
    // probability hint
    hint.text = `↓ ${rem.lo}    =${rem.eq}    ↑ ${rem.hi}`;
    // bank button
    g.roundRect(bankBtn.x - bankBtn.w / 2, bankBtn.y - bankBtn.h / 2, bankBtn.w, bankBtn.h, 8).fill({ color: pot > 0 ? 0x166534 : 0x334155 }).stroke({ width: 2, color: 0x86efac, alpha: pot > 0 ? 1 : 0.4 });
    bankLabel.text = pot > 0 ? `BANK ${pot}` : 'BANK';
  }

  draw();
  return {
    update() {},
    destroy() {
      offTap();
      offDown();
      layer.destroy({ children: true });
    },
  };
}
