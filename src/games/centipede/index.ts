import { Container, Graphics } from 'pixi.js';
import type { Game, GameContext } from '@core/types';
import { clamp } from '@utils/math';

interface Segment {
  col: number;
  row: number;
  dir: number; // 1 right, -1 left
  head: boolean;
}

export default function createGame(ctx: GameContext): Game {
  const W = ctx.width;
  const H = ctx.height;
  const cols = 14;
  const cell = Math.floor(W / cols);
  const rows = Math.floor(H / cell);
  const ox = (W - cols * cell) / 2;
  const playerBandRows = 4;

  const layer = new Container();
  layer.position.set(ox, 0);
  ctx.stage.addChild(layer);
  const g = new Graphics();
  layer.addChild(g);

  const mushrooms = new Uint8Array(cols * rows);
  const mIdx = (c: number, r: number): number => r * cols + c;
  for (let i = 0; i < cols * rows * 0.12; i++) {
    const c = ctx.rng.int(0, cols - 1);
    const r = ctx.rng.int(1, rows - playerBandRows - 1);
    mushrooms[mIdx(c, r)] = 3;
  }

  let segments: Segment[] = [];
  const spawnCentipede = (len: number): void => {
    segments = [];
    for (let i = 0; i < len; i++) segments.push({ col: -i, row: 0, dir: 1, head: i === 0 });
  };

  const player = { col: Math.floor(cols / 2), row: rows - 1 };
  let bullet: { x: number; y: number } | null = null;
  let score = 0;
  let lives = 3;
  let over = false;
  let moveAcc = 0;
  let level = 1;

  ctx.hud.setScore(0);
  ctx.hud.setLives(lives);
  ctx.hud.setLabel('DEFEND');

  const loseLife = (): void => {
    lives--;
    ctx.hud.setLives(lives);
    ctx.audio.sfx('hit');
    if (lives <= 0) {
      over = true;
      ctx.gameOver(score, { level });
    } else {
      spawnCentipede(10 + level);
    }
  };
  spawnCentipede(10);

  const fire = (): void => {
    if (over || bullet) return;
    bullet = { x: player.col * cell + cell / 2, y: player.row * cell };
    ctx.audio.sfx('shoot');
  };
  const offDown = ctx.input.on('down', (a) => {
    if (a === 'a') fire();
  });
  const offTap = ctx.input.on('tap', fire);

  const stepCentipede = (): void => {
    for (const s of segments) {
      let nc = s.col + s.dir;
      const blockedMush = nc >= 0 && nc < cols && mushrooms[mIdx(nc, s.row)]! > 0;
      if (nc < 0 || nc >= cols || blockedMush) {
        s.dir *= -1;
        s.row = Math.min(rows - 1, s.row + 1);
        nc = s.col + s.dir;
      }
      s.col = clamp(nc, 0, cols - 1);
    }
    if (segments.some((s) => s.row >= rows - 1)) loseLife();
  };

  const draw = (): void => {
    g.clear();
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const hp = mushrooms[mIdx(c, r)]!;
        if (hp > 0)
          g.roundRect(c * cell + 2, r * cell + 2, cell - 4, cell - 4, 4).fill({ color: 0x8bc34a, alpha: 0.4 + hp * 0.15 });
      }
    segments.forEach((s) => {
      g.circle(s.col * cell + cell / 2, s.row * cell + cell / 2, cell * 0.4).fill({ color: s.head ? 0xff2e97 : 0xffd200 });
    });
    g.roundRect(player.col * cell + 3, player.row * cell + 3, cell - 6, cell - 6, 4).fill({ color: 0x00f7ff });
    if (bullet) g.rect(bullet.x - 2, bullet.y, 4, 10).fill({ color: 0xffffff });
  };

  return {
    update(dt) {
      if (over) return;
      const ax = ctx.input.axis();
      if (ax.x) player.col = clamp(player.col + Math.sign(ax.x), 0, cols - 1);
      if (ax.y) player.row = clamp(player.row + Math.sign(ax.y), rows - playerBandRows, rows - 1);

      moveAcc += dt;
      const interval = Math.max(0.08, 0.22 - level * 0.01);
      if (moveAcc >= interval) {
        moveAcc = 0;
        stepCentipede();
        if (over) return;
      }

      if (bullet) {
        bullet.y -= 480 * dt;
        const bc = Math.floor(bullet.x / cell);
        const br = Math.floor(bullet.y / cell);
        const hitIdx = segments.findIndex((s) => s.col === bc && s.row === br);
        if (hitIdx >= 0) {
          const seg = segments[hitIdx]!;
          mushrooms[mIdx(seg.col, seg.row)] = 2;
          segments.splice(hitIdx, 1);
          if (segments[hitIdx]) segments[hitIdx]!.head = true;
          bullet = null;
          score += 10;
          ctx.hud.setScore(score);
          ctx.audio.sfx('explosion');
        } else if (br >= 0 && br < rows && bc >= 0 && bc < cols && mushrooms[mIdx(bc, br)]! > 0) {
          mushrooms[mIdx(bc, br)]!--;
          if (mushrooms[mIdx(bc, br)] === 0) score += 1;
          bullet = null;
          ctx.audio.sfx('blip');
        } else if (bullet.y < 0) {
          bullet = null;
        }
      }

      if (segments.length === 0) {
        level++;
        ctx.hud.setLabel(`LEVEL ${level}`);
        ctx.audio.sfx('powerup');
        spawnCentipede(10 + level);
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
