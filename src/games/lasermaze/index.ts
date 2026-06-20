import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import type { Action } from '@core/InputManager';
import { idx } from '@kits/grid/core';
import { burst, drawBackdrop, drawSparks, type Spark, updateSparks } from '@games/_shared/juice';

const COLS = 7;
const ROWS = 9;

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const cell = Math.floor(Math.min((W - 34) / COLS, (H - 128) / ROWS));
  const ox = (W - cell * COLS) / 2;
  const oy = 82;
  const layer = new Container();
  const g = new Graphics();
  layer.addChild(g);
  ctx.stage.addChild(layer);

  const walls = new Set<number>();
  const gems = new Set<number>(); // Feature: collectible gems
  const sparks: Spark[] = [];
  let player = { c: 0, r: ROWS - 1 };
  let key = { c: 3, r: 4 };
  let exit = { c: COLS - 1, r: 0 };
  let orb: { c: number; r: number } | null = null; // Feature: freeze pickup
  let freeze = 0;
  let levelTimer = 0; // Feature: per-vault time bonus
  let level = 1;
  let score = 0;
  let lives = 3;
  let hasKey = false;
  let t = 0;
  let over = false;

  ctx.hud.setScore(score);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('GET KEY');

  const makeLevel = (): void => {
    walls.clear();
    player = { c: 0, r: ROWS - 1 };
    key = { c: ctx.rng.int(2, COLS - 2), r: ctx.rng.int(2, ROWS - 3) };
    exit = { c: COLS - 1, r: 0 };
    hasKey = false;
    levelTimer = 0;
    gems.clear();
    orb = null;
    for (let i = 0; i < 10 + level; i++) {
      const c = ctx.rng.int(0, COLS - 1);
      const r = ctx.rng.int(0, ROWS - 1);
      if ((c === player.c && r === player.r) || (c === exit.c && r === exit.r) || (c === key.c && r === key.r)) continue;
      walls.add(idx(COLS, c, r));
    }
    const freeCell = (): number => {
      for (let tries = 0; tries < 40; tries++) {
        const c = ctx.rng.int(0, COLS - 1);
        const r = ctx.rng.int(0, ROWS - 1);
        const i = idx(COLS, c, r);
        if (!walls.has(i) && !(c === key.c && r === key.r) && !(c === player.c && r === player.r) && !gems.has(i)) return i;
      }
      return -1;
    };
    for (let i = 0; i < 2 + (level % 2); i++) { const gi = freeCell(); if (gi >= 0) gems.add(gi); }
    const oi = freeCell();
    if (oi >= 0) orb = { c: oi % COLS, r: Math.floor(oi / COLS) };
  };
  makeLevel();

  const beamHits = (c: number, r: number): boolean => {
    const phase = (Math.floor(t * (1.1 + level * 0.08)) + level) % 4;
    return r === phase + 2 || c === (phase * 2 + level) % COLS;
  };

  const move = (dc: number, dr: number): void => {
    if (over) return;
    const nc = player.c + dc;
    const nr = player.r + dr;
    if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS || walls.has(idx(COLS, nc, nr))) {
      ctx.audio.sfx('hit');
      return;
    }
    player = { c: nc, r: nr };
    ctx.audio.sfx('blip');
    const pi = idx(COLS, nc, nr);
    if (gems.delete(pi)) {
      score += 80;
      ctx.hud.setScore(score);
      burst(sparks, ctx.rng, ox + nc * cell + cell / 2, oy + nr * cell + cell / 2, 0x3ddc84, 8);
      ctx.audio.sfx('coin');
    }
    if (orb && nc === orb.c && nr === orb.r) {
      freeze = 4;
      orb = null;
      ctx.hud.toast('BEAMS FROZEN');
      ctx.audio.sfx('powerup');
      burst(sparks, ctx.rng, ox + nc * cell + cell / 2, oy + nr * cell + cell / 2, 0x00f7ff, 14);
    }
    if (player.c === key.c && player.r === key.r) {
      hasKey = true;
      score += 150;
      ctx.hud.setScore(score);
      ctx.hud.setLabel('EXIT OPEN');
      burst(sparks, ctx.rng, ox + nc * cell + cell / 2, oy + nr * cell + cell / 2, 0xffd200, 18);
      ctx.audio.sfx('coin');
    }
    if (hasKey && player.c === exit.c && player.r === exit.r) {
      const timeBonus = Math.max(0, 250 - Math.floor(levelTimer) * 6); // Feature: faster = bigger bonus
      score += 500 + level * 80 + timeBonus;
      level++;
      ctx.hud.setScore(score);
      ctx.hud.toast(`VAULT CLEAR +${timeBonus}`);
      ctx.hud.setLabel(`VAULT ${level}`);
      ctx.audio.sfx('powerup');
      makeLevel();
    }
  };

  const offDown = ctx.input.on('down', (a: Action) => {
    if (a === 'left') move(-1, 0);
    else if (a === 'right') move(1, 0);
    else if (a === 'up') move(0, -1);
    else if (a === 'down') move(0, 1);
  });

  function draw(): void {
    g.clear();
    drawBackdrop(g, W, H, t, 0x182d4c, 0x050611);
    g.roundRect(ox - 6, oy - 6, COLS * cell + 12, ROWS * cell + 12, 12).fill({ color: 0x080b18, alpha: 0.88 });
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = ox + c * cell;
        const y = oy + r * cell;
        g.roundRect(x + 2, y + 2, cell - 4, cell - 4, 5).fill({ color: walls.has(idx(COLS, c, r)) ? 0x29324d : 0x10162a });
      }
    }
    const beamAlpha = freeze > 0 ? 0.14 : 1;
    for (let r = 0; r < ROWS; r++) if (beamHits(0, r)) g.rect(ox, oy + r * cell + cell * 0.42, COLS * cell, cell * 0.16).fill({ color: 0xff2d75, alpha: 0.68 * beamAlpha });
    for (let c = 0; c < COLS; c++) if (beamHits(c, 0)) g.rect(ox + c * cell + cell * 0.42, oy, cell * 0.16, ROWS * cell).fill({ color: 0x00f7ff, alpha: 0.52 * beamAlpha });
    for (const gi of gems) {
      const gx = ox + (gi % COLS) * cell + cell / 2;
      const gy = oy + Math.floor(gi / COLS) * cell + cell / 2;
      g.poly([gx, gy - cell * 0.18, gx + cell * 0.16, gy, gx, gy + cell * 0.18, gx - cell * 0.16, gy]).fill({ color: 0x3ddc84 });
    }
    if (orb) {
      const oxp = ox + orb.c * cell + cell / 2;
      const oyp = oy + orb.r * cell + cell / 2;
      g.circle(oxp, oyp, cell * (0.2 + 0.04 * Math.sin(t * 6))).fill({ color: 0x00f7ff });
    }
    g.circle(ox + key.c * cell + cell / 2, oy + key.r * cell + cell / 2, cell * 0.18).fill({ color: hasKey ? 0x334155 : 0xffd200 });
    g.roundRect(ox + exit.c * cell + 6, oy + exit.r * cell + 6, cell - 12, cell - 12, 6).stroke({ width: 3, color: hasKey ? 0x3ddc84 : 0x475569 });
    g.circle(ox + player.c * cell + cell / 2, oy + player.r * cell + cell / 2, cell * 0.24).fill({ color: 0xb388ff });
    drawSparks(g, sparks);
  }

  return {
    update(dt) {
      if (over) return;
      t += dt;
      levelTimer += dt;
      freeze = Math.max(0, freeze - dt);
      updateSparks(sparks, dt);
      if (freeze <= 0 && beamHits(player.c, player.r)) {
        lives--;
        ctx.hud.setLives(lives);
        ctx.fx.screenShake(7, 0.12);
        ctx.audio.sfx('hit');
        burst(sparks, ctx.rng, ox + player.c * cell + cell / 2, oy + player.r * cell + cell / 2, 0xff2d75, 22, 160);
        player = { c: 0, r: ROWS - 1 };
        if (lives <= 0) {
          over = true;
          ctx.gameOver(score, { level });
        }
      }
      draw();
    },
    destroy() {
      offDown();
      layer.destroy({ children: true });
    },
  };
}

