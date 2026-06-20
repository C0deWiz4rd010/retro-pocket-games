import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import { burst, clamp, drawSparks, type Spark, updateSparks } from './juice';

const CYAN = 0x00f7ff;
const PINK = 0xff2e97;
const GOLD = 0xffd200;
const GREEN = 0x3ddc84;
const BLUE = 0x38bdf8;
const VIOLET = 0xb388ff;
const WHITE = 0xf6f7ff;

function makeLayer(ctx: GameContext): { layer: Container; g: Graphics; sparks: Spark[] } {
  const layer = new Container();
  const g = new Graphics();
  const sparks: Spark[] = [];
  layer.addChild(g);
  ctx.stage.addChild(layer);
  return { layer, g, sparks };
}

function backdrop(g: Graphics, w: number, h: number, t: number, horizon = h * 0.56): void {
  g.rect(0, 0, w, h).fill({ color: 0x050511 });
  for (let y = -8; y < h; y += 8) {
    g.rect(0, y + ((t * 10) % 8), w, 1).fill({ color: 0xffffff, alpha: 0.025 });
  }
  for (let i = 0; i < 30; i++) {
    const x = (i * 73 + Math.sin(t * 0.6 + i) * 14) % w;
    const y = 18 + ((i * 41 + t * 16) % (h * 0.5));
    g.rect(x, y, 2, 2).fill({ color: i % 3 === 0 ? PINK : CYAN, alpha: 0.25 + (i % 5) * 0.08 });
  }
  for (let x = 0; x <= w; x += 28) {
    g.moveTo(x, horizon).lineTo(w / 2 + (x - w / 2) * 2.8, h).stroke({ width: 1, color: CYAN, alpha: 0.12 });
  }
  for (let y = horizon; y < h; y += 24) {
    g.moveTo(0, y).lineTo(w, y).stroke({ width: 1, color: PINK, alpha: 0.1 });
  }
}

function city(g: Graphics, w: number, h: number, t: number): void {
  const base = h * 0.5;
  for (let i = 0; i < 12; i++) {
    const bw = 22 + (i % 4) * 8;
    const bh = 38 + ((i * 29) % 72);
    const x = ((i * 53 - t * 18) % (w + 80)) - 40;
    g.rect(x, base - bh, bw, bh).fill({ color: 0x0b1530, alpha: 0.95 });
    for (let yy = base - bh + 8; yy < base - 6; yy += 14) {
      for (let xx = x + 5; xx < x + bw - 3; xx += 10) {
        if (((xx + yy + i) | 0) % 3 === 0) g.rect(xx, yy, 3, 4).fill({ color: i % 2 ? CYAN : PINK, alpha: 0.55 });
      }
    }
  }
}

function boxHit(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function createPixelDash(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const ground = H - 74;
  const { layer, g, sparks } = makeLayer(ctx);
  const runner = { x: W * 0.22, y: ground, vy: 0, duck: false };
  const obstacles: { x: number; y: number; w: number; h: number; kind: 'spike' | 'block' | 'drone' }[] = [];
  const coins: { x: number; y: number; hit: boolean }[] = [];
  // Feature: floating shield / magnet pickups
  const pickups: { x: number; y: number; kind: 'shield' | 'magnet' }[] = [];
  let t = 0;
  let score = 0;
  let lives = 3;
  let invuln = 0;
  let jumpsLeft = 2;
  let dash = 0;
  let dashCd = 0;
  let speed = 255;
  let spawn = 0.4;
  let over = false;
  let shieldHits = 0; // Feature: shield absorbs a hit
  let magnet = 0; // Feature: magnet attracts coins
  let zone = 1; // Feature: distance zones with a rising multiplier

  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('DOUBLE JUMP');

  const jump = (): void => {
    if (jumpsLeft > 0) {
      runner.vy = -790;
      jumpsLeft--;
      ctx.audio.sfx('jump');
      burst(sparks, ctx.rng, runner.x - 10, runner.y, jumpsLeft === 1 ? CYAN : GOLD, 8, 70);
    }
  };
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a' || a === 'up') jump();
    if ((a === 'b' || a === 'right') && dashCd <= 0) {
      dash = 0.42;
      dashCd = 2.6;
      ctx.hud.toast('DASH!');
      ctx.audio.sfx('powerup');
      burst(sparks, ctx.rng, runner.x - 16, runner.y - 22, GOLD, 16, 140);
    }
    if (a === 'down') runner.duck = true;
  });
  const offUp = ctx.input.on('up', (a) => {
    if (a === 'down') runner.duck = false;
  });
  const offTap = ctx.input.on('tap', jump);

  const spawnSet = (): void => {
    const kind = ctx.rng.pick(['spike', 'block', 'drone'] as const);
    const h = kind === 'drone' ? 18 : kind === 'spike' ? 24 : 34;
    const y = kind === 'drone' ? ground - 78 : ground - h + 8;
    obstacles.push({ x: W + 20, y, w: kind === 'spike' ? 26 : 30, h, kind });
    const arcY = kind === 'drone' ? ground - 118 : ground - 52;
    for (let i = 0; i < 3; i++) coins.push({ x: W + 86 + i * 24, y: arcY - Math.sin(i / 2) * 22, hit: false });
    if (ctx.rng.next() < 0.2) pickups.push({ x: W + 140, y: ground - 70 - ctx.rng.next() * 50, kind: ctx.rng.next() < 0.5 ? 'shield' : 'magnet' });
  };
  spawnSet();

  function draw(): void {
    g.clear();
    backdrop(g, W, H, t, ground + 10);
    city(g, W, H, t);
    g.rect(0, ground + 8, W, H - ground).fill({ color: 0x0d1020 });
    g.rect(0, ground + 8, W, 3).fill({ color: PINK });
    for (const c of coins) {
      if (c.hit) continue;
      const p = 1 + Math.sin(t * 7 + c.x) * 0.14;
      g.circle(c.x, c.y, 7 * p).fill({ color: GOLD });
      g.circle(c.x - 2, c.y - 2, 2).fill({ color: WHITE, alpha: 0.7 });
    }
    for (const o of obstacles) {
      if (o.kind === 'spike') {
        g.moveTo(o.x, o.y + o.h).lineTo(o.x + o.w / 2, o.y).lineTo(o.x + o.w, o.y + o.h).closePath()
          .fill({ color: PINK })
          .stroke({ width: 2, color: WHITE, alpha: 0.28 });
      } else if (o.kind === 'drone') {
        g.roundRect(o.x, o.y, o.w, o.h, 5).fill({ color: VIOLET });
        g.circle(o.x + 6, o.y + o.h + 4, 4).fill({ color: CYAN });
        g.circle(o.x + o.w - 6, o.y + o.h + 4, 4).fill({ color: CYAN });
      } else {
        g.roundRect(o.x, o.y, o.w, o.h, 4).fill({ color: 0xff7b00 });
        g.rect(o.x + 5, o.y + 6, o.w - 10, 4).fill({ color: GOLD, alpha: 0.65 });
      }
    }
    for (const pk of pickups) {
      if (pk.kind === 'shield') {
        g.circle(pk.x, pk.y, 12).stroke({ width: 3, color: CYAN });
        g.circle(pk.x, pk.y, 5).fill({ color: CYAN, alpha: 0.8 });
      } else {
        g.roundRect(pk.x - 9, pk.y - 9, 18, 18, 4).fill({ color: VIOLET });
        g.rect(pk.x - 9, pk.y - 3, 18, 6).fill({ color: 0x160716, alpha: 0.6 });
      }
    }
    const rh = runner.duck && runner.y >= ground - 1 ? 26 : 42;
    const rx = runner.x - 13;
    const ry = runner.y - rh;
    if (shieldHits > 0 || magnet > 0) g.circle(runner.x, runner.y - rh / 2, rh * 0.7).stroke({ width: 2, color: shieldHits > 0 ? CYAN : VIOLET, alpha: 0.5 + Math.sin(t * 8) * 0.2 });
    g.roundRect(rx, ry, 26, rh, 5).fill({ color: invuln > 0 && Math.floor(t * 18) % 2 === 0 ? GOLD : 0xff7043 });
    g.roundRect(rx + 6, ry + 6, 18, 12, 4).fill({ color: 0xffd1a8 });
    g.rect(rx + 18, ry + 10, 4, 4).fill({ color: 0x101018 });
    const leg = Math.sin(t * 16) * 5;
    if (dash > 0) {
      g.roundRect(rx - 34, ry + 6, 28, rh - 6, 5).fill({ color: GOLD, alpha: 0.24 });
      g.roundRect(rx - 58, ry + 12, 20, rh - 16, 5).fill({ color: CYAN, alpha: 0.16 });
    }
    g.rect(rx + 3, runner.y, 6, 10 + leg).fill({ color: BLUE });
    g.rect(rx + 16, runner.y, 6, 10 - leg).fill({ color: BLUE });
    drawSparks(g, sparks);
  }

  return {
    update(dt) {
      if (over) return;
      t += dt;
      updateSparks(sparks, dt);
      invuln = Math.max(0, invuln - dt);
      dash = Math.max(0, dash - dt);
      dashCd = Math.max(0, dashCd - dt);
      magnet = Math.max(0, magnet - dt);
      speed += dt * 7;
      const runMult = (dash > 0 ? 1.55 : 1) * zone; // zone multiplier
      score += Math.floor(dt * 22 * runMult);
      // Feature: distance zones
      const newZone = 1 + Math.floor(score / 4000);
      if (newZone > zone) {
        zone = newZone;
        ctx.hud.toast(`ZONE ${zone} · x${zone}`);
        ctx.audio.sfx('powerup');
      }
      runner.vy += 2200 * dt;
      runner.y = Math.min(ground, runner.y + runner.vy * dt);
      if (runner.y >= ground) {
        runner.vy = 0;
        jumpsLeft = 2;
      }
      spawn -= dt;
      if (spawn <= 0) {
        spawn = Math.max(0.62, 1.1 - score / 12000) + ctx.rng.next() * 0.35;
        spawnSet();
      }
      const scrollV = speed * (dash > 0 ? 1.55 : 1);
      for (const o of obstacles) o.x -= scrollV * dt;
      for (const c of coins) c.x -= scrollV * dt;
      for (const pk of pickups) pk.x -= scrollV * dt;
      const rh = runner.duck && runner.y >= ground - 1 ? 26 : 42;
      // Feature: magnet pulls nearby coins toward the runner
      if (magnet > 0) {
        for (const c of coins) {
          if (c.hit) continue;
          if (Math.hypot(c.x - runner.x, c.y - (runner.y - rh / 2)) < 150) {
            c.x += (runner.x - c.x) * Math.min(1, dt * 8);
            c.y += (runner.y - rh / 2 - c.y) * Math.min(1, dt * 8);
          }
        }
      }
      for (const c of coins) {
        if (!c.hit && Math.hypot(c.x - runner.x, c.y - (runner.y - rh / 2)) < 20) {
          c.hit = true;
          score += 90;
          ctx.audio.sfx('coin');
          burst(sparks, ctx.rng, c.x, c.y, GOLD, 10, 110);
        }
      }
      // pickup collection
      for (let i = pickups.length - 1; i >= 0; i--) {
        const pk = pickups[i]!;
        if (Math.hypot(pk.x - runner.x, pk.y - (runner.y - rh / 2)) < 24) {
          pickups.splice(i, 1);
          if (pk.kind === 'shield') { shieldHits = 1; ctx.hud.toast('SHIELD'); }
          else { magnet = 6; ctx.hud.toast('MAGNET'); }
          ctx.audio.sfx('powerup');
          burst(sparks, ctx.rng, runner.x, runner.y - rh / 2, pk.kind === 'shield' ? CYAN : VIOLET, 14, 120);
        } else if (pk.x < -40) pickups.splice(i, 1);
      }
      for (const o of obstacles) {
        if (invuln <= 0 && boxHit(runner.x - 12, runner.y - rh, 24, rh, o.x, o.y, o.w, o.h)) {
          o.x = -80;
          invuln = 1.15;
          ctx.fx.screenShake(8, 0.18);
          if (shieldHits > 0) {
            // Feature: shield absorbs the hit instead of losing a life
            shieldHits--;
            ctx.audio.sfx('powerup');
            ctx.hud.toast('SHIELD BLOCKED');
            burst(sparks, ctx.rng, runner.x, runner.y - rh / 2, CYAN, 18, 150);
            continue;
          }
          lives--;
          ctx.hud.setLives(lives);
          ctx.audio.sfx('hit');
          burst(sparks, ctx.rng, runner.x, runner.y - rh / 2, PINK, 18, 150);
          if (lives <= 0) {
            over = true;
            ctx.audio.sfx('explosion');
            ctx.gameOver(score, { speed: Math.round(speed), zone });
          }
        }
      }
      ctx.hud.setScore(score);
      ctx.hud.setLabel(magnet > 0 ? `MAGNET ${Math.ceil(magnet)}` : shieldHits > 0 ? 'SHIELD READY' : dash > 0 ? 'DASH RUN' : `ZONE ${zone}`);
      draw();
    },
    destroy() {
      offDown(); offUp(); offTap();
      layer.destroy({ children: true });
    },
  };
}

