import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import { burst, dist, drawBackdrop, drawSparks, type Spark, updateSparks } from '@games/_shared/juice';

type Star = { x: number; y: number; r: number; vy: number; color: number; power: boolean; time: boolean; spin: number };
const COLORS = [0x22d3ee, 0xff4d8d, 0xffd200, 0x3ddc84];

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const layer = new Container();
  const g = new Graphics();
  layer.addChild(g);
  ctx.stage.addChild(layer);
  const stars: Star[] = [];
  const sparks: Spark[] = [];
  let target = 0;
  let score = 0;
  let combo = 0;
  let time = 45;
  let frenzy = 0; // Feature: frenzy — any colour matches
  let spawn = 0;
  let t = 0;
  let over = false;

  ctx.hud.setScore(score);
  ctx.hud.setLabel('MATCH CYAN');

  const targetLabel = (): string => ['CYAN', 'PINK', 'GOLD', 'GREEN'][target]!;
  const addStar = (): void => {
    const color = ctx.rng.int(0, COLORS.length - 1);
    const roll = ctx.rng.next();
    stars.push({ x: 28 + ctx.rng.next() * (W - 56), y: 82, r: 14 + ctx.rng.next() * 8, vy: 72 + ctx.rng.next() * 70, color, power: roll > 0.9, time: roll > 0.8 && roll <= 0.9, spin: ctx.rng.next() * 6 });
  };

  const offTap = ctx.input.on('tap', ({ x, y }) => {
    if (over) return;
    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i]!;
      if (dist(x, y, s.x, s.y) > s.r + 10) continue;
      stars.splice(i, 1);
      if (s.time) {
        // Feature: time star adds seconds and keeps the combo
        time = Math.min(60, time + 5);
        combo++;
        score += 50;
        ctx.hud.setScore(score);
        ctx.hud.toast('+5s');
        ctx.fx.floatingText('+5s', s.x, s.y, 0x3ddc84);
        ctx.audio.sfx('powerup');
        burst(sparks, ctx.rng, s.x, s.y, 0x3ddc84, 16, 130);
        return;
      }
      if (s.color === target || s.power || frenzy > 0) {
        combo++;
        if (combo % 8 === 0) { frenzy = 4; ctx.hud.toast('FORGE FRENZY!'); } // Feature: frenzy at combo tiers
        const mult = 1 + Math.floor(combo / 6); // Feature: combo multiplier
        const pts = ((s.power ? 180 : 70) + combo * 12) * mult;
        score += pts;
        target = (target + 1) % COLORS.length;
        ctx.hud.setScore(score);
        ctx.hud.setLabel(`MATCH ${targetLabel()} x${combo}`);
        ctx.fx.floatingText(`+${pts}`, s.x, s.y, COLORS[s.color]!);
        ctx.audio.sfx(s.power ? 'powerup' : 'coin');
        burst(sparks, ctx.rng, s.x, s.y, COLORS[s.color]!, s.power ? 30 : 14, s.power ? 190 : 120);
        if (s.power) {
          score += stars.length * 30;
          for (const other of stars) burst(sparks, ctx.rng, other.x, other.y, COLORS[other.color]!, 6, 90);
          stars.length = 0;
        }
      } else {
        combo = 0;
        time = Math.max(0, time - 3);
        ctx.audio.sfx('hit');
        ctx.fx.screenShake(5, 0.1);
      }
      return;
    }
  });

  function draw(): void {
    g.clear();
    drawBackdrop(g, W, H, t, 0x34235c, 0x060512);
    g.circle(W / 2, H - 38, 26).fill({ color: COLORS[target]!, alpha: 0.28 }).stroke({ width: 3, color: COLORS[target]! });
    for (const s of stars) {
      const points = 5;
      const inner = s.r * 0.45;
      const outer = s.r * (s.power ? 1.18 : 1);
      g.moveTo(s.x + Math.cos(s.spin) * outer, s.y + Math.sin(s.spin) * outer);
      for (let p = 1; p <= points * 2; p++) {
        const rr = p % 2 ? inner : outer;
        const a = s.spin + (Math.PI * p) / points;
        g.lineTo(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr);
      }
      g.fill({ color: s.time ? 0x3ddc84 : COLORS[s.color]!, alpha: s.power ? 1 : 0.9 });
      if (s.power) g.circle(s.x, s.y, s.r + 7).stroke({ width: 2, color: 0xffffff, alpha: 0.45 + Math.sin(t * 10) * 0.2 });
      if (s.time) {
        g.circle(s.x, s.y, s.r * 0.42).stroke({ width: 2, color: 0xffffff, alpha: 0.8 });
        g.moveTo(s.x, s.y).lineTo(s.x, s.y - s.r * 0.32).moveTo(s.x, s.y).lineTo(s.x + s.r * 0.22, s.y).stroke({ width: 2, color: 0xffffff });
      }
    }
    drawSparks(g, sparks);
  }

  return {
    update(dt) {
      if (over) return;
      t += dt;
      updateSparks(sparks, dt);
      time -= dt;
      frenzy = Math.max(0, frenzy - dt);
      spawn -= dt;
      if (spawn <= 0) {
        spawn = Math.max(0.22, 0.64 - score / 16000);
        addStar();
      }
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i]!;
        s.y += s.vy * dt;
        s.spin += dt * 3;
        if (s.y > H - 64) {
          stars.splice(i, 1);
          if (s.color === target) {
            combo = 0;
            time -= 2;
          }
        }
      }
      ctx.hud.setLabel(frenzy > 0 ? `FRENZY! ${Math.ceil(time)}s x${combo}` : `${targetLabel()} ${Math.ceil(time)}s x${combo}`);
      if (time <= 0) {
        over = true;
        ctx.gameOver(score, { combo });
      }
      draw();
    },
    destroy() {
      offTap();
      layer.destroy({ children: true });
    },
  };
}

