import type { GameModule } from './types';
import { controlsForGame, type ControlProfile } from './controlProfiles';

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
  controls?: ControlProfile;
  difficulty?: 'easy' | 'medium' | 'hard' | 'variable';
  tags?: string[];
  cover?: { kind: 'generated'; motif: 'grid' | 'paddle' | 'shooter' | 'vector' | 'cards' | 'logic' };
  assetManifest?: string;
  defaultHud?: 'score' | 'score-lives' | 'score-level' | 'minimal';
  tutorialSteps?: string[];
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

  // ── Volume III: 5 brand-new games ──
  mk('battleship', 'Battleship', 'grid', 'Brain', 'portrait', '#1e90ff', '🚢', 'Sink the enemy fleet before they sink yours.', () => import('@games/battleship')),
  mk('sudoku', 'Sudoku', 'grid', 'Brain', 'portrait', '#b0c4de', '🔢', 'Fill every row, column and box.', () => import('@games/sudoku')),
  mk('checkers', 'Checkers', 'grid', 'Brain', 'portrait', '#c19a6b', '⚫', 'Jump and capture — beat the AI.', () => import('@games/checkers')),
  mk('bubble', 'Bubble Shooter', 'standalone', 'Puzzle', 'portrait', '#ff80ab', '🫧', 'Match 3+ bubbles to pop them all.', () => import('@games/bubble')),
  mk('blackjack', 'Blackjack', 'standalone', 'Brain', 'portrait', '#2e8b57', '🃏', 'Hit, stand or double — beat the dealer.', () => import('@games/blackjack')),
  // Volume IV: 5 quick-session classics
  mk('hangman', 'Hangman', 'standalone', 'Brain', 'portrait', '#7dd3fc', 'ABC', 'Guess the hidden word before the chalk runs out.', () => import('@games/hangman')),
  mk('yahtzee', 'Dice Poker', 'standalone', 'Brain', 'portrait', '#facc15', '5D6', 'Roll, hold, and chase the best dice combo.', () => import('@games/yahtzee')),
  mk('rps', 'RPS Duel', 'standalone', 'Skill', 'portrait', '#fb7185', 'RPS', 'Read the rival and win a best-of-five duel.', () => import('@games/rps')),
  mk('targettap', 'Target Tap', 'standalone', 'Skill', 'portrait', '#22d3ee', '+', 'Hit moving targets before time runs out.', () => import('@games/targettap')),
  mk('chainreaction', 'Chain Reaction', 'grid', 'Puzzle', 'portrait', '#c084fc', 'CR', 'Overload cells and trigger cascading bursts.', () => import('@games/chainreaction')),
  // Volume V: 5 one-minute skill and brain challenges
  mk('quickmath', 'Quick Math', 'standalone', 'Brain', 'portrait', '#38bdf8', '123', 'Solve fast arithmetic before the timer runs out.', () => import('@games/quickmath')),
  mk('higherlower', 'Higher Lower', 'standalone', 'Brain', 'portrait', '#f97316', 'H/L', 'Predict the next card and build a streak.', () => import('@games/higherlower')),
  mk('colorclash', 'Color Clash', 'standalone', 'Skill', 'portrait', '#22c55e', 'RGB', 'Ignore the word and tap the ink color.', () => import('@games/colorclash')),
  mk('orbit', 'Orbit Dodge', 'vector', 'Skill', 'portrait', '#22d3ee', 'ORB', 'Circle the core and dodge incoming debris.', () => import('@games/orbit')),
  mk('lockpick', 'Lockpick', 'standalone', 'Skill', 'portrait', '#facc15', 'PIN', 'Time each pin inside the golden arc.', () => import('@games/lockpick')),
  // Volume VI: 5 memory, timing and deduction minis
  mk('numberhunt', 'Number Hunt', 'grid', 'Brain', 'portrait', '#34d399', '1-16', 'Tap the numbers in order before time runs out.', () => import('@games/numberhunt')),
  mk('wordmix', 'Word Mix', 'standalone', 'Brain', 'portrait', '#a78bfa', 'ABC', 'Unscramble the arcade word under pressure.', () => import('@games/wordmix')),
  mk('pulsecatch', 'Pulse Catch', 'standalone', 'Skill', 'portrait', '#fb7185', '!!!', 'Stop the pulse inside the scoring zone.', () => import('@games/pulsecatch')),
  mk('memorypath', 'Memory Path', 'grid', 'Brain', 'portrait', '#60a5fa', '3x3', 'Watch the path and replay it from memory.', () => import('@games/memorypath')),
  mk('hotcold', 'Hot Cold', 'standalone', 'Skill', 'portrait', '#f97316', 'SCAN', 'Use hot and cold pings to find hidden signals.', () => import('@games/hotcold')),
  // Volume VII: 10 animated neon challenges
  mk('neonrush', 'Neon Rush', 'sidescroll', 'Skill', 'portrait', '#00f7ff', 'NR', 'Dodge blocks, grab coins, and ride shield boosts.', () => import('@games/neonrush')),
  mk('crystalvault', 'Crystal Vault', 'grid', 'Puzzle', 'portrait', '#b388ff', 'CV', 'Pop crystal clusters, trigger cascades, and spend moves wisely.', () => import('@games/crystalvault')),
  mk('lasermaze', 'Laser Maze', 'grid', 'Skill', 'portrait', '#ff2d75', 'LM', 'Steal the key and slip past sweeping security beams.', () => import('@games/lasermaze')),
  mk('starforge', 'Star Forge', 'standalone', 'Skill', 'portrait', '#ffd200', 'SF', 'Tap the right falling stars and forge rising combos.', () => import('@games/starforge')),
  mk('driftracer', 'Drift Racer', 'vector', 'Skill', 'portrait', '#22d3ee', 'DR', 'Thread neon gates with momentum and boost control.', () => import('@games/driftracer')),
  mk('runereactor', 'Rune Reactor', 'grid', 'Puzzle', 'portrait', '#c084fc', 'RR', 'Charge runes until the board erupts in chain reactions.', () => import('@games/runereactor')),
  mk('cometsweep', 'Comet Sweep', 'standalone', 'Shooter', 'portrait', '#38bdf8', 'CS', 'Tap blast zones to protect the glowing core from comets.', () => import('@games/cometsweep')),
  mk('prismdash', 'Prism Dash', 'sidescroll', 'Skill', 'portrait', '#fb7185', 'PD', 'Match your prism color while dodging shifting gates.', () => import('@games/prismdash')),
  mk('gearlock', 'Gear Lock', 'standalone', 'Skill', 'portrait', '#facc15', 'GL', 'Time each lock pin inside the golden gear window.', () => import('@games/gearlock')),
  mk('echorunner', 'Echo Runner', 'grid', 'Brain', 'portrait', '#60a5fa', 'ER', 'Watch the echo path, then replay it under pressure.', () => import('@games/echorunner')),
];