export function createNeonRider(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const { layer, g, sparks } = makeLayer(ctx);
  const lanes = [W * 0.28, W * 0.5, W * 0.72];
  const items: { x: number; lane: number; kind: 'car' | 'coin' | 'boost' | 'shield'; phase: number; scored?: boolean }[] = [];
  let target = 1;
  let px = lanes[1]!;
  let speed = 235;
  let score = 0;
  let lives = 3;
  let boost = 0;
  let combo = 0;
  let comboTimer = 0;
  let spawn = 0;
  let t = 0;
  let over = false;
  let shieldHits = 0; // Feature: shield pickup absorbs one crash
  let gear = 1; // Feature: gear multiplier rises with distance
  let slowmo = 0; // Feature: near-miss slow-motion reward
  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('SHIFT LANES');
  const move = (d: -1 | 1): void => {
    target = clamp(target + d, 0, 2);
    ctx.audio.sfx('blip');
  };
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'left') move(-1);
    if (a === 'right') move(1);
    if (a === 'a' || a === 'up') boost = Math.max(boost, 0.45);
  });
  const offSwipe = ctx.input.on('swipe', (d) => {
    if (d === 'left') move(-1);
    if (d === 'right') move(1);
  });

  const spawnItem = (): void => {
    const r = ctx.rng.next();
    const kind = r > 0.94 ? 'shield' : r > 0.84 ? 'boost' : r > 0.56 ? 'coin' : 'car';
    items.push({ x: W + 35, lane: ctx.rng.int(0, 2), kind, phase: ctx.rng.next() * 9 });
  };

  function draw(): void {
    g.clear();
    backdrop(g, W, H, t, H * 0.42);
    g.moveTo(W * 0.32, H * 0.32).lineTo(W * 0.68, H * 0.32).lineTo(W - 24, H - 60).lineTo(24, H - 60).closePath()
      .fill({ color: 0x090a18, alpha: 0.94 })
      .stroke({ width: 2, color: CYAN, alpha: 0.35 });
    for (let i = 0; i < 22; i++) {
      const y = H * 0.34 + ((i * 42 + t * speed * (boost > 0 ? 1.8 : 1)) % (H * 0.58));
      const scale = (y - H * 0.32) / (H * 0.62);
      g.rect(W / 2 - 2, y, 4, 12 + scale * 26).fill({ color: WHITE, alpha: 0.08 + scale * 0.22 });
    }
    for (const item of items) {
      const y = lanes[item.lane]!;
      if (item.kind === 'coin') {
        g.circle(item.x, y + Math.sin(t * 8 + item.phase) * 4, 11).fill({ color: GOLD });
      } else if (item.kind === 'boost') {
        g.circle(item.x, y, 13).stroke({ width: 4, color: GREEN });
        g.rect(item.x - 4, y - 9, 8, 18).fill({ color: GREEN, alpha: 0.8 });
      } else if (item.kind === 'shield') {
        g.circle(item.x, y, 13).stroke({ width: 4, color: CYAN });
        g.circle(item.x, y, 6).fill({ color: CYAN, alpha: 0.8 });
      } else {
        g.roundRect(item.x - 17, y - 23, 34, 46, 7).fill({ color: PINK });
        g.rect(item.x - 10, y - 12, 20, 16).fill({ color: 0x160716, alpha: 0.65 });
        g.circle(item.x - 8, y + 22, 4).fill({ color: GOLD });
        g.circle(item.x + 8, y + 22, 4).fill({ color: GOLD });
      }
    }
    const y = lanes[target]!;
    if (shieldHits > 0) g.circle(px, y, 34 + Math.sin(t * 8) * 2).stroke({ width: 2, color: CYAN, alpha: 0.6 });
    g.roundRect(px - 16, y - 26, 32, 52, 8).fill({ color: boost > 0 ? GOLD : CYAN });
    g.roundRect(px - 9, y - 15, 18, 22, 6).fill({ color: 0x060817, alpha: 0.7 });
    g.circle(px - 10, y + 25, 4).fill({ color: PINK });
    g.circle(px + 10, y + 25, 4).fill({ color: PINK });
    if (boost > 0) g.rect(px - 10, y + 30, 20, 32).fill({ color: GOLD, alpha: 0.28 });
    drawSparks(g, sparks);
  }

  return {
    update(dt) {
      if (over) return;
      t += dt;
      updateSparks(sparks, dt);
      speed += dt * 4;
      boost = Math.max(0, boost - dt);
      slowmo = Math.max(0, slowmo - dt);
      comboTimer = Math.max(0, comboTimer - dt);
      if (comboTimer <= 0) combo = 0;
      // Feature: gear multiplier rises with distance
      const newGear = 1 + Math.floor(score / 6000);
      if (newGear > gear) { gear = newGear; ctx.hud.toast(`GEAR ${gear} · x${gear}`); ctx.audio.sfx('powerup'); }
      px += (lanes[target]! - px) * Math.min(1, dt * 14);
      spawn -= dt;
      if (spawn <= 0) {
        spawn = Math.max(0.42, 0.9 - score / 15000);
        spawnItem();
      }
      const slowFactor = slowmo > 0 ? 0.45 : 1;
      const mult = boost > 0 ? 1.85 : 1;
      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i]!;
        item.x -= speed * mult * slowFactor * dt;
        if (item.x < -40) {
          items.splice(i, 1);
          continue;
        }
        if (Math.abs(item.x - px) < 27 && item.lane === target) {
          if (item.kind === 'car') {
            items.splice(i, 1);
            ctx.fx.screenShake(7, 0.16);
            if (shieldHits > 0) {
              shieldHits--;
              ctx.audio.sfx('powerup');
              ctx.hud.toast('SHIELD BLOCKED');
              burst(sparks, ctx.rng, px, lanes[target]!, CYAN, 16, 140);
            } else {
              combo = 0;
              lives--;
              ctx.hud.setLives(lives);
              ctx.audio.sfx('hit');
              if (lives <= 0) {
                over = true;
                ctx.gameOver(score, { speed: Math.round(speed), gear });
              }
            }
          } else {
            items.splice(i, 1);
            combo++;
            comboTimer = 2.4;
            const pts = ((item.kind === 'coin' ? 95 : 180) + combo * 12) * gear;
            score += pts;
            if (item.kind === 'boost') boost = 4;
            if (item.kind === 'shield') { shieldHits = 1; ctx.hud.toast('SHIELD'); }
            if (combo >= 4) ctx.fx.floatingText(`COMBO x${combo}`, px, lanes[target]! - 36, GOLD);
            ctx.audio.sfx(item.kind === 'coin' ? 'coin' : 'powerup');
            burst(sparks, ctx.rng, px, lanes[target]!, item.kind === 'coin' ? GOLD : item.kind === 'shield' ? CYAN : GREEN, 14, 140);
          }
        } else if (
          item.kind === 'car'
          && !item.scored
          && Math.abs(item.x - px) < 18
          && Math.abs(item.lane - target) === 1
        ) {
          item.scored = true;
          combo++;
          comboTimer = 2.4;
          slowmo = 0.5; // Feature: near-miss slow-motion reward
          score += ((boost > 0 ? 110 : 55) + combo * 10) * gear;
          ctx.fx.floatingText('NEAR MISS', px, lanes[target]! - 34, CYAN);
          burst(sparks, ctx.rng, px, lanes[target]!, CYAN, 7, 80);
        }
      }
      score += Math.floor(dt * 24 * mult * gear);
      ctx.hud.setScore(score);
      ctx.hud.setLabel(slowmo > 0 ? 'NEAR MISS!' : boost > 0 ? `BOOST ${Math.ceil(boost)}` : shieldHits > 0 ? `SHIELD · GEAR ${gear}` : `GEAR ${gear}`);
      draw();
    },
    destroy() {
      offDown(); offSwipe();
      layer.destroy({ children: true });
    },
  };
}

