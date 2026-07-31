import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import { clamp } from '@utils/math';

interface Alien { x: number; y: number; alive: boolean; row: number }
interface BunkerCell { x: number; y: number; hp: number }
interface Bullet { x: number; y: number; vx: number }
type PowerKind = 'rapid' | 'spread' | 'shield';
interface Drop { x: number; y: number; kind: PowerKind }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: number }
interface Star { x: number; y: number; s: number }

const POWER: Record<PowerKind, { color: number; label: string }> = {
  rapid: { color: 0xffd200, label: 'RAPID FIRE' },
  spread: { color: 0x00f7ff, label: 'SPREAD SHOT' },
  shield: { color: 0x3ddc84, label: 'SHIELD' },
};

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  ctx.stage.addChild(layer);
  const bgG = new Graphics();
  const g = new Graphics();
  layer.addChild(bgG, g);

  const COLS = 8;
  const ROWS = 5;
  const alienW = 24;
  const alienGapX = (W - 40) / COLS;
  const player = { x: W / 2, y: H - 36, w: 34, h: 14 };
  let aliens: Alien[] = [];
  let dir = 1;
  let stepAcc = 0;
  let descend = false;
  const pBullets: Bullet[] = [];
  const eBullets: { x: number; y: number }[] = [];
  const bunkers: BunkerCell[] = [];
  const drops: Drop[] = [];
  const particles: Particle[] = [];
  const stars: Star[] = [];
  let ufo: { x: number; dir: number; worth: number } | null = null;
  let ufoTimer = 12;
  let score = 0;
  let lives = 3;
  let wave = 1;
  let over = false;
  let eFireAcc = 0;
  let fireCd = 0;
  let rapidT = 0;
  let spreadT = 0;
  let shield = false;
  let shake = 0;
  const bSize = 6;

  for (let i = 0; i < 40; i++) stars.push({ x: ctx.rng.next() * W, y: ctx.rng.next() * H, s: ctx.rng.next() * 1.5 + 0.5 });

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

  const burst = (x: number, y: number, color: number, n = 10): void => {
    for (let i = 0; i < n; i++) {
      const a = ctx.rng.next() * Math.PI * 2;
      const s = 50 + ctx.rng.next() * 150;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, color });
    }
  };

  const fire = (): void => {
    if (over || fireCd > 0) return;
    const maxBullets = rapidT > 0 ? 4 : 2;
    if (pBullets.length >= maxBullets) return;
    if (spreadT > 0) {
      pBullets.push({ x: player.x, y: player.y - 12, vx: 0 });
      pBullets.push({ x: player.x, y: player.y - 12, vx: -140 });
      pBullets.push({ x: player.x, y: player.y - 12, vx: 140 });
    } else {
      pBullets.push({ x: player.x, y: player.y - 12, vx: 0 });
    }
    fireCd = rapidT > 0 ? 0.14 : 0.32;
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

  const setLabel = (): void => {
    const buffs = [rapidT > 0 ? '⚡' : '', spreadT > 0 ? '⋔' : '', shield ? '🛡' : ''].join('');
    ctx.hud.setLabel(`WAVE ${wave}${buffs ? '  ' + buffs : ''}`);
  };

  const killAlien = (a: Alien): void => {
    a.alive = false;
    score += (ROWS - a.row) * 10;
    ctx.hud.setScore(score);
    burst(a.x + alienW / 2, a.y + 8, a.row < 1 ? 0xff2e97 : a.row < 3 ? 0x00f7ff : 0x3ddc84);
    shake = Math.max(shake, 0.2);
    ctx.audio.sfx('explosion');
    if (ctx.rng.next() < 0.12) {
      const kinds: PowerKind[] = ['rapid', 'spread', 'shield'];
      drops.push({ x: a.x + alienW / 2, y: a.y + 12, kind: ctx.rng.pick(kinds) });
    }
  };

  const collect = (kind: PowerKind): void => {
    if (kind === 'rapid') rapidT = 8;
    else if (kind === 'spread') spreadT = 8;
    else shield = true;
    ctx.audio.sfx('powerup');
    ctx.hud.toast(POWER[kind].label);
    setLabel();
  };

  const draw = (): void => {
    bgG.clear();
    bgG.rect(0, 0, W, H).fill({ color: 0x05060f });
    for (const s of stars) bgG.circle(s.x, s.y, s.s).fill({ color: 0xffffff, alpha: 0.15 + s.s * 0.25 });

    g.clear();
    aliens.forEach((a) => {
      if (!a.alive) return;
      const col = a.row < 1 ? 0xff2e97 : a.row < 3 ? 0x00f7ff : 0x3ddc84;
      g.roundRect(a.x, a.y, alienW, 16, 4).fill({ color: col });
      g.rect(a.x + 4, a.y + 18, 4, 4).fill({ color: col });
      g.rect(a.x + alienW - 8, a.y + 18, 4, 4).fill({ color: col });
    });
    if (ufo) {
      g.roundRect(ufo.x - 16, 50, 32, 12, 6).fill({ color: 0xff2e97 });
      g.ellipse(ufo.x, 50, 10, 4).fill({ color: 0xffd6ec });
    }
    bunkers.forEach((c) => g.rect(c.x, c.y, bSize, bSize).fill({ color: 0x3ddc84, alpha: 0.4 + c.hp * 0.2 }));
    drops.forEach((d) => {
      g.roundRect(d.x - 8, d.y - 6, 16, 12, 3).fill({ color: POWER[d.kind].color });
      g.roundRect(d.x - 8, d.y - 6, 16, 12, 3).stroke({ width: 1, color: 0xffffff, alpha: 0.6 });
    });
    // player + shield
    if (shield) g.circle(player.x, player.y + 4, 24).stroke({ width: 2.5, color: 0x3ddc84, alpha: 0.7 });
    g.roundRect(player.x - player.w / 2, player.y, player.w, player.h, 3).fill({ color: 0x00f7ff });
    g.rect(player.x - 2, player.y - 6, 4, 6).fill({ color: 0x00f7ff });
    pBullets.forEach((b) => g.rect(b.x - 2, b.y, 4, 12).fill({ color: spreadT > 0 ? 0x00f7ff : 0xffffff }));
    eBullets.forEach((b) => g.rect(b.x - 2, b.y, 4, 12).fill({ color: 0xff4d4d }));
    particles.forEach((p) => g.circle(p.x, p.y, 3 * p.life).fill({ color: p.color, alpha: p.life }));
  };

  return {
    update(dt) {
      if (over) return;
      if (fireCd > 0) fireCd -= dt;
      if (rapidT > 0 && (rapidT -= dt) <= 0) setLabel();
      if (spreadT > 0 && (spreadT -= dt) <= 0) setLabel();
      if (shake > 0) shake = Math.max(0, shake - dt * 2);

      const ax = ctx.input.axis().x;
      if (ax) player.x = clamp(player.x + ax * 260 * dt, player.w / 2, W - player.w / 2);

      // starfield drift
      for (const s of stars) {
        s.y += s.s * 8 * dt;
        if (s.y > H) { s.y = 0; s.x = ctx.rng.next() * W; }
      }

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
          if ((a.x + alienGapX * dir > W - alienW - 6 && dir > 0) || (a.x + alienGapX * dir < 6 && dir < 0)) edge = true;
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

      // player bullets
      for (let i = pBullets.length - 1; i >= 0; i--) {
        const b = pBullets[i]!;
        b.y -= 520 * dt;
        b.x += b.vx * dt;
        if (b.y < -12 || b.x < -12 || b.x > W + 12) { pBullets.splice(i, 1); continue; }
        if (hitBunker(b.x, b.y)) { pBullets.splice(i, 1); ctx.audio.sfx('hit'); continue; }
        if (ufo && Math.abs(b.x - ufo.x) < 18 && b.y < 64) {
          score += ufo.worth;
          ctx.hud.setScore(score);
          ctx.hud.toast(`UFO +${ufo.worth}`);
          burst(ufo.x, 56, 0xff2e97, 14);
          ctx.audio.sfx('coin');
          ufo = null;
          pBullets.splice(i, 1);
          continue;
        }
        let hit = false;
        for (const a of aliens) {
          if (a.alive && b.x > a.x && b.x < a.x + alienW && b.y > a.y && b.y < a.y + 24) {
            killAlien(a);
            hit = true;
            break;
          }
        }
        if (hit) pBullets.splice(i, 1);
      }

      // drops fall
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]!;
        d.y += 120 * dt;
        if (d.y > H) { drops.splice(i, 1); continue; }
        if (Math.abs(d.x - player.x) < player.w / 2 + 6 && d.y > player.y - 6) {
          collect(d.kind);
          drops.splice(i, 1);
        }
      }

      // enemy bullets
      for (let i = eBullets.length - 1; i >= 0; i--) {
        const b = eBullets[i]!;
        b.y += 300 * dt;
        if (b.y > H) { eBullets.splice(i, 1); continue; }
        if (hitBunker(b.x, b.y)) { eBullets.splice(i, 1); continue; }
        if (Math.abs(b.x - player.x) < player.w / 2 && b.y > player.y && b.y < player.y + player.h) {
          eBullets.splice(i, 1);
          if (shield) {
            shield = false;
            burst(player.x, player.y, 0x3ddc84, 12);
            ctx.audio.sfx('powerup');
            ctx.hud.toast('SHIELD DOWN');
            setLabel();
            continue;
          }
          lives--;
          shake = 0.5;
          burst(player.x, player.y, 0x00f7ff, 14);
          ctx.hud.setLives(lives);
          ctx.audio.sfx('hit');
          if (lives <= 0) {
            over = true;
            ctx.gameOver(score, { wave });
            return;
          }
        }
      }

      // particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt * 1.8;
        if (p.life <= 0) particles.splice(i, 1);
      }

      if (aliveCount() === 0) {
        wave++;
        setLabel();
        ctx.hud.toast(`WAVE ${wave}`);
        ctx.audio.sfx('powerup');
        build();
        if (wave % 2 === 0) buildBunkers();
      }

      const rmS = document.documentElement.classList.contains('a11y-reduced-motion') ? 0 : shake;
      layer.position.set(rmS > 0 ? (ctx.rng.next() * 2 - 1) * rmS * 7 : 0, rmS > 0 ? (ctx.rng.next() * 2 - 1) * rmS * 7 : 0);
      draw();
    },
    destroy() {
      offDown();
      offTap();
      layer.destroy({ children: true });
    },
  };
}
