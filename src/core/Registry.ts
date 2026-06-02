import type { GameModule } from './types';

export type Kit = 'grid' | 'shooter' | 'paddle' | 'vector' | 'sidescroll' | 'standalone';
export type Orientation = 'portrait' | 'landscape' | 'any';

export interface GameMeta {
  id: string;
  title: string;
  kit: Kit;
  /** Grouping label used by the side navigation. */
  group: 'Arcade' | 'Puzzle' | 'Brain' | 'Skill' | 'Shooter' | 'Paddle' | 'Jump' | 'Physics';
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
  // ── Catalog completion: the remaining classics (docs/08 Phase 5) ──
  mk('pacman', 'Pac-Man', 'grid', 'Arcade', 'portrait', '#ffeb3b', '🟡', 'Eat the dots, dodge the ghosts.', () => import('@games/pacman')),
  mk('frogger', 'Frogger', 'grid', 'Arcade', 'portrait', '#4caf50', '🐸', 'Cross the road and the river.', () => import('@games/frogger')),
  mk('galaga', 'Galaga', 'shooter', 'Shooter', 'portrait', '#42a5f5', '🛸', 'Formation shooter with divers.', () => import('@games/galaga')),
  mk('centipede', 'Centipede', 'shooter', 'Shooter', 'portrait', '#8bc34a', '🐛', 'Blast the segmented crawler.', () => import('@games/centipede')),
  mk('missile', 'Missile Command', 'shooter', 'Shooter', 'portrait', '#ff5252', '🚨', 'Defend your cities. Aim & fire.', () => import('@games/missile')),
  mk('bomberman', 'Bomberman', 'grid', 'Arcade', 'portrait', '#ff9800', '💥', 'Bomb the maze, beat the foes.', () => import('@games/bomberman')),
  mk('qbert', 'Q*bert', 'grid', 'Arcade', 'portrait', '#ff7043', '🟧', 'Hop cubes, change their color.', () => import('@games/qbert')),
  mk('doodle', 'Doodle Jump', 'sidescroll', 'Jump', 'portrait', '#8bc34a', '⬆️', 'Bounce ever upward.', () => import('@games/doodle')),
  mk('simon', 'Simon', 'standalone', 'Puzzle', 'portrait', '#e91e63', '🎵', 'Repeat the color sequence.', () => import('@games/simon')),
  mk('lander', 'Lunar Lander', 'vector', 'Physics', 'portrait', '#b0bec5', '🌙', 'Land softly on low fuel.', () => import('@games/lander')),
  mk('tron', 'Tron', 'grid', 'Arcade', 'landscape', '#00e5ff', '🏍️', 'Trap your rival with light trails.', () => import('@games/tron')),

  // ── Volume II: 20 brand-new games ──
  // Brain / logic
  mk('memory', 'Memory', 'grid', 'Brain', 'portrait', '#ff80ab', '🃏', 'Find every matching pair.', () => import('@games/memory')),
  mk('lightsout', 'Lights Out', 'grid', 'Brain', 'portrait', '#ffd200', '💡', 'Switch every light off.', () => import('@games/lightsout')),
  mk('sliding', '15 Puzzle', 'grid', 'Brain', 'portrait', '#90caf9', '🔢', 'Slide tiles into order.', () => import('@games/sliding')),
  mk('sokoban', 'Sokoban', 'grid', 'Brain', 'portrait', '#a1887f', '📦', 'Push every crate home.', () => import('@games/sokoban')),
  mk('mastermind', 'Mastermind', 'standalone', 'Brain', 'portrait', '#b388ff', '🎯', 'Crack the secret code.', () => import('@games/mastermind')),
  mk('flood', 'Flood-It', 'grid', 'Brain', 'portrait', '#4dd0e1', '🌊', 'Flood the board in one color.', () => import('@games/flood')),
  mk('connectfour', 'Connect Four', 'grid', 'Brain', 'portrait', '#ffca28', '🔴', 'Four in a row beats the CPU.', () => import('@games/connectfour')),
  mk('tictactoe', 'Tic-Tac-Toe', 'grid', 'Brain', 'portrait', '#80cbc4', '⭕', 'Classic Xs and Os vs CPU.', () => import('@games/tictactoe')),
  mk('reversi', 'Reversi', 'grid', 'Brain', 'portrait', '#66bb6a', '⚫', 'Flip discs, own the board.', () => import('@games/reversi')),

  // Puzzle (falling / matching)
  mk('match3', 'Gem Match', 'grid', 'Puzzle', 'portrait', '#ec407a', '💎', 'Swap to line up three.', () => import('@games/match3')),
  mk('columns', 'Columns', 'grid', 'Puzzle', 'portrait', '#ab47bc', '🟪', 'Match falling jewel stacks.', () => import('@games/columns')),

  // Skill / action
  mk('dodger', 'Meteor Dodge', 'vector', 'Skill', 'portrait', '#ff7043', '☄️', 'Survive the falling meteors.', () => import('@games/dodger')),
  mk('helicopter', 'Copter', 'sidescroll', 'Skill', 'portrait', '#26c6da', '🚁', 'Fly the cave, tap to rise.', () => import('@games/helicopter')),
  mk('runner', 'Pixel Runner', 'sidescroll', 'Skill', 'portrait', '#9ccc65', '🏃', 'Endless jump-and-run.', () => import('@games/runner')),
  mk('whackamole', 'Whack-a-Mole', 'grid', 'Skill', 'portrait', '#8d6e63', '🔨', 'Bonk the moles, fast!', () => import('@games/whackamole')),
  mk('stacker', 'Stacker', 'grid', 'Skill', 'portrait', '#ffa726', '🧱', 'Stack the moving blocks.', () => import('@games/stacker')),
  mk('pinball', 'Pinball', 'paddle', 'Skill', 'portrait', '#ef5350', '🎰', 'Keep the ball alive, rack points.', () => import('@games/pinball')),
  mk('maze', 'Maze Run', 'grid', 'Skill', 'portrait', '#7e57c2', '🌀', 'Escape the maze before time.', () => import('@games/maze')),
  mk('reflex', 'Reflex Grid', 'standalone', 'Skill', 'portrait', '#26a69a', '⚡', 'Tap the target the instant it lights.', () => import('@games/reflex')),
  mk('tunnel', 'Tunnel Flyer', 'sidescroll', 'Skill', 'portrait', '#42a5f5', '🛸', 'Thread the endless tunnel.', () => import('@games/tunnel')),
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
  loader?: () => Promise<GameModule>,
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
    available: Boolean(loader),
    ...(loader ? { loader } : {}),
  };
}

export const getGame = (id: string): GameMeta | undefined => GAMES.find((g) => g.id === id);

export const GROUP_ORDER: GameMeta['group'][] = [
  'Arcade',
  'Puzzle',
  'Brain',
  'Skill',
  'Shooter',
  'Paddle',
  'Jump',
  'Physics',
];