export function createBlockCollapse(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const { layer, g, sparks } = makeLayer(ctx);
  const N = 9;
  const COLORS = [PINK, GOLD, GREEN, CYAN, VIOLET];
  const size = Math.min(W - 28, H - 120);
  const cell = size / N;
  const ox = (W - size) / 2;
  const oy = 72;
  const grid = Array.from({ length: N * N }, () => ctx.rng.int(0, COLORS.length - 1));
  let score = 0;
  let moves = 34;
  let level = 1; // Feature: level progression
  let target = 4000;
  let t = 0;
  let over = false;
  const at = (c: number, r: number): number => grid[r * N + c]!;
  const set = (c: number, r: number, v: number): void => { grid[r * N + c] = v; };
  ctx.hud.setScore(0);
  ctx.hud.setLabel(`MOVES ${moves} · L1`);

  const groupAt = (c: number, r: number): number[] => {
    const color = at(c, r);
    const seen = new Set<number>();
    const q = [r * N + c];
    while (q.length) {
      const i = q.pop()!;
      if (seen.has(i)) continue;
      const cc = i % N;
      const rr = Math.floor(i / N);
      if (at(cc, rr) !== color) continue;
      seen.add(i);
      if (cc > 0) q.push(i - 1);
      if (cc < N - 1) q.push(i + 1);
      if (rr > 0) q.push(i - N);
      if (rr < N - 1) q.push(i + N);
    }
    return [...seen];
  };

  const collapse = (): void => {
    for (let c = 0; c < N; c++) {
      const col: number[] = [];
      for (let r = N - 1; r >= 0; r--) if (at(c, r) >= 0) col.push(at(c, r));
      for (let r = N - 1; r >= 0; r--) set(c, r, col[N - 1 - r] ?? ctx.rng.int(0, COLORS.length - 1));
    }
  };

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (over) return;
    const c = Math.floor((x - ox) / cell);
    const r = Math.floor((y - oy) / cell);
    if (c < 0 || r < 0 || c >= N || r >= N) return;
    const group = groupAt(c, r);
    if (group.length < 2) {
      ctx.audio.sfx('hit');
      return;
    }
    moves--;
    const color = at(c, r);
    const cleared = new Set(group);
    if (group.length >= 6) {
      for (let rr = r - 1; rr <= r + 1; rr++) {
        for (let cc = c - 1; cc <= c + 1; cc++) {
          if (cc >= 0 && rr >= 0 && cc < N && rr < N) cleared.add(rr * N + cc);
        }
      }
      ctx.hud.toast('BLAST!');
    }
    // Feature: color-bomb chain — a huge group also clears every same-colour block
    if (group.length >= 9) {
      for (let i = 0; i < N * N; i++) if (grid[i] === color) cleared.add(i);
      ctx.hud.toast('COLOR BOMB!');
      ctx.fx.screenShake(6, 0.18);
    }
    // Feature: large clears refund moves
    if (group.length >= 7) {
      moves += 2;
      ctx.fx.floatingText('+2 MOVES', ox + c * cell + cell / 2, oy + r * cell - 26, GREEN);
    }
    const pts = cleared.size * cleared.size * (group.length >= 9 ? 22 : group.length >= 6 ? 16 : 12);
    score += pts;
    ctx.fx.floatingText(`+${pts}`, ox + c * cell + cell / 2, oy + r * cell - 10, group.length >= 6 ? GOLD : WHITE);
    for (const i of cleared) {
      const cc = i % N;
      const rr = Math.floor(i / N);
      set(cc, rr, -1);
      burst(sparks, ctx.rng, ox + cc * cell + cell / 2, oy + rr * cell + cell / 2, COLORS[group.length % COLORS.length]!, 4, 60);
    }
    collapse();
    ctx.audio.sfx(group.length > 5 ? 'powerup' : 'coin');
    // Feature: level progression — hit the target to advance with bonus moves
    if (score >= target) {
      level++;
      moves += 14;
      target += 4000 + level * 1500;
      ctx.hud.toast(`LEVEL ${level}! +14 MOVES`);
      ctx.audio.sfx('levelup');
    }
    ctx.hud.setScore(score);
    ctx.hud.setLabel(`MOVES ${moves} · L${level}`);
    if (moves <= 0) {
      over = true;
      ctx.gameOver(score, { blocks: group.length, level });
    }
    draw();
  });

  function draw(): void {
    g.clear();
    backdrop(g, W, H, t, H * 0.76);
    g.roundRect(ox - 8, oy - 8, size + 16, size + 16, 12).fill({ color: 0x090a18, alpha: 0.92 }).stroke({ width: 2, color: CYAN, alpha: 0.25 });
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const color = COLORS[at(c, r)] ?? WHITE;
        const x = ox + c * cell;
        const y = oy + r * cell;
        g.roundRect(x + 3, y + 3, cell - 6, cell - 6, 5).fill({ color, alpha: 0.92 });
        g.rect(x + 7, y + 7, cell - 14, 3).fill({ color: WHITE, alpha: 0.22 });
      }
    }
    drawSparks(g, sparks);
  }

  draw();
  return {
    update(dt) {
      t += dt;
      updateSparks(sparks, dt);
      draw();
    },
    destroy() {
      offTap();
      layer.destroy({ children: true });
    },
  };
}

