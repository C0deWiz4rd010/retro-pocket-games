import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import { burst, dist, drawBackdrop, drawSparks, type Spark, updateSparks } from '@games/_shared/juice';

type Comet = { x: number; y: number; vx: number; vy: number; r: number; hp: number; color: number; kind: 'normal' | 'nova' | 'repair' };

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const cx = W / 2;
  const cy = H / 2;
  const layer = new Container();
  const g = new Graphics();
  layer.addChild(g);
  ctx.stage.addChild(layer);
  const comets: Comet[] = [];
  const sparks: Spark[] = [];
  let score = 0;
  let shield = 6;
  let heat = 0;
  let spawn = 0;
  let t = 0;
  let over = false;
  let combo = 0; // Feature: kill-combo multiplier
  let comboTimer = 0;

  ctx.hud.setScore(score);
  ctx.hud.setLives(shield);
  ctx.hud.setLabel('DEFEND');

  const addComet = (): void => {
    const a = ctx.rng.next() * Math.PI * 2;
    const r = Math.max(W, H) * 0.72;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    const speed = 48 + score * 0.008 + ctx.rng.next() * 44;
    const aim = Math.atan2(cy - y, cx - x);
    const roll = ctx.rng.next();
    const kind: Comet['kind'] = roll > 0.94 ? 'nova' : roll > 0.86 ? 'repair' : 'normal';
    const color = kind === 'nova' ? 0xffffff : kind === 'repair' ? 0x3ddc84 : ctx.rng.pick([0xff4d8d, 0xffd200, 0x22d3ee]);
    comets.push({ x, y, vx: Math.cos(aim) * speed, vy: Math.sin(aim) * speed, r: 10 + ctx.rng.next() * 11, hp: kind === 'normal' ? 1 + Math.floor(score / 2400) : 1, color, kind });
  };

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (over || heat > 0.92) return;
    heat += 0.18;
    ctx.audio.sfx('blip');
    ctx.fx.flashRect(x - 14, y - 14, 28, 28, 0x22d3ee);
    for (let i = comets.length - 1; i >= 0; i--) {
      const c = comets[i]!;
      if (dist(x, y, c.x, c.y) > c.r + 28) continue;
      c.hp--;
      burst(sparks, ctx.rng, c.x, c.y, c.color, 10, 110);
      if (c.hp <= 0) {
        comets.splice(i, 1);
        combo++;
        comboTimer = 2.5;
        const mult = 1 + Math.floor(combo / 5);
        score += 100 * mult;
        ctx.hud.setScore(score);
        ctx.fx.floatingText(`+${100 * mult}`, c.x, c.y, c.color);
        ctx.audio.sfx('clear');
        if (c.kind === 'nova') {
          // Feature: nova comet clears the whole screen
          ctx.hud.toast('NOVA BLAST!');
          ctx.fx.screenShake(8, 0.2);
          for (const other of comets) { burst(sparks, ctx.rng, other.x, other.y, other.color, 8, 110); score += 60; }
          comets.length = 0;
          ctx.hud.setScore(score);
        } else if (c.kind === 'repair') {
          // Feature: repair comet restores a shield
          shield = Math.min(9, shield + 1);
          ctx.hud.setLives(shield);
          ctx.hud.toast('+1 SHIELD');
        }
      }
    }
  });

  function draw(): void {
    g.clear();
    drawBackdrop(g, W, H, t, 0x12304a, 0x030610);
    g.circle(cx, cy, 42).fill({ color: 0x10162a }).stroke({ width: 4, color: shield > 2 ? 0x3ddc84 : 0xff4d8d, alpha: 0.85 });
    g.circle(cx, cy, 19 + Math.sin(t * 4) * 2).fill({ color: 0x22d3ee, alpha: 0.75 });
    g.moveTo(cx, cy - 54);
    g.arc(cx, cy, 54, -Math.PI / 2, -Math.PI / 2 + heat * Math.PI * 2).stroke({ width: 5, color: heat > 0.8 ? 0xff4d8d : 0xffd200 });
    for (const c of comets) {
      g.circle(c.x, c.y, c.r).fill({ color: c.color });
      g.circle(c.x - c.vx * 0.07, c.y - c.vy * 0.07, c.r * 0.55).fill({ color: 0xffffff, alpha: 0.25 });
      if (c.kind !== 'normal') g.circle(c.x, c.y, c.r + 5).stroke({ width: 2, color: c.kind === 'nova' ? 0xffd200 : 0x3ddc84, alpha: 0.5 + Math.sin(t * 9) * 0.3 });
    }
    drawSparks(g, sparks);
  }

  return {
    update(dt) {
      if (over) return;
      t += dt;
      updateSparks(sparks, dt);
      heat = Math.max(0, heat - dt * 0.42);
      if (comboTimer > 0) comboTimer -= dt; else combo = 0;
      spawn -= dt;
      if (spawn <= 0) {
        spawn = Math.max(0.28, 0.9 - score / 10000);
        addComet();
      }
      for (let i = comets.length - 1; i >= 0; i--) {
        const c = comets[i]!;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (dist(c.x, c.y, cx, cy) < c.r + 36) {
          comets.splice(i, 1);
          shield--;
          combo = 0;
          ctx.hud.setLives(shield);
          ctx.audio.sfx('hit');
          ctx.fx.screenShake(7, 0.14);
          burst(sparks, ctx.rng, cx, cy, 0xff4d8d, 24, 180);
          if (shield <= 0) {
            over = true;
            ctx.gameOver(score, { shield });
          }
        }
      }
      ctx.hud.setLabel(heat > 0.8 ? 'COOLING' : combo >= 5 ? `COMBO x${1 + Math.floor(combo / 5)}` : 'DEFEND');
      draw();
    },
    destroy() {
      offTap();
      layer.destroy({ children: true });
    },
  };
}
