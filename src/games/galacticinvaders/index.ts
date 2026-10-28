import type { Game, GameContext } from '@core/types';
import { burst, clamp, drawSparks, updateSparks } from '@kits/arcade/juice';
import { CYAN, PINK, GOLD, GREEN, WHITE, makeLayer, backdrop } from '@kits/arcade/concept';

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const { layer, g, sparks } = makeLayer(ctx);
  const player = { x: W / 2, y: H - 42 };
  const invaders: { x: number; y: number; row: number; alive: boolean }[] = [];
  const shots: { x: number; y: number; enemy: boolean; vx?: number }[] = [];
  const barriers: { x: number; y: number; hp: number }[] = [];
  const drops: { x: number; y: number; kind: 'rapid' | 'spread' | 'shield' }[] = []; // Feature: power-up drops
  let ufo: { x: number; y: number; dir: number; worth: number } | null = null;
  let dir = 1;
  let step = 0;
  let fireCd = 0;
  let ufoCd = 5;
  let score = 0;
  let lives = 3;
  let wave = 1;
  let t = 0;
  let rapidT = 0; // Feature: rapid fire
  let spreadT = 0; // Feature: spread shot
  let shield = false; // Feature: shield
  let streak = 0; // Feature: kill streak multiplier
  let streakT = 0;
  const DROPCOL: Record<string, number> = { rapid: GOLD, spread: CYAN, shield: GREEN };
  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('WAVE 1');
  const build = (): void => {
    invaders.length = 0;
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 8; c++)
        invaders.push({ x: 32 + c * 38, y: 70 + r * 30, row: r, alive: true });
    barriers.length = 0;
    for (let i = 0; i < 3; i++)
      barriers.push({ x: W * (0.25 + i * 0.25), y: H - 118, hp: 5 + wave });
  };
  build();
  const shoot = (): void => {
    if (fireCd > 0) return;
    fireCd = (spreadT > 0 ? 0.26 : 0.22) * (rapidT > 0 ? 0.5 : 1);
    shots.push({ x: player.x, y: player.y - 12, enemy: false });
    if (spreadT > 0) {
      shots.push({ x: player.x, y: player.y - 10, enemy: false, vx: -150 });
      shots.push({ x: player.x, y: player.y - 10, enemy: false, vx: 150 });
    }
    ctx.audio.sfx('shoot');
  };
  const collect = (kind: 'rapid' | 'spread' | 'shield'): void => {
    if (kind === 'rapid') rapidT = 8;
    else if (kind === 'spread') spreadT = 8;
    else shield = true;
    ctx.audio.sfx('powerup');
    ctx.hud.toast(kind === 'rapid' ? 'RAPID FIRE' : kind === 'spread' ? 'SPREAD SHOT' : 'SHIELD');
  };
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a') shoot();
  });
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
    for (const d of drops) {
      g.roundRect(d.x - 8, d.y - 6, 16, 12, 3).fill({ color: DROPCOL[d.kind]! });
      g.roundRect(d.x - 8, d.y - 6, 16, 12, 3).stroke({ width: 1, color: WHITE, alpha: 0.6 });
    }
    if (shield) g.circle(player.x, player.y + 4, 26).stroke({ width: 2, color: GREEN, alpha: 0.6 });
    g.roundRect(player.x - 20, player.y, 40, 14, 4).fill({
      color: spreadT > 0 ? CYAN : rapidT > 0 ? GOLD : CYAN,
    });
    g.rect(player.x - 3, player.y - 8, 6, 8).fill({ color: CYAN });
    drawSparks(g, sparks);
  }
  return {
    update(dt) {
      t += dt;
      updateSparks(sparks, dt);
      fireCd = Math.max(0, fireCd - dt);
      rapidT = Math.max(0, rapidT - dt);
      spreadT = Math.max(0, spreadT - dt);
      if (streakT > 0 && (streakT -= dt) <= 0) streak = 0;
      // power-up drops fall + pickup
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]!;
        d.y += 120 * dt;
        if (d.y > H + 10) {
          drops.splice(i, 1);
          continue;
        }
        if (Math.abs(d.x - player.x) < 26 && d.y > player.y - 8) {
          collect(d.kind);
          drops.splice(i, 1);
        }
      }
      ufoCd -= dt;
      if (!ufo && ufoCd <= 0) {
        const dirPick = ctx.rng.pick([-1, 1]);
        ufo = {
          x: dirPick > 0 ? -32 : W + 32,
          y: 44,
          dir: dirPick,
          worth: ctx.rng.pick([200, 300, 500]),
        };
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
      if (step > Math.max(0.08, (0.52 * alive.length) / invaders.length)) {
        step = 0;
        let edge = false;
        for (const inv of alive)
          if ((dir > 0 && inv.x > W - 28) || (dir < 0 && inv.x < 28)) edge = true;
        if (edge) {
          dir *= -1;
          for (const inv of alive) inv.y += 18;
        } else for (const inv of alive) inv.x += dir * 14;
        if (alive.some((inv) => inv.y > H - 78)) ctx.gameOver(score, { wave });
        const shooter = ctx.rng.pick(alive);
        if (shooter && ctx.rng.next() < 0.45)
          shots.push({ x: shooter.x, y: shooter.y + 12, enemy: true });
      }
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i]!;
        s.y += (s.enemy ? 260 : -460) * dt;
        s.x += (s.vx ?? 0) * dt;
        if (s.y < -20 || s.y > H + 20 || s.x < -20 || s.x > W + 20) {
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
          if (shield) {
            shield = false;
            ctx.audio.sfx('powerup');
            ctx.hud.toast('SHIELD DOWN');
            burst(sparks, ctx.rng, player.x, player.y, GREEN, 12, 120);
          } else {
            streak = 0;
            lives--;
            ctx.hud.setLives(lives);
            ctx.fx.screenShake(6, 0.12);
            if (lives <= 0) {
              ctx.gameOver(score, { wave });
              return;
            }
          }
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
              streak++;
              streakT = 2.5;
              const mult = 1 + Math.floor(streak / 6);
              score += (5 - inv.row) * 20 * mult;
              if (streak >= 6 && streak % 6 === 0)
                ctx.fx.floatingText(`STREAK x${mult}`, inv.x, inv.y - 14, GOLD);
              if (ctx.rng.next() < 0.1)
                drops.push({
                  x: inv.x,
                  y: inv.y,
                  kind: ctx.rng.pick(['rapid', 'spread', 'shield'] as const),
                });
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
      const buffs = [rapidT > 0 ? '⚡' : '', spreadT > 0 ? '⋔' : '', shield ? '🛡' : ''].join('');
      ctx.hud.setLabel(
        ufo
          ? 'BONUS UFO'
          : buffs
            ? `WAVE ${wave} ${buffs}`
            : streak >= 6
              ? `STREAK x${1 + Math.floor(streak / 6)}`
              : `WAVE ${wave}`,
      );
      draw();
    },
    destroy() {
      offDown();
      offTap();
      layer.destroy({ children: true });
    },
  };
}