export function createSpaceBlaster(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const { layer, g, sparks } = makeLayer(ctx);
  const player = { x: W / 2, y: H - 64, cd: 0 };
  const bullets: { x: number; y: number; vx: number; vy: number; color: number }[] = [];
  const enemies: { x: number; y: number; hp: number; kind: 'bug' | 'rock' | 'saucer'; phase: number }[] = [];
  const eBullets: { x: number; y: number; vx: number; vy: number }[] = []; // Feature: enemy fire
  const drops: { x: number; y: number; kind: 'rapid' | 'bomb' }[] = []; // Feature: power-up drops
  let score = 0;
  let lives = 3;
  let shield = 0;
  let spawn = 0;
  let t = 0;
  let over = false;
  let rapid = 0; // Feature: rapid-fire power-up
  let streak = 0; // Feature: kill streak multiplier
  let eFire = 0;
  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('A LASER / B SPREAD');
  const fire = (spread = false): void => {
    if (player.cd > 0) return;
    player.cd = (spread ? 0.3 : 0.16) * (rapid > 0 ? 0.5 : 1);
    bullets.push({ x: player.x, y: player.y - 18, vx: 0, vy: -580, color: CYAN });
    if (spread) {
      bullets.push({ x: player.x - 9, y: player.y - 12, vx: -150, vy: -520, color: GOLD });
      bullets.push({ x: player.x + 9, y: player.y - 12, vx: 150, vy: -520, color: GOLD });
    }
    ctx.audio.sfx('shoot');
  };
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a') fire();
    if (a === 'b') fire(true);
  });
  const offTap = ctx.input.on('tap', () => fire());

  const spawnEnemy = (): void => {
    const kind = ctx.rng.pick(['bug', 'rock', 'saucer'] as const);
    enemies.push({ x: 28 + ctx.rng.next() * (W - 56), y: -30, hp: kind === 'rock' ? 3 : kind === 'saucer' ? 2 : 1, kind, phase: ctx.rng.next() * 9 });
  };

  function draw(): void {
    g.clear();
    backdrop(g, W, H, t, H * 0.7);
    for (const e of enemies) {
      if (e.kind === 'rock') {
        g.moveTo(e.x - 16, e.y).lineTo(e.x - 4, e.y - 15).lineTo(e.x + 16, e.y - 7).lineTo(e.x + 12, e.y + 15).lineTo(e.x - 14, e.y + 13).closePath()
          .fill({ color: 0x8fa3b8 })
          .stroke({ width: 2, color: WHITE, alpha: 0.25 });
      } else if (e.kind === 'saucer') {
        g.roundRect(e.x - 22, e.y - 8, 44, 16, 8).fill({ color: PINK });
        g.circle(e.x, e.y - 9, 10).fill({ color: VIOLET });
      } else {
        g.roundRect(e.x - 14, e.y - 10, 28, 20, 5).fill({ color: GREEN });
        g.rect(e.x - 18, e.y - 3, 36, 5).fill({ color: GREEN, alpha: 0.65 });
      }
    }
    for (const b of bullets) g.rect(b.x - 2, b.y - 9, 4, 16).fill({ color: b.color });
    for (const b of eBullets) g.rect(b.x - 2, b.y - 6, 4, 12).fill({ color: 0xff4d4d });
    for (const d of drops) {
      g.roundRect(d.x - 8, d.y - 8, 16, 16, 4).fill({ color: d.kind === 'rapid' ? GOLD : PINK });
      g.rect(d.x - 8, d.y - 2, 16, 4).fill({ color: 0x160716, alpha: 0.6 });
    }
    if (shield > 0) g.circle(player.x, player.y, 30 + Math.sin(t * 10) * 2).stroke({ width: 3, color: CYAN, alpha: 0.75 });
    g.moveTo(player.x, player.y - 28).lineTo(player.x + 20, player.y + 18).lineTo(player.x, player.y + 8).lineTo(player.x - 20, player.y + 18).closePath().fill({ color: CYAN });
    g.circle(player.x, player.y, 6).fill({ color: WHITE, alpha: 0.7 });
    drawSparks(g, sparks);
  }

  return {
    update(dt) {
      if (over) return;
      t += dt;
      updateSparks(sparks, dt);
      player.cd = Math.max(0, player.cd - dt);
      shield = Math.max(0, shield - dt);
      rapid = Math.max(0, rapid - dt);
      const ax = ctx.input.axis().x;
      player.x = clamp(player.x + ax * 310 * dt, 24, W - 24);
      if (ctx.input.isDown('b')) fire(true);
      else if (ctx.input.isDown('a')) fire();
      spawn -= dt;
      if (spawn <= 0) {
        spawn = Math.max(0.34, 0.8 - score / 16000);
        spawnEnemy();
      }
      // Feature: enemies fire back at the player
      eFire -= dt;
      if (eFire <= 0 && enemies.length) {
        eFire = Math.max(0.5, 1.4 - score / 20000);
        const shooter = enemies[ctx.rng.int(0, enemies.length - 1)]!;
        if (shooter.y > 0 && shooter.y < H * 0.7) {
          const ang = Math.atan2(player.y - shooter.y, player.x - shooter.x);
          eBullets.push({ x: shooter.x, y: shooter.y, vx: Math.cos(ang) * 200, vy: Math.sin(ang) * 200 + 80 });
          ctx.audio.sfx('blip');
        }
      }
      for (let i = eBullets.length - 1; i >= 0; i--) {
        const b = eBullets[i]!;
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y > H + 20 || b.x < -20 || b.x > W + 20) { eBullets.splice(i, 1); continue; }
        if (boxHit(b.x - 3, b.y - 6, 6, 12, player.x - 16, player.y - 24, 32, 40)) {
          eBullets.splice(i, 1);
          ctx.fx.screenShake(7, 0.14);
          if (shield > 0) { shield = 0; ctx.audio.sfx('hit'); }
          else { lives--; streak = 0; ctx.hud.setLives(lives); ctx.audio.sfx('hit'); if (lives <= 0) { over = true; ctx.gameOver(score); } }
        }
      }
      // Feature: power-up drops fall and are collected
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]!;
        d.y += 120 * dt;
        if (d.y > H + 20) { drops.splice(i, 1); continue; }
        if (Math.abs(d.x - player.x) < 24 && Math.abs(d.y - player.y) < 28) {
          drops.splice(i, 1);
          if (d.kind === 'rapid') { rapid = 7; ctx.hud.toast('RAPID FIRE'); }
          else {
            ctx.hud.toast('SMART BOMB!');
            ctx.fx.screenShake(10, 0.25);
            for (const e of enemies) { score += 50; burst(sparks, ctx.rng, e.x, e.y, GOLD, 8, 110); }
            enemies.length = 0;
            eBullets.length = 0;
          }
          ctx.audio.sfx('powerup');
        }
      }
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i]!;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.y < -20) bullets.splice(i, 1);
      }
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i]!;
        e.y += (75 + score * 0.014) * dt;
        e.x += Math.sin(t * 2 + e.phase) * (e.kind === 'saucer' ? 80 : 22) * dt;
        if (e.y > H + 30) {
          enemies.splice(i, 1);
          if (shield > 0) {
            shield = 0;
            ctx.audio.sfx('hit');
            ctx.fx.screenShake(4, 0.1);
          } else {
            lives--;
            streak = 0;
            ctx.hud.setLives(lives);
          }
          if (lives <= 0) {
            over = true;
            ctx.gameOver(score);
          }
          continue;
        }
        if (boxHit(player.x - 16, player.y - 24, 32, 40, e.x - 18, e.y - 16, 36, 32)) {
          enemies.splice(i, 1);
          if (shield > 0) {
            shield = 0;
            ctx.audio.sfx('hit');
            burst(sparks, ctx.rng, player.x, player.y, CYAN, 18, 150);
          } else {
            lives--;
            streak = 0;
            ctx.hud.setLives(lives);
          }
          ctx.fx.screenShake(8, 0.16);
          if (lives <= 0) {
            over = true;
            ctx.gameOver(score);
          }
        }
        for (let j = bullets.length - 1; j >= 0; j--) {
          const b = bullets[j]!;
          if (boxHit(b.x - 3, b.y - 9, 6, 18, e.x - 20, e.y - 18, 40, 36)) {
            bullets.splice(j, 1);
            e.hp--;
            burst(sparks, ctx.rng, e.x, e.y, e.kind === 'rock' ? WHITE : PINK, 8, 90);
            if (e.hp <= 0) {
              enemies.splice(i, 1);
              streak++;
              const mult = 1 + Math.floor(streak / 5);
              score += (e.kind === 'rock' ? 80 : e.kind === 'saucer' ? 160 : 60) * mult;
              if (streak > 0 && streak % 5 === 0) ctx.fx.floatingText(`STREAK x${streak} (${mult}x)`, e.x, e.y - 16, GOLD);
              if (e.kind === 'saucer') {
                shield = 5;
                ctx.hud.toast('SHIELD READY');
              }
              // Feature: drop a power-up
              if (ctx.rng.next() < 0.16) drops.push({ x: e.x, y: e.y, kind: ctx.rng.next() < 0.6 ? 'rapid' : 'bomb' });
              ctx.audio.sfx('explosion');
            } else ctx.audio.sfx('hit');
            break;
          }
        }
      }
      ctx.hud.setScore(score);
      ctx.hud.setLabel(rapid > 0 ? `RAPID ${Math.ceil(rapid)}` : streak >= 5 ? `STREAK x${streak}` : shield > 0 ? `SHIELD ${Math.ceil(shield)}` : 'A LASER / B SPREAD');
      draw();
    },
    destroy() {
      offDown(); offTap();
      layer.destroy({ children: true });
    },
  };
}

