import type { Game, GameContext } from '@core/types';
import { burst, drawSparks, updateSparks } from '@kits/arcade/juice';
import { CYAN, PINK, GOLD, GREEN, VIOLET, WHITE, makeLayer, backdrop } from '@kits/arcade/concept';

export default function createGame(ctx: GameContext): Game {
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
  const set = (c: number, r: number, v: number): void => {
    grid[r * N + c] = v;
  };
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
      for (let r = N - 1; r >= 0; r--)
        set(c, r, col[N - 1 - r] ?? ctx.rng.int(0, COLORS.length - 1));
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
    const pts =
      cleared.size * cleared.size * (group.length >= 9 ? 22 : group.length >= 6 ? 16 : 12);
    score += pts;
    ctx.fx.floatingText(
      `+${pts}`,
      ox + c * cell + cell / 2,
      oy + r * cell - 10,
      group.length >= 6 ? GOLD : WHITE,
    );
    for (const i of cleared) {
      const cc = i % N;
      const rr = Math.floor(i / N);
      set(cc, rr, -1);
      burst(
        sparks,
        ctx.rng,
        ox + cc * cell + cell / 2,
        oy + rr * cell + cell / 2,
        COLORS[group.length % COLORS.length]!,
        4,
        60,
      );
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
    g.roundRect(ox - 8, oy - 8, size + 16, size + 16, 12)
      .fill({ color: 0x090a18, alpha: 0.92 })
      .stroke({ width: 2, color: CYAN, alpha: 0.25 });
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
