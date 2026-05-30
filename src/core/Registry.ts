import type { GameModule } from './types';

export type Kit = 'grid' | 'shooter' | 'paddle' | 'vector' | 'sidescroll' | 'standalone';
export type Orientation = 'portrait' | 'landscape' | 'any';

export interface GameMeta {
  id: string;
  title: string;
  kit: Kit;
  /** Grouping label used by the side navigation. */
  group: 'Arcade' | 'Puzzle' | 'Shooter' | 'Paddle' | 'Jump' | 'Physics';
  orientation: Orientation;
  virtual: { w: number; h: number };
  accent: string; // tile accent color
  glyph: string; // short cover glyph/emoji
  blurb: string;
  available: boolean;
  loader?: () => Promise<GameModule>;
}

/**
 * The catalog of all 20 classics. Implemented games carry a lazy `loader` so the home
 * bundle stays tiny (code-splitting per game — docs/03 §4). Unimplemented entries render
 * as "Coming soon" tiles and follow the same contract once built.
 */
export const GAMES: GameMeta[] = [
  {
    id: 'snake',
    title: 'Snake',
    kit: 'grid',
    group: 'Arcade',
    orientation: 'portrait',
    virtual: { w: 360, h: 600 },
    accent: '#3ddc84',
    glyph: '🐍',
    blurb: 'Eat, grow, and don’t bite your tail.',
    available: true,
    loader: () => import('@games/snake'),
  },
  {
    id: 'tetris',
    title: 'Tetris',
    kit: 'grid',
    group: 'Puzzle',
    orientation: 'portrait',
    virtual: { w: 360, h: 640 },
    accent: '#00f7ff',
    glyph: '🧱',
    blurb: 'Stack the blocks, clear the lines.',
    available: true,
    loader: () => import('@games/tetris'),
  },
  {
    id: 'pong',
    title: 'Pong',
    kit: 'paddle',
    group: 'Paddle',
    orientation: 'landscape',
    virtual: { w: 640, h: 360 },
    accent: '#ffffff',
    glyph: '🏓',
    blurb: 'The original. First to 11 wins.',
    available: true,
    loader: () => import('@games/pong'),
  },
  {
    id: 'breakout',
    title: 'Breakout',
    kit: 'paddle',
    group: 'Paddle',
    orientation: 'portrait',
    virtual: { w: 360, h: 600 },
    accent: '#ff7b00',
    glyph: '🧱',
    blurb: 'Smash every brick with one ball.',
    available: true,
    loader: () => import('@games/breakout'),
  },
  {
    id: 'invaders',
    title: 'Space Invaders',
    kit: 'shooter',
    group: 'Shooter',
    orientation: 'portrait',
    virtual: { w: 360, h: 600 },
    accent: '#3ddc84',
    glyph: '👾',
    blurb: 'Repel the descending alien horde.',
    available: true,
    loader: () => import('@games/invaders'),
  },
  {
    id: 'flappy',
    title: 'Flappy',
    kit: 'sidescroll',
    group: 'Jump',
    orientation: 'portrait',
    virtual: { w: 360, h: 600 },
    accent: '#ffd200',
    glyph: '🐤',
    blurb: 'Tap to fly through the gaps.',
    available: true,
    loader: () => import('@games/flappy'),
  },
  {
    id: 'g2048',
    title: '2048',
    kit: 'grid',
    group: 'Puzzle',
    orientation: 'portrait',
    virtual: { w: 360, h: 560 },
    accent: '#edc22e',
    glyph: '🔢',
    blurb: 'Slide and merge to reach 2048.',
    available: true,
    loader: () => import('@games/g2048'),
  },
  {
    id: 'minesweeper',
    title: 'Minesweeper',
    kit: 'grid',
    group: 'Puzzle',
    orientation: 'portrait',
    virtual: { w: 360, h: 560 },
    accent: '#9aa0ff',
    glyph: '💣',
    blurb: 'Deduce the mines. Don’t guess.',
    available: true,
    loader: () => import('@games/minesweeper'),
  },
  {
    id: 'asteroids',
    title: 'Asteroids',
    kit: 'vector',
    group: 'Shooter',
    orientation: 'landscape',
    virtual: { w: 640, h: 400 },
    accent: '#a8a0ff',
    glyph: '🚀',
    blurb: 'Drift, shoot, and split the rocks.',
    available: true,
    loader: () => import('@games/asteroids'),
  },
  // ── Catalog completion (same contract; built in upcoming iterations — docs/08 Phase 5) ──
  mk('pacman', 'Pac-Man', 'grid', 'Arcade', 'portrait', '#ffeb3b', '🟡', 'Eat the dots, dodge the ghosts.'),
  mk('frogger', 'Frogger', 'grid', 'Arcade', 'portrait', '#4caf50', '🐸', 'Cross the road and the river.'),
  mk('galaga', 'Galaga', 'shooter', 'Shooter', 'portrait', '#42a5f5', '🛸', 'Formation shooter with divers.'),
  mk('centipede', 'Centipede', 'shooter', 'Shooter', 'portrait', '#8bc34a', '🐛', 'Blast the segmented crawler.'),
  mk('missile', 'Missile Command', 'shooter', 'Shooter', 'portrait', '#ff5252', '🚨', 'Defend your cities. Aim & fire.'),
  mk('bomberman', 'Bomberman', 'grid', 'Arcade', 'portrait', '#ff9800', '💥', 'Bomb the maze, beat the foes.'),
  mk('qbert', 'Q*bert', 'grid', 'Arcade', 'portrait', '#ff7043', '🟧', 'Hop cubes, change their color.'),
  mk('doodle', 'Doodle Jump', 'sidescroll', 'Jump', 'portrait', '#8bc34a', '⬆️', 'Bounce ever upward.'),
  mk('simon', 'Simon', 'standalone', 'Puzzle', 'portrait', '#e91e63', '🎵', 'Repeat the color sequence.'),
  mk('lander', 'Lunar Lander', 'vector', 'Physics', 'portrait', '#b0bec5', '🌙', 'Land softly on low fuel.'),
  mk('tron', 'Tron', 'grid', 'Arcade', 'landscape', '#00e5ff', '🏍️', 'Trap your rival with light trails.'),
];

function mk(
  id: string,
  title: string,
  kit: Kit,
  group: GameMeta['group'],
  orientation: Orientation,
  accent: string,
  glyph: string,
  blurb: string,
): GameMeta {
  const portrait = orientation !== 'landscape';
  return {
    id,
    title,
    kit,
    group,
    orientation,
    virtual: portrait ? { w: 360, h: 600 } : { w: 640, h: 360 },
    accent,
    glyph,
    blurb,
    available: false,
  };
}

export const getGame = (id: string): GameMeta | undefined => GAMES.find((g) => g.id === id);

export const GROUP_ORDER: GameMeta['group'][] = [
  'Arcade',
  'Puzzle',
  'Shooter',
  'Paddle',
  'Jump',
  'Physics',
];