export function createJumpQuest(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const { layer, g, sparks } = makeLayer(ctx);
  const player = { x: W * 0.2, y: H - 120, vx: 0, vy: 0, grounded: false };
  const plats: { x: number; y: number; w: number; moving: boolean; vx: number; spring: boolean }[] = [];
  const gems: { x: number; y: number; hit: boolean }[] = [];
  const enemies: { x: number; y: number; dir: number }[] = [];
  let cam = 0;
  let top = H - 80;
  let score = 0;
  let t = 0;
  let over = false;
  ctx.hud.setScore(0);
  ctx.hud.setLabel('CLIMB');
  for (let y = H - 64; y > -1200; y -= 76) {
    const x = 28 + ctx.rng.next() * (W - 96);
    const moving = ctx.rng.next() < 0.26;
    plats.push({ x, y, w: 62 + ctx.rng.next() * 34, moving, vx: moving ? ctx.rng.pick([-55, 55]) : 0, spring: ctx.rng.next() < 0.16 });
    if (ctx.rng.next() < 0.56) gems.push({ x: x + 20 + ctx.rng.next() * 34, y: y - 22, hit: false });
    if (ctx.rng.next() < 0.18) enemies.push({ x: x + 16, y: y - 20, dir: ctx.rng.pick([-1, 1]) });
  }
  const jump = (): void => {
    if (player.grounded) {
      player.vy = -720;
      player.grounded = false;
      ctx.audio.sfx('jump');
    }
  };
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a' || a === 'up') jump();
  });
  const offTap = ctx.input.on('tap', jump);
  function draw(): void {
    g.clear();
    backdrop(g, W, H, t, H * 0.7);
    for (const p of plats) {
      const y = p.y - cam;
      if (y < -30 || y > H + 30) continue;
      g.roundRect(p.x, y, p.w, 14, 5).fill({ color: p.moving ? CYAN : GREEN });
      g.rect(p.x + 8, y + 3, p.w - 16, 2).fill({ color: WHITE, alpha: 0.26 });
      if (p.spring) g.rect(p.x + p.w / 2 - 10, y - 4, 20, 5).fill({ color: GOLD });
    }
    for (const gem of gems) {
      if (gem.hit) continue;
      const y = gem.y - cam;
      g.moveTo(gem.x, y - 9).lineTo(gem.x + 9, y).lineTo(gem.x, y + 9).lineTo(gem.x - 9, y).closePath().fill({ color: GOLD });
    }
    for (const e of enemies) {
      g.roundRect(e.x - 12, e.y - cam - 10, 24, 20, 5).fill({ color: PINK });
      g.circle(e.x - 5, e.y - cam - 2, 2).fill({ color: WHITE });
      g.circle(e.x + 5, e.y - cam - 2, 2).fill({ color: WHITE });
    }
    const py = player.y - cam;
    g.roundRect(player.x - 12, py - 28, 24, 32, 6).fill({ color: 0x7dd3fc });
    g.roundRect(player.x - 8, py - 22, 16, 12, 4).fill({ color: 0xffd1a8 });
    drawSparks(g, sparks);
  }
  return {
    update(dt) {
      if (over) return;
      t += dt;
      updateSparks(sparks, dt);
      player.vx = ctx.input.axis().x * 235;
      player.vy += 1700 * dt;
      player.x += player.vx * dt;
      if (player.x < -12) player.x = W + 12;
      if (player.x > W + 12) player.x = -12;
      player.y += player.vy * dt;
      player.grounded = false;
      for (const p of plats) {
        if (p.moving) {
          p.x += p.vx * dt;
          if (p.x < 8 || p.x + p.w > W - 8) p.vx *= -1;
        }
        if (player.vy > 0 && player.x > p.x && player.x < p.x + p.w && player.y > p.y - 4 && player.y < p.y + 18) {
          player.y = p.y - 2;
          if (p.spring) {
            player.vy = -860;
            score += 60;
            ctx.audio.sfx('powerup');
            ctx.fx.floatingText('SPRING', player.x, player.y - cam - 24, GOLD);
            burst(sparks, ctx.rng, player.x, player.y - cam, GOLD, 10, 110);
          } else player.vy = 0;
          player.grounded = true;
        }
      }
      for (const gem of gems) {
        if (!gem.hit && Math.hypot(gem.x - player.x, gem.y - (player.y - 18)) < 20) {
          gem.hit = true;
          score += 120;
          ctx.audio.sfx('coin');
          burst(sparks, ctx.rng, gem.x, gem.y - cam, GOLD, 9, 100);
        }
      }
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i]!;
        e.x += e.dir * 35 * dt;
        if (e.x < 18 || e.x > W - 18) e.dir *= -1;
        if (Math.abs(e.x - player.x) < 22 && Math.abs(e.y - player.y) < 26) {
          if (player.vy > 80 && player.y < e.y - 4) {
            enemies.splice(i, 1);
            player.vy = -520;
            score += 220;
            ctx.audio.sfx('explosion');
            ctx.fx.floatingText('+220', e.x, e.y - cam - 18, GOLD);
            burst(sparks, ctx.rng, e.x, e.y - cam, PINK, 13, 110);
          } else {
            over = true;
            ctx.fx.screenShake(8, 0.16);
            ctx.gameOver(score, { height: Math.max(0, Math.round((H - top) / 10)) });
          }
        }
      }
      if (player.y < top) {
        top = player.y;
        score += 1;
      }
      cam += (player.y - H * 0.46 - cam) * Math.min(1, dt * 4);
      if (player.y - cam > H + 40) {
        over = true;
        ctx.gameOver(score);
      }
      ctx.hud.setScore(score);
      draw();
    },
    destroy() {
      offDown(); offTap();
      layer.destroy({ children: true });
    },
  };
}

export function createRetroSnake(ctx: GameContext): Game {
  const { layer, g, sparks } = makeLayer(ctx);
  const W = ctx.width;
  const H = ctx.height;
  const cols = 18;
  const rows = 26;
  const cell = Math.floor(Math.min(W / cols, (H - 20) / rows));
  const ox = (W - cols * cell) / 2;
  const oy = (H - rows * cell) / 2;
  const snake = [{ x: 8, y: 13 }, { x: 7, y: 13 }, { x: 6, y: 13 }];
  let dir = { x: 1, y: 0 };
  let next = dir;
  let food = { x: 13, y: 13 };
  let bonusFood: { x: number; y: number; t: number } | null = null;
  let eaten = 0;
  let score = 0;
  let tick = 0;
  let over = false;
  let wrapPulse = 0;
  let t = 0;
  ctx.hud.setScore(0);
  ctx.hud.setLabel('WRAP + BONUS');
  const placeFood = (): void => {
    do {
      food = { x: ctx.rng.int(0, cols - 1), y: ctx.rng.int(0, rows - 1) };
    } while (snake.some((s) => s.x === food.x && s.y === food.y));
  };
  const placeBonus = (): void => {
    do {
      bonusFood = { x: ctx.rng.int(0, cols - 1), y: ctx.rng.int(0, rows - 1), t: 6 };
    } while (
      snake.some((s) => s.x === bonusFood!.x && s.y === bonusFood!.y)
      || (food.x === bonusFood!.x && food.y === bonusFood!.y)
    );
    ctx.hud.toast('BONUS FRUIT');
  };
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'left' && dir.x !== 1) next = { x: -1, y: 0 };
    if (a === 'right' && dir.x !== -1) next = { x: 1, y: 0 };
    if (a === 'up' && dir.y !== 1) next = { x: 0, y: -1 };
    if (a === 'down' && dir.y !== -1) next = { x: 0, y: 1 };
  });
  const offSwipe = ctx.input.on('swipe', (d) => {
    if (d === 'left' && dir.x !== 1) next = { x: -1, y: 0 };
    if (d === 'right' && dir.x !== -1) next = { x: 1, y: 0 };
    if (d === 'up' && dir.y !== 1) next = { x: 0, y: -1 };
    if (d === 'down' && dir.y !== -1) next = { x: 0, y: 1 };
  });
  function draw(): void {
    g.clear();
    backdrop(g, W, H, t, H * 0.76);
    g.roundRect(ox - 6, oy - 6, cols * cell + 12, rows * cell + 12, 10).fill({ color: 0x07190f, alpha: 0.94 }).stroke({ width: wrapPulse > 0 ? 4 : 2, color: wrapPulse > 0 ? CYAN : GREEN, alpha: wrapPulse > 0 ? 0.8 : 0.4 });
    for (let x = 0; x <= cols; x++) g.rect(ox + x * cell, oy, 1, rows * cell).fill({ color: GREEN, alpha: 0.07 });
    for (let y = 0; y <= rows; y++) g.rect(ox, oy + y * cell, cols * cell, 1).fill({ color: GREEN, alpha: 0.07 });
    g.circle(ox + food.x * cell + cell / 2, oy + food.y * cell + cell / 2, cell * 0.38).fill({ color: PINK });
    if (bonusFood) {
      const p = 0.75 + Math.sin(t * 10) * 0.12;
      g.roundRect(ox + bonusFood.x * cell + cell * (0.5 - p / 2), oy + bonusFood.y * cell + cell * (0.5 - p / 2), cell * p, cell * p, 5).fill({ color: GOLD });
    }
    snake.forEach((s, i) => {
      g.roundRect(ox + s.x * cell + 1, oy + s.y * cell + 1, cell - 2, cell - 2, 4).fill({ color: i === 0 ? GOLD : GREEN, alpha: 0.92 });
    });
    drawSparks(g, sparks);
  }
  return {
    update(dt) {
      if (over) return;
      t += dt;
      updateSparks(sparks, dt);
      wrapPulse = Math.max(0, wrapPulse - dt);
      if (bonusFood) {
        bonusFood.t -= dt;
        if (bonusFood.t <= 0) bonusFood = null;
      }
      tick += dt;
      if (tick >= Math.max(0.07, 0.15 - snake.length * 0.002)) {
        tick = 0;
        dir = next;
        const raw = { x: snake[0]!.x + dir.x, y: snake[0]!.y + dir.y };
        const head = { x: (raw.x + cols) % cols, y: (raw.y + rows) % rows };
        if (raw.x !== head.x || raw.y !== head.y) {
          wrapPulse = 0.4;
          score += 12;
          ctx.fx.floatingText('WRAP', ox + head.x * cell + cell / 2, oy + head.y * cell, CYAN);
        }
        if (snake.some((s) => s.x === head.x && s.y === head.y)) {
          over = true;
          ctx.gameOver(score, { length: snake.length });
          return;
        }
        snake.unshift(head);
        const ateBonus = bonusFood && head.x === bonusFood.x && head.y === bonusFood.y;
        if (head.x === food.x && head.y === food.y) {
          eaten++;
          score += 100 + snake.length * 2;
          ctx.audio.sfx('coin');
          burst(sparks, ctx.rng, ox + food.x * cell + cell / 2, oy + food.y * cell + cell / 2, PINK, 12, 90);
          placeFood();
          if (eaten % 4 === 0) placeBonus();
        } else if (ateBonus) {
          score += 450;
          bonusFood = null;
          ctx.audio.sfx('powerup');
          ctx.fx.floatingText('+450', ox + head.x * cell + cell / 2, oy + head.y * cell, GOLD);
          snake.pop();
        } else snake.pop();
        ctx.hud.setScore(score);
        ctx.hud.setLabel(bonusFood ? `BONUS ${Math.ceil(bonusFood.t)}` : 'WRAP + BONUS');
        draw();
      }
    },
    destroy() {
      offDown(); offSwipe();
      layer.destroy({ children: true });
    },
  };
}

