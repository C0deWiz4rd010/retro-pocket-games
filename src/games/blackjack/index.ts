import { Container, Graphics, Text } from 'pixi.js';
import type { Game, GameContext } from '@core/types';

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

interface Card { suit: string; value: string; faceUp: boolean }

const cardValue = (v: string): number => {
  if (['J', 'Q', 'K'].includes(v)) return 10;
  if (v === 'A') return 11;
  return parseInt(v, 10);
};

const handValue = (hand: Card[]): number => {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    if (!c.faceUp) continue;
    const v = cardValue(c.value);
    total += v;
    if (c.value === 'A') aces++;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
};

const handStr = (hand: Card[]): string => {
  const v = handValue(hand);
  if (hand.some((c) => !c.faceUp)) {
    const visible = hand.filter((c) => c.faceUp);
    return visible.length ? String(handValue(visible)) + '+?' : '?';
  }
  return String(v);
};

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const cardW = Math.min(54, W * 0.13);
  const cardH = cardW * 1.45;
  const cardGap = cardW * 0.22;

  // deck
  let deck: Card[] = [];
  const shuffle = (): void => {
    deck = [];
    for (const suit of SUITS)
      for (const value of VALUES)
        deck.push({ suit, value, faceUp: true });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(ctx.rng.next() * (i + 1));
      [deck[i], deck[j]] = [deck[j]!, deck[i]!];
    }
  };
  shuffle();

  let playerHand: Card[] = [];
  let dealerHand: Card[] = [];
  let credits = 100;
  let bet = 10;
  let gamePhase: 'bet' | 'player' | 'dealer' | 'result' = 'bet';
  let resultMsg = '';
  let dealerRevealing = false;
  let dealerTimer = 0;
  let rounds = 0;
  let score = 0;

  ctx.hud.setScore(credits);
  ctx.hud.setLabel('BLACKJACK');

  // UI elements
  const dealerTitle = new Text({ text: 'DEALER', style: { fontFamily: 'VT323, monospace', fontSize: 18, fill: 0xff4d4d } });
  const playerTitle = new Text({ text: 'YOU', style: { fontFamily: 'VT323, monospace', fontSize: 18, fill: 0x9bffce } });
  const dealerScore = new Text({ text: '', style: { fontFamily: 'VT323, monospace', fontSize: 22, fill: 0xffffff } });
  const playerScore = new Text({ text: '', style: { fontFamily: 'VT323, monospace', fontSize: 22, fill: 0xffffff } });
  const resultText = new Text({ text: '', style: { fontFamily: 'VT323, monospace', fontSize: 28, fill: 0xffd200, align: 'center' } });
  resultText.anchor.set(0.5);

  layer.addChild(dealerTitle, playerTitle, dealerScore, playerScore, resultText);

  // Buttons
  const BTN_Y = H - 60;
  const buttons: { label: string; x: number; y: number; w: number; h: number; action: string }[] = [
    { label: 'HIT', x: W * 0.18, y: BTN_Y, w: 70, h: 34, action: 'hit' },
    { label: 'STAND', x: W * 0.5, y: BTN_Y, w: 80, h: 34, action: 'stand' },
    { label: 'DBL', x: W * 0.82, y: BTN_Y, w: 70, h: 34, action: 'double' },
    { label: '+10', x: W * 0.3, y: BTN_Y, w: 60, h: 34, action: 'bet+' },
    { label: '-10', x: W * 0.7, y: BTN_Y, w: 60, h: 34, action: 'bet-' },
    { label: 'DEAL', x: W * 0.5, y: BTN_Y - 44, w: 100, h: 38, action: 'deal' },
  ];
  const btnLabels: Text[] = buttons.map((b) => {
    const t = new Text({ text: b.label, style: { fontFamily: 'VT323, monospace', fontSize: 18, fill: 0xffffff } });
    t.anchor.set(0.5);
    layer.addChild(t);
    return t;
  });

  const draw = (): void => {
    cleanTemps();
    g.clear();
    g.rect(0, 0, W, H).fill({ color: 0x0a2a12 });

    const drawCard = (card: Card, x: number, y: number): void => {
      const red = ['♥', '♦'].includes(card.suit);
      g.roundRect(x, y, cardW, cardH, 5).fill({ color: card.faceUp ? 0xf5f5f5 : 0x1a3a6a });
      g.roundRect(x, y, cardW, cardH, 5).stroke({ width: 1, color: 0x888888 });
      if (card.faceUp) {
        const label = new Text({
          text: `${card.value}\n${card.suit}`,
          style: { fontFamily: 'VT323, monospace', fontSize: cardW * 0.3, fill: red ? 0xcc2222 : 0x111111, align: 'left' },
        });
        label.position.set(x + 3, y + 2);
        g.addChild?.(label); // won't work but we'll use separate texts
      }
    };

    // Draw dealer cards
    const dealerStartX = (W - Math.min(dealerHand.length, 7) * (cardW + cardGap)) / 2;
    const dealerY = H * 0.12;
    dealerHand.forEach((card, i) => {
      const cx = dealerStartX + i * (cardW + cardGap);
      drawCard(card, cx, dealerY);
      if (card.faceUp) {
        const red = ['♥', '♦'].includes(card.suit);
        const t = new Text({
          text: card.value + card.suit,
          style: { fontFamily: 'VT323, monospace', fontSize: cardW * 0.32, fill: red ? 0xcc2222 : 0x111111 },
        });
        t.position.set(cx + 3, dealerY + 3);
        addTemp(t);
      }
    });

    // Draw player cards
    const playerStartX = (W - Math.min(playerHand.length, 7) * (cardW + cardGap)) / 2;
    const playerY = H * 0.5;
    playerHand.forEach((card, i) => {
      const cx = playerStartX + i * (cardW + cardGap);
      drawCard(card, cx, playerY);
      const red = ['♥', '♦'].includes(card.suit);
      const t = new Text({
        text: card.value + card.suit,
        style: { fontFamily: 'VT323, monospace', fontSize: cardW * 0.32, fill: red ? 0xcc2222 : 0x111111 },
      });
      t.position.set(cx + 3, playerY + 3);
      addTemp(t);
    });

    // Scores
    dealerTitle.position.set(W / 2 - 40, H * 0.06);
    dealerScore.text = dealerHand.length ? handStr(dealerHand) : '';
    dealerScore.position.set(W / 2 + 10, H * 0.06);
    playerTitle.position.set(W / 2 - 40, H * 0.45);
    playerScore.text = playerHand.length ? String(handValue(playerHand)) : '';
    playerScore.position.set(W / 2 + 10, H * 0.45);

    resultText.text = resultMsg;
    resultText.position.set(W / 2, H * 0.34);

    // Bet display
    const betText = new Text({
      text: `BET: ${bet}  CREDITS: ${credits}`,
      style: { fontFamily: 'VT323, monospace', fontSize: 16, fill: 0xffd200 },
    });
    betText.anchor.set(0.5, 0);
    betText.position.set(W / 2, H * 0.82);
    addTemp(betText);

    // Buttons
    const showBet = gamePhase === 'bet' || gamePhase === 'result';
    const showPlay = gamePhase === 'player';

    buttons.forEach((b, i) => {
      const isBet = b.action.startsWith('bet') || b.action === 'deal';
      const isPlay = b.action === 'hit' || b.action === 'stand' || b.action === 'double';
      const visible = (showBet && isBet) || (showPlay && isPlay);
      if (!visible) { btnLabels[i]!.text = ''; return; }

      const disabled = (b.action === 'double' && (credits < bet || playerHand.length !== 2));
      g.roundRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 6)
        .fill({ color: disabled ? 0x333333 : 0x1a4a2a })
        .stroke({ width: 2, color: disabled ? 0x555555 : 0x3ddc84 });
      btnLabels[i]!.text = b.label;
      btnLabels[i]!.style.fill = disabled ? 0x666666 : 0xffffff;
      btnLabels[i]!.position.set(b.x, b.y);
    });
  };

  // Track temporary text nodes to clean up on next draw
  const tempTexts: Text[] = [];
  const addTemp = (t: Text): void => { tempTexts.push(t); layer.addChild(t); };
  const cleanTemps = (): void => {
    for (const t of tempTexts) if (t.parent) t.parent.removeChild(t);
    tempTexts.length = 0;
  };

  const deal = (): void => {
    if (credits < bet) bet = Math.min(bet, credits);
    if (deck.length < 15) shuffle();
    cleanTemps();
    playerHand = [];
    dealerHand = [];
    // deal 2 cards each
    playerHand.push({ ...deck.pop()!, faceUp: true });
    dealerHand.push({ ...deck.pop()!, faceUp: true });
    playerHand.push({ ...deck.pop()!, faceUp: true });
    dealerHand.push({ ...deck.pop()!, faceUp: false }); // dealer hole card
    gamePhase = 'player';
    resultMsg = '';
    ctx.audio.sfx('select');

    // check blackjack
    if (handValue(playerHand) === 21) {
      stand();
      return;
    }
    draw();
  };

  const hit = (): void => {
    if (gamePhase !== 'player') return;
    playerHand.push({ ...deck.pop()!, faceUp: true });
    ctx.audio.sfx('blip');
    if (handValue(playerHand) > 21) {
      endRound('BUST! DEALER WINS', -bet);
    }
    draw();
  };

  const stand = (): void => {
    if (gamePhase !== 'player') return;
    gamePhase = 'dealer';
    // reveal dealer hole card
    dealerHand.forEach((c) => (c.faceUp = true));
    dealerRevealing = true;
    dealerTimer = 0.5;
    draw();
  };

  const doubleDown = (): void => {
    if (gamePhase !== 'player' || playerHand.length !== 2 || credits < bet) return;
    bet *= 2;
    hit();
    if (gamePhase === 'player') stand();
  };

  const endRound = (msg: string, delta: number): void => {
    credits += delta;
    score += Math.max(0, delta);
    ctx.hud.setScore(credits);
    resultMsg = msg;
    gamePhase = 'result';
    rounds++;
    if (delta > 0) ctx.audio.sfx('coin');
    else if (delta < 0) ctx.audio.sfx('hit');
    if (credits <= 0) {
      ctx.audio.sfx('gameover');
      ctx.gameOver(score, { rounds });
    }
    draw();
  };

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (gamePhase === 'dealer') return;
    for (let i = 0; i < buttons.length; i++) {
      const b = buttons[i]!;
      if (Math.abs(x - b.x) < b.w / 2 && Math.abs(y - b.y) < b.h / 2) {
        if (b.action === 'hit') hit();
        else if (b.action === 'stand') stand();
        else if (b.action === 'double') doubleDown();
        else if (b.action === 'deal') { bet = Math.min(bet, credits); deal(); }
        else if (b.action === 'bet+') { bet = Math.min(bet + 10, credits, 100); draw(); }
        else if (b.action === 'bet-') { bet = Math.max(bet - 10, 10); draw(); }
        return;
      }
    }
  });

  draw();

  return {
    update(dt) {
      if (gamePhase === 'dealer' && dealerRevealing) {
        dealerTimer -= dt;
        if (dealerTimer <= 0) {
          const dv = handValue(dealerHand);
          if (dv < 17) {
            dealerHand.push({ ...deck.pop()!, faceUp: true });
            ctx.audio.sfx('select');
            dealerTimer = 0.5;
            draw();
          } else {
            dealerRevealing = false;
            const pv = handValue(playerHand);
            if (dv > 21) {
              endRound('DEALER BUSTS! YOU WIN', bet);
            } else if (pv > dv) {
              const bj = pv === 21 && playerHand.length === 2;
              const gain = bj ? Math.floor(bet * 1.5) : bet;
              endRound(bj ? 'BLACKJACK! +' + gain : 'YOU WIN! +' + bet, gain);
            } else if (dv > pv) {
              endRound('DEALER WINS  -' + bet, -bet);
            } else {
              endRound('PUSH — TIE', 0);
            }
          }
        }
      }
    },
    destroy() {
      offTap();
      layer.destroy({ children: true });
    },
  };
}
