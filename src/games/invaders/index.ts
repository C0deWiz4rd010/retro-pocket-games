import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import { clamp } from '@utils/math';

interface Alien {
  x: number;
  y: number;
  alive: boolean;
  row: number;
}
interface BunkerCell {
  x: number;
  y: number;
  hp: number;
}

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const COLS = 8;
  const ROWS = 5;
  const alienW = 24;
  const alienGapX = (W - 40) / COLS;
  const player = { x: W / 2, y: H - 36, w: 34, h: 14 };
  let aliens: Alien[] = [];
  let dir = 1;
  let stepAcc = 0;
  let descend = false;
  let pBullet: { x: number; y: number } | null = null;
  const eBullets: { x: number; y: number }[] = [];
  const bunkers: BunkerCell[] = [];
  let ufo: { x: number; dir: number; worth: number } | null = null;
  let ufoTimer = 12;
  let score = 0;
  let lives = 3;
  let wave = 1;
  let over = false;
  let eFireAcc = 0;
  const bSize = 6;

  const build = (): void => {
    aliens = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        aliens.push({ x: 24 + c * alienGapX, y: 70 + r * 32, alive: true, row: r });
  };

  const buildBunkers = (): void => {
    bunkers.length = 0;
    const shape = ['011110', '111111', '111111', '110011'];
    const count = 3;
    const spacing = W / count;
    for (let b = 0; b < count; b++) {
      const bx = spacing * (b + 0.5) - (shape[0]!.length * bSize) / 2;
      const by = H - 110;
      shape.forEach((row, ry) =>
        [...row].forEach((ch, cx) => {
          if (ch === '1') bunkers.push({ x: bx + cx * bSize, y: by + ry * bSize, hp: 3 });
        }),
      );
    }
  };

  build();
  buildBunkers();

  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('WAVE 1');

  const fire = (): void => {
    if (over || pBullet) return;
    pBullet = { x: player.x, y: player.y - 12 };
    ctx.audio.sfx('shoot');
  };
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a') fire();
  });
  const offTap = ctx.input.on('tap', fire);

  const aliveCount = (): number => aliens.reduce((n, a) => n + (a.alive ? 1 : 0), 0);

  const hitBunker = (bx: number, by: number): boolean => {
    for (let i = 0; i < bunkers.length; i++) {
      const c = bunkers[i]!;
      if (bx >= c.x && bx <= c.x + bSize && by >= c.y && by <= c.y + bSize) {
        c.hp--;
        if (c.hp <= 0) bunkers.splice(i, 1);
        return true;
      }
    }
    return false;
  };

  const draw = (): void => {
    g.clear();
    aliens.forEach((a) => {
      if (!a.alive) return;
      const col = a.row < 1 ? 0xff2e97 : a.row < 3 ? 0x00f7ff : 0x3ddc84;
      g.roundRect(a.x, a.y, alienW, 16, 4).fill({ color: col });
      g.rect(a.x + 4, a.y + 18, 4, 4).fill({ color: col });
      g.rect(a.x + alienW - 8, a.y + 18, 4, 4).fill({ color: col });
    });
    if (ufo) g.roundRect(ufo.x - 16, 50, 32, 12, 6).fill({ color: 0xff2e97 });
    bunkers.forEach((c) =>
      g.rect(c.x, c.y, bSize, bSize).fill({ color: 0x3ddc84, alpha: 0.4 + c.hp * 0.2 }),
    );
    g.roundRect(player.x - player.w / 2, player.y, player.w, player.h, 3).fill({ color: 0x00f7ff });
    g.rect(player.x - 2, player.y - 6, 4, 6).fill({ color: 0x00f7ff });
    if (pBullet) g.rect(pBullet.x - 2, pBullet.y, 4, 12).fill({ color: 0xffffff });
    eBullets.forEach((b) => g.rect(b.x - 2, b.y, 4, 12).fill({ color: 0xff4d4d }));
  };

  return {
    update(dt) {
      if (over) return;
      const ax = ctx.input.axis().x;
      if (ax) player.x = clamp(player.x + ax * 260 * dt, player.w / 2, W - player.w / 2);

      ufoTimer -= dt;
      if (!ufo && ufoTimer <= 0) {
        const d = ctx.rng.next() < 0.5 ? 1 : -1;
        ufo = { x: d > 0 ? -16 : W + 16, dir: d, worth: ctx.rng.pick([50, 100, 150, 300]) };
        ufoTimer = 18 + ctx.rng.next() * 10;
      }
      if (ufo) {
        ufo.x += ufo.dir * 90 * dt;
        if (ufo.x < -30 || ufo.x > W + 30) ufo = null;
      }

      const interval = clamp(0.5 * (aliveCount() / (COLS * ROWS)) + 0.08, 0.08, 0.6);
      stepAcc += dt;
      if (stepAcc >= interval) {
        stepAcc = 0;
        let edge = false;
        aliens.forEach((a) => {
          if (!a.alive) return;
          if ((a.x + alienGapX * dir > W - alienW - 6 && dir > 0) || (a.x + alienGapX * dir < 6 && dir < 0))
            edge = true;
        });
        if (edge && !descend) {
          descend = true;
          dir *= -1;
        } else {
          aliens.forEach((a) => {
            if (a.alive) {
              if (descend) a.y += 16;
              else a.x += (alienGapX / 3) * dir;
            }
          });
          descend = false;
        }
        ctx.audio.sfx('blip');
        if (aliens.some((a) => a.alive && a.y + 24 >= player.y)) {
          over = true;
          ctx.gameOver(score, { wave });
          return;
        }
      }

      eFireAcc += dt;
      if (eFireAcc > 0.8) {
        eFireAcc = 0;
        const shooters = aliens.filter((a) => a.alive);
        if (shooters.length) {
          const s = ctx.rng.pick(shooters);
          eBullets.push({ x: s.x + alienW / 2, y: s.y + 24 });
        }
      }

      if (pBullet) {
        pBullet.y -= 520 * dt;
        if (pBullet.y < -12) pBullet = null;
      }
      if (pBullet && hitBunker(pBullet.x, pBullet.y)) {
        pBullet = null;
        ctx.audio.sfx('hit');
      }
      if (pBullet && ufo && Math.abs(pBullet.x - ufo.x) < 18 && pBullet.y < 64) {
        score += ufo.worth;
        ctx.hud.setScore(score);
        ctx.hud.toast(`UFO +${ufo.worth}`);
        ctx.audio.sfx('coin');
        ufo = null;
        pBullet = null;
      }
      if (pBullet) {
        for (const a of aliens) {
          if (a.alive && pBullet.x > a.x && pBullet.x < a.x + alienW && pBullet.y > a.y && pBullet.y < a.y + 24) {
            a.alive = false;
            pBullet = null;
            score += (ROWS - a.row) * 10;
            ctx.hud.setScore(score);
            ctx.audio.sfx('explosion');
            break;
          }
        }
      }

      for (let i = eBullets.length - 1; i >= 0; i--) {
        const b = eBullets[i]!;
        b.y += 300 * dt;
        if (b.y > H) {
          eBullets.splice(i, 1);
          continue;
        }
        if (hitBunker(b.x, b.y)) {
          eBullets.splice(i, 1);
          continue;
        }
        if (Math.abs(b.x - player.x) < player.w / 2 && b.y > player.y && b.y < player.y + player.h) {
          eBullets.splice(i, 1);
          lives--;
          ctx.hud.setLives(lives);
          ctx.audio.sfx('hit');
          if (lives <= 0) {
            over = true;
            ctx.gameOver(score, { wave });
            return;
          }
        }
      }

      if (aliveCount() === 0) {
        wave++;
        ctx.hud.setLabel(`WAVE ${wave}`);
        ctx.audio.sfx('powerup');
        build();
        if (wave % 2 === 0) buildBunkers();
      }
      draw();
    },
    destroy() {
      offDown();
      offTap();
      layer.destroy({ children: true });
    },
  };
}