export function createDotCollector(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const { layer, g, sparks } = makeLayer(ctx);
  const cols = 15;
  const rows = 21;
  const cell = Math.floor(Math.min(W / cols, (H - 30) / rows));
  const ox = (W - cols * cell) / 2;
  const oy = (H - rows * cell) / 2;
  const walls = new Set<string>();
  const dots = new Set<string>();
  const powers = new Set<string>();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const wall = x === 0 || y === 0 || x === cols - 1 || y === rows - 1 || (x % 4 === 0 && y % 4 !== 2) || (y % 5 === 0 && x % 5 !== 2);
      if (wall) walls.add(`${x},${y}`);
      else dots.add(`${x},${y}`);
    }
  }
  let player = { x: 1, y: 1 };
  const foes = [{ x: cols - 2, y: rows - 2, phase: 0 }, { x: cols - 2, y: 1, phase: 2.1 }];
  dots.delete('1,1');
  for (const key of [`1,${rows - 2}`, `${cols - 2},1`, `${cols - 2},${rows - 2}`]) {
    powers.add(key);
    dots.delete(key);
  }
  let score = 0;
  let lives = 3;
  let power = 0;
  let tick = 0;
  let t = 0;
  let over = false;
  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('DOTS');
  const can = (x: number, y: number): boolean => !walls.has(`${x},${y}`);
  function draw(): void {
    g.clear();
    backdrop(g, W, H, t, H * 0.78);
    g.roundRect(ox - 5, oy - 5, cols * cell + 10, rows * cell + 10, 9).fill({ color: 0x05070f, alpha: 0.94 }).stroke({ width: 2, color: CYAN, alpha: 0.35 });
    for (const key of walls) {
      const [x, y] = key.split(',').map(Number);
      g.roundRect(ox + x! * cell + 1, oy + y! * cell + 1, cell - 2, cell - 2, 3).fill({ color: 0x123b6d });
    }
    for (const key of dots) {
      const [x, y] = key.split(',').map(Number);
      g.circle(ox + x! * cell + cell / 2, oy + y! * cell + cell / 2, 2.4).fill({ color: GOLD });
    }
    for (const key of powers) {
      const [x, y] = key.split(',').map(Number);
      const pulse = 1 + Math.sin(t * 8 + x!) * 0.18;
      g.circle(ox + x! * cell + cell / 2, oy + y! * cell + cell / 2, cell * 0.24 * pulse).fill({ color: power > 0 ? CYAN : VIOLET });
    }
    g.circle(ox + player.x * cell + cell / 2, oy + player.y * cell + cell / 2, cell * 0.38).fill({ color: 0xffeb3b });
    for (const f of foes) {
      g.roundRect(ox + f.x * cell + 2, oy + f.y * cell + 2, cell - 4, cell - 4, 6).fill({ color: power > 0 ? CYAN : PINK });
    }
    drawSparks(g, sparks);
  }
  return {
    update(dt) {
      if (over) return;
      t += dt;
      updateSparks(sparks, dt);
      power = Math.max(0, power - dt);
      tick += dt;
      if (tick > 0.14) {
        tick = 0;
        const a = ctx.input.axis();
        const nx = player.x + Math.sign(a.x);
        const ny = player.y + Math.sign(a.y);
        if ((a.x || a.y) && can(nx, ny)) player = { x: nx, y: ny };
        const k = `${player.x},${player.y}`;
        if (dots.delete(k)) {
          score += 20;
          ctx.audio.sfx('coin');
        }
        if (powers.delete(k)) {
          power = 6;
          score += 120;
          ctx.audio.sfx('powerup');
          ctx.hud.toast('POWER MODE');
          burst(sparks, ctx.rng, ox + player.x * cell + cell / 2, oy + player.y * cell + cell / 2, VIOLET, 16, 120);
        }
        for (const f of foes) {
          const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => can(f.x + dx!, f.y + dy!));
          opts.sort((aa, bb) => Math.hypot(player.x - (f.x + aa[0]!), player.y - (f.y + aa[1]!)) - Math.hypot(player.x - (f.x + bb[0]!), player.y - (f.y + bb[1]!)));
          const pick = opts[Math.min(opts.length - 1, ctx.rng.next() < 0.7 ? 0 : ctx.rng.int(0, opts.length - 1))]!;
          f.x += pick[0]!;
          f.y += pick[1]!;
          if (f.x === player.x && f.y === player.y) {
            if (power > 0) {
              score += 260;
              ctx.audio.sfx('explosion');
              ctx.fx.floatingText('+260', ox + f.x * cell + cell / 2, oy + f.y * cell, CYAN);
              f.x = cols - 2;
              f.y = f.phase > 1 ? 1 : rows - 2;
            } else {
              lives--;
              ctx.hud.setLives(lives);
              ctx.fx.screenShake(7, 0.16);
              player = { x: 1, y: 1 };
              if (lives <= 0) {
                over = true;
                ctx.gameOver(score);
              }
            }
          }
        }
        if (!dots.size) {
          over = true;
          ctx.gameOver(score + 1000);
        }
        ctx.hud.setScore(score);
        ctx.hud.setLabel(power > 0 ? `POWER ${Math.ceil(power)}` : `DOTS ${dots.size}`);
        draw();
      }
    },
    destroy() {
      layer.destroy({ children: true });
    },
  };
}

export function createMemoryMatch(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const { layer, g, sparks } = makeLayer(ctx);
  const cols = 4;
  const rows = 4;
  const size = Math.min(W - 34, H - 90);
  const card = size / cols;
  const ox = (W - size) / 2;
  const oy = 78;
  const vals = [...Array(8).keys(), ...Array(8).keys()].sort(() => ctx.rng.next() - 0.5);
  const open = new Set<number>();
  const found = new Set<number>();
  let first: number | null = null;
  let lock = 0;
  let moves = 0;
  let score = 1200;
  let streak = 0;
  let peek = 0;
  let t = 0;
  let complete = false;
  ctx.hud.setScore(score);
  ctx.hud.setLabel('MATCH');
  const colors = [PINK, CYAN, GOLD, GREEN, VIOLET, BLUE, 0xff7b00, 0xffffff];
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'b' && peek <= 0 && score >= 100) {
      peek = 0.7;
      score = Math.max(0, score - 100);
      ctx.hud.setScore(score);
      ctx.hud.toast('PEEK -100');
      ctx.audio.sfx('powerup');
      draw();
    }
  });
  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (lock > 0) return;
    const c = Math.floor((x - ox) / card);
    const r = Math.floor((y - oy) / card);
    const i = r * cols + c;
    if (c < 0 || r < 0 || c >= cols || r >= rows || open.has(i) || found.has(i)) return;
    open.add(i);
    if (first === null) first = i;
    else {
      moves++;
      if (vals[first] === vals[i]) {
        found.add(first);
        found.add(i);
        first = null;
        streak++;
        score += 180 + streak * 45;
        ctx.audio.sfx('coin');
        ctx.fx.floatingText(`x${streak}`, ox + (i % cols) * card + card / 2, oy + Math.floor(i / cols) * card, GOLD);
      } else {
        streak = 0;
        lock = 0.72;
        score = Math.max(0, score - 35);
      }
      ctx.hud.setScore(score);
      ctx.hud.setLabel(streak > 1 ? `STREAK x${streak}` : 'MATCH');
    }
    draw();
  });
  function draw(): void {
    g.clear();
    backdrop(g, W, H, t, H * 0.76);
    for (let i = 0; i < vals.length; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = ox + c * card;
      const y = oy + r * card;
      const face = open.has(i) || found.has(i) || peek > 0;
      g.roundRect(x + 5, y + 5, card - 10, card - 10, 9).fill({ color: face ? colors[vals[i]!]! : 0x14141f }).stroke({ width: 2, color: face ? WHITE : CYAN, alpha: 0.34 });
      if (face) {
        g.circle(x + card / 2, y + card / 2, card * 0.18).fill({ color: WHITE, alpha: 0.35 });
        g.rect(x + card * 0.34, y + card * 0.34, card * 0.32, card * 0.32).fill({ color: 0x050511, alpha: 0.18 });
      } else {
        g.rect(x + card * 0.36, y + card * 0.36, card * 0.28, card * 0.28).stroke({ width: 2, color: PINK, alpha: 0.6 });
      }
    }
    drawSparks(g, sparks);
  }
  draw();
  return {
    update(dt) {
      t += dt;
      updateSparks(sparks, dt);
      if (peek > 0) {
        peek -= dt;
        if (peek <= 0) draw();
      }
      if (lock > 0) {
        lock -= dt;
        if (lock <= 0) {
          open.clear();
          for (const i of found) open.add(i);
          first = null;
          draw();
        }
      }
      if (!complete && found.size === vals.length) {
        complete = true;
        ctx.hud.toast('PERFECT MATCH!');
        ctx.gameOver(score, { moves, streak });
      }
    },
    destroy() {
      offDown();
      offTap();
      layer.destroy({ children: true });
    },
  };
}