for (const game of GAMES) {
  game.controls ??= controlsForGame({ id: game.id, kit: game.kit, orientation: game.orientation });
  game.difficulty ??= 'variable';
  game.tags ??= [game.group.toLowerCase(), game.kit];
  game.cover ??= { kind: 'generated', motif: coverMotif(game.kit, game.group) };
  game.defaultHud ??= defaultHudForKit(game.kit);
  game.tutorialSteps ??= tutorialFor(game);
}

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
    controls: controlsForGame({ id, kit, orientation }),
    difficulty: 'variable',
    tags: [group.toLowerCase(), kit],
    cover: { kind: 'generated', motif: coverMotif(kit, group) },
    defaultHud: defaultHudForKit(kit),
    available: Boolean(loader),
    ...(loader ? { loader } : {}),
  };
}

function coverMotif(kit: Kit, group: GameMeta['group']): NonNullable<GameMeta['cover']>['motif'] {
  if (group === 'Brain') return 'logic';
  if (kit === 'paddle') return 'paddle';
  if (kit === 'shooter') return 'shooter';
  if (kit === 'vector') return 'vector';
  if (kit === 'standalone') return 'cards';
  return 'grid';
}

function defaultHudForKit(kit: Kit): NonNullable<GameMeta['defaultHud']> {
  if (kit === 'paddle' || kit === 'shooter' || kit === 'vector' || kit === 'sidescroll') return 'score-lives';
  if (kit === 'grid') return 'score-level';
  return 'score';
}

function tutorialFor(game: GameMeta): string[] {
  const hints = game.controls?.hints ?? [];
  return [
    game.blurb,
    hints.length ? `Controls: ${hints.join(' / ')}` : 'Tap the screen targets.',
    `${game.group} / ${game.kit}`,
  ];
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
