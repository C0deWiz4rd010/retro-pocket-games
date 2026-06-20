import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

const SYMBOLS = ['★', '♥', '◆', '●', '▲', '✿', '☀', '⚡', '☂', '♫', '✦', '❄'];

export default function createGame(ctx: GameContext): Game {
  const cols = 4;
  const rows = 6; // 24 cards = 12 pairs
  const pad = 12;
  const cw = Math.floor((Math.min(ctx.width, 420) - pad * (cols + 1)) / cols);
  const ch = Math.floor((ctx.height - pad * (rows + 1)) / rows);
  const boardW = cols * cw + (cols + 1) * pad;
  const ox = (ctx.width - boardW) / 2;
  const oy = pad;

  const layer = new Container();
  layer.position.set(ox, oy);
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const pairCount = (cols * rows) / 2;
  const deck: number[] = [];
  for (let i = 0; i < pairCount; i++) deck.push(i, i);
  ctx.rng.shuffle(deck);

  const revealed = new Array(cols * rows).fill(false);
  const matched = new Array(cols * rows).fill(false);
  const labels: Text[] = [];
  for (let i = 0; i < cols * rows; i++) {
    const t = new Text({ text: '', style: { fontFamily: 'Inter', fontSize: ch * 0.5, fill: 0x101018 } });
    t.anchor.set(0.5);
    t.visible = false;
    labels.push(t);
    layer.addChild(t);
  }

  let first = -1;
  let lock = 0;
  let moves = 0;
  let pairs = 0;
  let over = false;
  let score = 0;
  let streak = 0; // Feature: match-streak multiplier
  const maxTime = 90;
  let timeLeft = maxTime; // Feature: countdown timer + time bonus
  let preview = 2; // Feature: start-of-round preview

  ctx.hud.setScore(0);
  ctx.hud.setLabel('MEMORIZE…');

  const cellRect = (i: number): { x: number; y: number } => ({
    x: pad + (i % cols) * (cw + pad),
    y: pad + Math.floor(i / cols) * (ch + pad),
  });

  const draw = (): void => {
    g.clear();
    for (let i = 0; i < cols * rows; i++) {
      const { x, y } = cellRect(i);
      const show = revealed[i] || matched[i] || preview > 0;
      g.roundRect(x, y, cw, ch, 8).fill({ color: matched[i] ? 0x1d6e44 : show ? 0xe6e6f0 : 0x2b2b40 });
      const lbl = labels[i]!;
      if (show) {
        lbl.text = SYMBOLS[deck[i]! % SYMBOLS.length]!;
        lbl.position.set(x + cw / 2, y + ch / 2);
        lbl.style.fill = matched[i] ? 0x9bffce : 0x101018;
        lbl.visible = true;
      } else lbl.visible = false;
    }
  };

  const pick = (vx: number, vy: number): void => {
    if (over || lock > 0 || preview > 0) return;
    const c = Math.floor((vx - ox - pad) / (cw + pad));
    const r = Math.floor((vy - oy - pad) / (ch + pad));
    if (c < 0 || r < 0 || c >= cols || r >= rows) return;
    const i = r * cols + c;
    if (revealed[i] || matched[i]) return;
    revealed[i] = true;
    ctx.audio.sfx('blip');
    if (first === -1) {
      first = i;
    } else {
      moves++;
      if (deck[first] === deck[i]) {
        matched[first] = true;
        matched[i] = true;
        pairs++;
        streak++;
        score += 100 + streak * 20; // Feature: streak multiplier
        timeLeft = Math.min(maxTime, timeLeft + 2); // matches add time
        ctx.hud.setScore(score);
        ctx.audio.sfx('coin');
        first = -1;
        if (pairs >= pairCount) {
          over = true;
          score += Math.ceil(timeLeft) * 5; // Feature: time bonus on clear
          ctx.hud.setScore(score);
          ctx.audio.sfx('levelup');
          ctx.hud.toast('CLEARED!');
          ctx.gameOver(score, { moves });
        }
      } else {
        streak = 0;
        timeLeft = Math.max(0, timeLeft - 1);
        lock = 0.8;
      }
    }
    draw();
  };
  const offTap = ctx.input.on('tap', ({ x, y }) => pick(x, y));

  draw();

  return {
    update(dt) {
      if (over) return;
      if (preview > 0) {
        preview -= dt;
        if (preview <= 0) { ctx.hud.setLabel(`${Math.ceil(timeLeft)}s`); draw(); }
        return;
      }
      timeLeft -= dt;
      if (timeLeft <= 0) {
        over = true;
        ctx.hud.toast("TIME'S UP!");
        ctx.gameOver(score, { moves });
        return;
      }
      ctx.hud.setLabel(streak > 1 ? `STREAK x${streak} · ${Math.ceil(timeLeft)}s` : `${Math.ceil(timeLeft)}s`);
      if (lock > 0) {
        lock -= dt;
        if (lock <= 0) {
          for (let i = 0; i < revealed.length; i++) if (!matched[i]) revealed[i] = false;
          first = -1;
          draw();
        }
      }
    },
    destroy() {
      offTap();
      layer.destroy({ children: true });
    },
  };
}