export function createBrickBreaker(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const { layer, g, sparks } = makeLayer(ctx);
  const paddle = { x: W / 2, y: H - 54, w: 76 };
  const ball = { x: W / 2, y: H - 82, vx: 180, vy: -285, r: 6 };
  const bricks: { x: number; y: number; w: number; h: number; hp: number; color: number }[] = [];
  let score = 0;
  let lives = 3;
  let cleared = 0;
  let hot = 0;
  let t = 0;
  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('BREAK');
  const colors = [PINK, GOLD, GREEN, CYAN, VIOLET];
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 8; c++) bricks.push({ x: 18 + c * 40, y: 62 + r * 24, w: 34, h: 15, hp: r < 2 ? 2 : 1, color: colors[r % colors.length]! });
  }
  const offPtr = ctx.input.on('pointermove', ({ x }) => { paddle.x = clamp(x, paddle.w / 2, W - paddle.w / 2); });
  function draw(): void {
    g.clear();
    backdrop(g, W, H, t, H * 0.72);
    for (const b of bricks) {
      g.roundRect(b.x, b.y, b.w, b.h, 4).fill({ color: b.color, alpha: b.hp === 2 ? 0.92 : 0.75 }).stroke({ width: 1, color: WHITE, alpha: 0.22 });
    }
    g.roundRect(paddle.x - paddle.w / 2, paddle.y, paddle.w, 12, 6).fill({ color: CYAN });
    g.circle(ball.x, ball.y, ball.r + (hot > 0 ? 2 : 0)).fill({ color: hot > 0 ? GOLD : WHITE });
    drawSparks(g, sparks);
  }
  return {
    update(dt) {
      t += dt;
      updateSparks(sparks, dt);
      hot = Math.max(0, hot - dt);
      const ax = ctx.input.axis().x;
      if (ax) paddle.x = clamp(paddle.x + ax * 330 * dt, paddle.w / 2, W - paddle.w / 2);
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.x < ball.r || ball.x > W - ball.r) ball.vx *= -1;
      if (ball.y < ball.r) ball.vy = Math.abs(ball.vy);
      if (boxHit(ball.x - ball.r, ball.y - ball.r, ball.r * 2, ball.r * 2, paddle.x - paddle.w / 2, paddle.y, paddle.w, 14) && ball.vy > 0) {
        ball.vy = -Math.abs(ball.vy) * 1.02;
        ball.vx += (ball.x - paddle.x) * 4;
        ctx.audio.sfx('blip');
      }
      for (let i = bricks.length - 1; i >= 0; i--) {
        const b = bricks[i]!;
        if (boxHit(ball.x - ball.r, ball.y - ball.r, ball.r * 2, ball.r * 2, b.x, b.y, b.w, b.h)) {
          ball.vy *= -1;
          b.hp -= hot > 0 ? 2 : 1;
          if (b.hp <= 0) {
            bricks.splice(i, 1);
            cleared++;
            score += hot > 0 ? 120 : 80;
            burst(sparks, ctx.rng, b.x + b.w / 2, b.y + b.h / 2, b.color, 9, 90);
            ctx.audio.sfx('coin');
            if (cleared % 6 === 0) {
              paddle.w = Math.min(122, paddle.w + 10);
              ctx.hud.toast('PADDLE WIDE');
              ctx.hud.setLabel(`WIDE ${paddle.w}`);
            }
            if (cleared % 10 === 0) {
              hot = 5;
              ctx.hud.toast('HOT BALL');
            }
          } else ctx.audio.sfx('hit');
          break;
        }
      }
      if (ball.y > H + 20) {
        lives--;
        ctx.hud.setLives(lives);
        ball.x = paddle.x;
        ball.y = H - 82;
        ball.vx = ctx.rng.pick([-190, 190]);
        ball.vy = -285;
        if (lives <= 0) ctx.gameOver(score);
      }
      if (!bricks.length) ctx.gameOver(score + 1000);
      ctx.hud.setScore(score);
      if (hot > 0) ctx.hud.setLabel(`HOT ${Math.ceil(hot)}`);
      draw();
    },
    destroy() {
      offPtr();
      layer.destroy({ children: true });
    },
  };
}

export function createTurboDrift(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const { layer, g, sparks } = makeLayer(ctx);
  const car = { x: W / 2, y: H - 100, vx: 0, angle: 0 };
  const gates: { x: number; y: number; w: number; hit: boolean }[] = [];
  let score = 0;
  let lives = 3;
  let nitro = 0;
  let spawn = 0;
  let t = 0;
  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('HOLD A NITRO');
  const spawnGate = (): void => {
    gates.push({ x: 54 + ctx.rng.next() * (W - 108), y: -30, w: 82 - Math.min(34, score / 600), hit: false });
  };
  function draw(): void {
    g.clear();
    backdrop(g, W, H, t, H * 0.38);
    g.moveTo(W * 0.38, H * 0.28).lineTo(W * 0.62, H * 0.28).lineTo(W - 24, H - 48).lineTo(24, H - 48).closePath().fill({ color: 0x090a18, alpha: 0.92 });
    for (const gate of gates) {
      g.roundRect(gate.x - gate.w / 2, gate.y, gate.w, 12, 6).fill({ color: gate.hit ? GREEN : GOLD });
      g.circle(gate.x - gate.w / 2, gate.y + 6, 7).fill({ color: CYAN });
      g.circle(gate.x + gate.w / 2, gate.y + 6, 7).fill({ color: CYAN });
    }
    g.roundRect(car.x - 16, car.y - 24, 32, 48, 8).fill({ color: nitro > 0 ? GOLD : GREEN });
    g.rect(car.x - 9, car.y - 15, 18, 20).fill({ color: 0x06140b, alpha: 0.7 });
    if (nitro > 0) g.rect(car.x - 10, car.y + 26, 20, 42).fill({ color: GOLD, alpha: 0.28 });
    drawSparks(g, sparks);
  }
  return {
    update(dt) {
      t += dt;
      updateSparks(sparks, dt);
      const ax = ctx.input.axis().x;
      nitro = (ctx.input.isDown('a') || ctx.input.isDown('up')) ? Math.min(1.4, nitro + dt * 3) : Math.max(0, nitro - dt * 1.8);
      car.vx += ax * (680 + nitro * 260) * dt;
      car.vx *= nitro > 0 ? 0.9 : 0.92;
      car.x = clamp(car.x + car.vx * dt, 34, W - 34);
      spawn -= dt;
      if (spawn <= 0) {
        spawn = Math.max(0.42, 0.85 - score / 13000);
        spawnGate();
      }
      for (let i = gates.length - 1; i >= 0; i--) {
        const gate = gates[i]!;
        gate.y += (175 + score * 0.018) * dt;
        if (!gate.hit && gate.y > car.y - 18) {
          gate.hit = true;
          if (Math.abs(car.x - gate.x) < gate.w / 2) {
            const perfect = Math.abs(car.x - gate.x) < Math.max(8, gate.w * 0.12);
            const pts = 120 + Math.round(Math.abs(car.vx) * 0.25) + (nitro > 0.5 ? 80 : 0) + (perfect ? 140 : 0);
            score += pts;
            ctx.fx.floatingText(perfect ? `PERFECT +${pts}` : nitro > 0.5 ? `NITRO +${pts}` : `+${pts}`, car.x, car.y - 32, perfect ? CYAN : GOLD);
            if (perfect) ctx.hud.toast('PERFECT GATE');
            ctx.audio.sfx('coin');
            burst(sparks, ctx.rng, car.x, car.y, GREEN, 12, 120);
          } else {
            lives--;
            ctx.hud.setLives(lives);
            ctx.fx.screenShake(5, 0.12);
            if (lives <= 0) ctx.gameOver(score);
          }
        }
        if (gate.y > H + 30) gates.splice(i, 1);
      }
      ctx.hud.setScore(score);
      ctx.hud.setLabel(nitro > 0.5 ? 'NITRO DRIFT' : 'HOLD A NITRO');
      draw();
    },
    destroy() {
      layer.destroy({ children: true });
    },
  };
}

export function createColorSwitch(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const { layer, g, sparks } = makeLayer(ctx);
  const colors = [PINK, GOLD, CYAN, GREEN];
  let color = 0;
  let angle = -Math.PI / 2;
  let score = 0;
  let lives = 3;
  let combo = 0;
  let t = 0;
  const rings: { y: number; rot: number; speed: number; passed: boolean }[] = [{ y: 160, rot: 0, speed: 1.1, passed: false }];
  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('A NEXT / B BACK');
  const switchColor = (dir = 1): void => {
    color = (color + dir + colors.length) % colors.length;
    ctx.audio.sfx('blip');
  };
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a' || a === 'up') switchColor();
    if (a === 'b' || a === 'down') switchColor(-1);
  });
  const offTap = ctx.input.on('tap', () => switchColor());
  function draw(): void {
    g.clear();
    backdrop(g, W, H, t, H * 0.72);
    for (const ring of rings) {
      const r = 58;
      for (let i = 0; i < 4; i++) {
        const a0 = ring.rot + i * Math.PI / 2;
        const a1 = a0 + Math.PI / 2 - 0.12;
        g.arc(W / 2, ring.y, r, a0, a1).stroke({ width: 13, color: colors[i]!, alpha: 0.9 });
      }
      g.circle(W / 2, ring.y, 5).fill({ color: WHITE, alpha: 0.22 });
    }
    const px = W / 2 + Math.cos(angle) * 94;
    const py = H - 86 + Math.sin(angle) * 28;
    g.circle(px, py, 16).fill({ color: colors[color]! });
    g.circle(px, py, 7).fill({ color: WHITE, alpha: 0.35 });
    drawSparks(g, sparks);
  }
  return {
    update(dt) {
      t += dt;
      updateSparks(sparks, dt);
      angle += dt * 2.2;
      for (const ring of rings) {
        ring.y += (78 + score * 0.01) * dt;
        ring.rot += ring.speed * dt;
        if (!ring.passed && ring.y > H - 88) {
          ring.passed = true;
          const seg = (((Math.floor((((Math.PI / 2 - ring.rot) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 2)))) % 4);
          if (seg === color) {
            combo++;
            const pts = 160 + combo * 35;
            score += pts;
            ctx.audio.sfx('coin');
            if (combo >= 3) ctx.fx.floatingText(`CHAIN x${combo}`, W / 2, H - 122, colors[color]!);
            burst(sparks, ctx.rng, W / 2, H - 86, colors[color]!, 15, 120);
          } else {
            combo = 0;
            lives--;
            ctx.hud.setLives(lives);
            ctx.fx.screenShake(7, 0.15);
            if (lives <= 0) ctx.gameOver(score);
          }
        }
      }
      if (rings[rings.length - 1]!.y > 250) rings.push({ y: -30, rot: ctx.rng.next() * Math.PI * 2, speed: ctx.rng.pick([-1.4, -1, 1, 1.4]), passed: false });
      while (rings[0] && rings[0].y > H + 90) rings.shift();
      ctx.hud.setScore(score);
      ctx.hud.setLabel(combo >= 3 ? `CHAIN x${combo}` : 'A NEXT / B BACK');
      draw();
    },
    destroy() {
      offDown(); offTap();
      layer.destroy({ children: true });
    },
  };
}

export function createGalacticInvaders(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const { layer, g, sparks } = makeLayer(ctx);
  const player = { x: W / 2, y: H - 42 };
  const invaders: { x: number; y: number; row: number; alive: boolean }[] = [];
  const shots: { x: number; y: number; enemy: boolean }[] = [];
  const barriers: { x: number; y: number; hp: number }[] = [];
  let ufo: { x: number; y: number; dir: number; worth: number } | null = null;
  let dir = 1;
  let step = 0;
  let fireCd = 0;
  let ufoCd = 5;
  let score = 0;
  let lives = 3;
  let wave = 1;
  let t = 0;
  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('WAVE 1');
  const build = (): void => {
    invaders.length = 0;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) invaders.push({ x: 32 + c * 38, y: 70 + r * 30, row: r, alive: true });
    barriers.length = 0;
    for (let i = 0; i < 3; i++) barriers.push({ x: W * (0.25 + i * 0.25), y: H - 118, hp: 5 + wave });
  };
  build();
  const shoot = (): void => {
    if (fireCd > 0) return;
    fireCd = 0.22;
    shots.push({ x: player.x, y: player.y - 12, enemy: false });
    ctx.audio.sfx('shoot');
  };
  const offDown = ctx.input.on('down', (a) => { if (a === 'a') shoot(); });
  const offTap = ctx.input.on('tap', shoot);
  function draw(): void {
    g.clear();
    backdrop(g, W, H, t, H * 0.72);
    for (const inv of invaders) {
      if (!inv.alive) continue;
      const color = inv.row < 1 ? PINK : inv.row < 3 ? CYAN : GREEN;
      g.roundRect(inv.x - 13, inv.y - 9, 26, 18, 4).fill({ color });
      g.rect(inv.x - 18, inv.y - 2, 36, 5).fill({ color, alpha: 0.65 });
      g.circle(inv.x - 6, inv.y - 1, 2).fill({ color: 0x050511 });
      g.circle(inv.x + 6, inv.y - 1, 2).fill({ color: 0x050511 });
    }
    if (ufo) {
      g.roundRect(ufo.x - 24, ufo.y - 8, 48, 16, 8).fill({ color: GOLD });
      g.circle(ufo.x, ufo.y - 10, 10).fill({ color: PINK });
      g.rect(ufo.x - 15, ufo.y + 6, 30, 3).fill({ color: CYAN, alpha: 0.75 });
    }
    for (const s of shots) g.rect(s.x - 2, s.y - 8, 4, 14).fill({ color: s.enemy ? PINK : WHITE });
    for (const b of barriers) {
      const alpha = Math.max(0.25, b.hp / (5 + wave));
      g.roundRect(b.x - 28, b.y - 10, 56, 20, 6).fill({ color: GREEN, alpha });
      g.rect(b.x - 14, b.y - 18, 28, 8).fill({ color: GREEN, alpha });
    }
    g.roundRect(player.x - 20, player.y, 40, 14, 4).fill({ color: CYAN });
    g.rect(player.x - 3, player.y - 8, 6, 8).fill({ color: CYAN });
    drawSparks(g, sparks);
  }
  return {
    update(dt) {
      t += dt;
      updateSparks(sparks, dt);
      fireCd = Math.max(0, fireCd - dt);
      ufoCd -= dt;
      if (!ufo && ufoCd <= 0) {
        const dirPick = ctx.rng.pick([-1, 1]);
        ufo = { x: dirPick > 0 ? -32 : W + 32, y: 44, dir: dirPick, worth: ctx.rng.pick([200, 300, 500]) };
        ufoCd = 9 + ctx.rng.next() * 5;
        ctx.audio.sfx('blip');
      }
      if (ufo) {
        ufo.x += ufo.dir * (110 + wave * 10) * dt;
        if (ufo.x < -46 || ufo.x > W + 46) ufo = null;
      }
      player.x = clamp(player.x + ctx.input.axis().x * 260 * dt, 24, W - 24);
      if (ctx.input.isDown('a')) shoot();
      step += dt;
      const alive = invaders.filter((i) => i.alive);
      if (step > Math.max(0.08, 0.52 * alive.length / invaders.length)) {
        step = 0;
        let edge = false;
        for (const inv of alive) if ((dir > 0 && inv.x > W - 28) || (dir < 0 && inv.x < 28)) edge = true;
        if (edge) {
          dir *= -1;
          for (const inv of alive) inv.y += 18;
        } else for (const inv of alive) inv.x += dir * 14;
        if (alive.some((inv) => inv.y > H - 78)) ctx.gameOver(score, { wave });
        const shooter = ctx.rng.pick(alive);
        if (shooter && ctx.rng.next() < 0.45) shots.push({ x: shooter.x, y: shooter.y + 12, enemy: true });
      }
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i]!;
        s.y += (s.enemy ? 260 : -460) * dt;
        if (s.y < -20 || s.y > H + 20) {
          shots.splice(i, 1);
          continue;
        }
        let blocked = false;
        for (let bi = barriers.length - 1; bi >= 0; bi--) {
          const b = barriers[bi]!;
          if (Math.abs(s.x - b.x) < 32 && Math.abs(s.y - b.y) < 24) {
            shots.splice(i, 1);
            b.hp--;
            blocked = true;
            burst(sparks, ctx.rng, s.x, s.y, GREEN, 5, 60);
            if (b.hp <= 0) barriers.splice(bi, 1);
            break;
          }
        }
        if (blocked) continue;
        if (s.enemy && Math.abs(s.x - player.x) < 22 && s.y > player.y - 8) {
          shots.splice(i, 1);
          lives--;
          ctx.hud.setLives(lives);
          ctx.fx.screenShake(6, 0.12);
          if (lives <= 0) ctx.gameOver(score, { wave });
        } else if (!s.enemy) {
          if (ufo && Math.abs(s.x - ufo.x) < 27 && Math.abs(s.y - ufo.y) < 18) {
            shots.splice(i, 1);
            score += ufo.worth;
            ctx.hud.toast(`UFO +${ufo.worth}`);
            ctx.audio.sfx('explosion');
            burst(sparks, ctx.rng, ufo.x, ufo.y, GOLD, 18, 150);
            ufo = null;
            continue;
          }
          for (const inv of invaders) {
            if (inv.alive && Math.abs(s.x - inv.x) < 17 && Math.abs(s.y - inv.y) < 16) {
              inv.alive = false;
              shots.splice(i, 1);
              score += (5 - inv.row) * 20;
              ctx.audio.sfx('explosion');
              burst(sparks, ctx.rng, inv.x, inv.y, inv.row < 2 ? PINK : CYAN, 10, 90);
              break;
            }
          }
        }
      }
      if (!invaders.some((i) => i.alive)) {
        wave++;
        ctx.hud.setLabel(`WAVE ${wave}`);
        build();
      }
      ctx.hud.setScore(score);
      ctx.hud.setLabel(ufo ? 'BONUS UFO' : `WAVE ${wave}`);
      draw();
    },
    destroy() {
      offDown(); offTap();
      layer.destroy({ children: true });
    },
  };
}
