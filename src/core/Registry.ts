import type { GameModule } from './types';
import { controlsForGame, type ControlProfile } from './controlProfiles';

export type Kit = 'grid' | 'shooter' | 'paddle' | 'vector' | 'sidescroll' | 'standalone';
export type Orientation = 'portrait' | 'landscape' | 'any';
export type GameCollection =
  | 'quick'
  | 'classic'
  | 'neon'
  | 'one-thumb'
  | 'brain'
  | 'puzzle'
  | 'action'
  | 'score';

export interface RewardProfile {
  targetScore: number;
  sessionMin: number;
  sessionMax: number;
  difficulty: number;
}

export interface MasteryGoal {
  id: string;
  label: string;
  target: number;
  metric: 'score' | 'plays' | 'custom';
  customKey?: string;
}

export interface DailyRules {
  allowedModifiers: ('classic' | 'turbo' | 'zen' | 'sudden')[];
  targetScore: number;
}

export type GameMode = 'practice' | 'challenge' | 'endless';

export interface GamePolish {
  release: 'classic' | 'new' | 'featured';
  hotScore: number;
  previewSpeed: 'calm' | 'medium' | 'fast';
  tips: string[];
  modes: GameMode[];
}

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
  collections?: GameCollection[];
  sessionLength?: 'quick' | 'medium' | 'deep';
  reward?: RewardProfile;
  masteryGoals?: MasteryGoal[];
  dailyRules?: DailyRules;
  polish?: GamePolish;
  available: boolean;
  loader?: () => Promise<GameModule>;
}

/**
 * The catalog of all 85 games. Implemented games carry a lazy `loader` so the home
 * bundle stays tiny (code-splitting per game — docs/03 §4). Unimplemented entries render
 * as "Coming soon" tiles and follow the same contract once built.
 */
export const GAMES: GameMeta[] = [
  // Concept-art collection from the launcher mockup.
  mk('pixeldash', 'Pixel Dash', 'sidescroll', 'Skill', 'portrait', '#ff7043', '🏙️', 'Run the neon rooftops, grab coins, and clear hazards.', () => import('@games/pixeldash')),
  mk('neonrider', 'Neon Rider', 'sidescroll', 'Skill', 'portrait', '#ff2e97', '🏎️', 'Thread traffic lanes at sunset speed.', () => import('@games/neonrider')),
  mk('blockcollapse', 'Block Collapse', 'grid', 'Puzzle', 'portrait', '#ffd200', '🟦', 'Pop connected blocks and trigger high-value collapses.', () => import('@games/blockcollapse')),
  mk('spaceblaster', 'Space Blaster', 'shooter', 'Shooter', 'portrait', '#42a5f5', '🛸', 'Blast bugs, rocks, and saucers before they breach.', () => import('@games/spaceblaster')),
  mk('jumpquest', 'Jump Quest', 'sidescroll', 'Jump', 'portrait', '#8bc34a', '🧗', 'Climb platforms, collect gems, and avoid patrols.', () => import('@games/jumpquest')),
  mk('retrosnake', 'Retro Snake', 'grid', 'Arcade', 'portrait', '#3ddc84', '🐍', 'A glowing snake grid with wraparound danger.', () => import('@games/retrosnake')),
  mk('dotcollector', 'Dot Collector', 'grid', 'Arcade', 'portrait', '#ffd200', '👻', 'Clear the maze dots while chasers close in.', () => import('@games/dotcollector')),
  mk('memorymatch', 'Memory Match', 'standalone', 'Brain', 'portrait', '#ff80ab', '🎴', 'Flip neon cards and chain perfect pairs.', () => import('@games/memorymatch')),
  mk('brickbreaker', 'Brick Breaker', 'paddle', 'Paddle', 'portrait', '#00f7ff', '🧱', 'Shatter glowing brick walls with a charged paddle.', () => import('@games/brickbreaker')),
  mk('turbodrift', 'Turbo Drift', 'vector', 'Skill', 'portrait', '#22c55e', '🏁', 'Slide through neon gates with momentum.', () => import('@games/turbodrift')),
  mk('colorswitch', 'Color Switch', 'standalone', 'Skill', 'portrait', '#c084fc', '🌈', 'Swap colors to pass rotating neon rings.', () => import('@games/colorswitch')),
  mk('galacticinvaders', 'Galactic Invaders', 'shooter', 'Shooter', 'portrait', '#7c70da', '👾', 'Formation invaders with modern pixel polish.', () => import('@games/galacticinvaders')),
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
  mk('hangman', 'Hangman', 'standalone', 'Brain', 'portrait', '#7dd3fc', '🔤', 'Guess the hidden word before the chalk runs out.', () => import('@games/hangman')),
  mk('yahtzee', 'Dice Poker', 'standalone', 'Brain', 'portrait', '#facc15', '🎲', 'Roll, hold, and chase the best dice combo.', () => import('@games/yahtzee')),
  mk('rps', 'RPS Duel', 'standalone', 'Skill', 'portrait', '#fb7185', '✊', 'Read the rival and win a best-of-five duel.', () => import('@games/rps')),
  mk('targettap', 'Target Tap', 'standalone', 'Skill', 'portrait', '#22d3ee', '🎯', 'Hit moving targets before time runs out.', () => import('@games/targettap')),
  mk('chainreaction', 'Chain Reaction', 'grid', 'Puzzle', 'portrait', '#c084fc', '⚛️', 'Overload cells and trigger cascading bursts.', () => import('@games/chainreaction')),
  // Volume V: 5 one-minute skill and brain challenges
  mk('quickmath', 'Quick Math', 'standalone', 'Brain', 'portrait', '#38bdf8', '➗', 'Solve fast arithmetic before the timer runs out.', () => import('@games/quickmath')),
  mk('higherlower', 'Higher Lower', 'standalone', 'Brain', 'portrait', '#f97316', '🃏', 'Predict the next card and build a streak.', () => import('@games/higherlower')),
  mk('colorclash', 'Color Clash', 'standalone', 'Skill', 'portrait', '#22c55e', '🎨', 'Ignore the word and tap the ink color.', () => import('@games/colorclash')),
  mk('orbit', 'Orbit Dodge', 'vector', 'Skill', 'portrait', '#22d3ee', '🪐', 'Circle the core and dodge incoming debris.', () => import('@games/orbit')),
  mk('lockpick', 'Lockpick', 'standalone', 'Skill', 'portrait', '#facc15', '🔓', 'Time each pin inside the golden arc.', () => import('@games/lockpick')),
  // Volume VI: 5 memory, timing and deduction minis
  mk('numberhunt', 'Number Hunt', 'grid', 'Brain', 'portrait', '#34d399', '🔟', 'Tap the numbers in order before time runs out.', () => import('@games/numberhunt')),
  mk('wordmix', 'Word Mix', 'standalone', 'Brain', 'portrait', '#a78bfa', '📝', 'Unscramble the arcade word under pressure.', () => import('@games/wordmix')),
  mk('pulsecatch', 'Pulse Catch', 'standalone', 'Skill', 'portrait', '#fb7185', '💓', 'Stop the pulse inside the scoring zone.', () => import('@games/pulsecatch')),
  mk('memorypath', 'Memory Path', 'grid', 'Brain', 'portrait', '#60a5fa', '🧠', 'Watch the path and replay it from memory.', () => import('@games/memorypath')),
  mk('hotcold', 'Hot Cold', 'standalone', 'Skill', 'portrait', '#f97316', '🌡️', 'Use hot and cold pings to find hidden signals.', () => import('@games/hotcold')),
  // Volume VII: 10 animated neon challenges
  mk('neonrush', 'Neon Rush', 'sidescroll', 'Skill', 'portrait', '#00f7ff', '⚡', 'Dodge blocks, grab coins, and ride shield boosts.', () => import('@games/neonrush')),
  mk('crystalvault', 'Crystal Vault', 'grid', 'Puzzle', 'portrait', '#b388ff', '💠', 'Pop crystal clusters, trigger cascades, and spend moves wisely.', () => import('@games/crystalvault')),
  mk('lasermaze', 'Laser Maze', 'grid', 'Skill', 'portrait', '#ff2d75', '🔑', 'Steal the key and slip past sweeping security beams.', () => import('@games/lasermaze')),
  mk('starforge', 'Star Forge', 'standalone', 'Skill', 'portrait', '#ffd200', '⭐', 'Tap the right falling stars and forge rising combos.', () => import('@games/starforge')),
  mk('driftracer', 'Drift Racer', 'vector', 'Skill', 'portrait', '#22d3ee', '🚗', 'Thread neon gates with momentum and boost control.', () => import('@games/driftracer')),
  mk('runereactor', 'Rune Reactor', 'grid', 'Puzzle', 'portrait', '#c084fc', '☢️', 'Charge runes until the board erupts in chain reactions.', () => import('@games/runereactor')),
  mk('cometsweep', 'Comet Sweep', 'standalone', 'Shooter', 'portrait', '#38bdf8', '☄️', 'Tap blast zones to protect the glowing core from comets.', () => import('@games/cometsweep')),
  mk('prismdash', 'Prism Dash', 'sidescroll', 'Skill', 'portrait', '#fb7185', '🔷', 'Match your prism color while dodging shifting gates.', () => import('@games/prismdash')),
  mk('gearlock', 'Gear Lock', 'standalone', 'Skill', 'portrait', '#facc15', '⚙️', 'Time each lock pin inside the golden gear window.', () => import('@games/gearlock')),
  mk('echorunner', 'Echo Runner', 'grid', 'Brain', 'portrait', '#60a5fa', '🔊', 'Watch the echo path, then replay it under pressure.', () => import('@games/echorunner')),

  // ── Volume VIII: three original creations ──
  mk('polara', 'Polara', 'vector', 'Skill', 'portrait', '#38bdf8', '🧲', 'Flip the core polarity to absorb matching particles before they breach.', () => import('@games/polara')),
  mk('dualoop', 'Dualoop', 'vector', 'Skill', 'portrait', '#22d3ee', '🔵', 'Orbit the core and swap rings to slip past sweeping barriers.', () => import('@games/dualoop')),
  mk('cometputt', 'Comet Putt', 'vector', 'Skill', 'portrait', '#3ddc84', '⛳', 'Tap to aim and fling the comet through gravity and bumpers into the ring.', () => import('@games/cometputt')),
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

export const COLLECTIONS: { id: GameCollection; label: string; blurb: string }[] = [
  { id: 'quick', label: 'Quick Runs', blurb: 'Fast sessions for one more try.' },
  { id: 'classic', label: 'Classics', blurb: 'Arcade roots and familiar legends.' },
  { id: 'neon', label: 'Neon Originals', blurb: 'Modern pocket challenges with extra juice.' },
  { id: 'one-thumb', label: 'One Thumb', blurb: 'Tap, swipe, or drag-friendly games.' },
  { id: 'brain', label: 'Brain Cabinet', blurb: 'Logic, memory, words, and deduction.' },
  { id: 'puzzle', label: 'Puzzle Cabinet', blurb: 'Boards, cascades, matches, and clears.' },
  { id: 'action', label: 'Action Bay', blurb: 'Movement, survival, shooting, and timing.' },
  { id: 'score', label: 'Score Chasers', blurb: 'Built for high-score grinding.' },
];

const NEON_ORIGINALS = new Set([
  'pixeldash',
  'neonrider',
  'blockcollapse',
  'spaceblaster',
  'jumpquest',
  'retrosnake',
  'dotcollector',
  'memorymatch',
  'brickbreaker',
  'turbodrift',
  'colorswitch',
  'galacticinvaders',
  'neonrush',
  'crystalvault',
  'lasermaze',
  'starforge',
  'driftracer',
  'runereactor',
  'cometsweep',
  'prismdash',
  'gearlock',
  'echorunner',
]);

const CLASSICS = new Set([
  'snake',
  'tetris',
  'pong',
  'breakout',
  'invaders',
  'flappy',
  'g2048',
  'minesweeper',
  'asteroids',
  'pacman',
  'frogger',
  'galaga',
  'centipede',
  'missile',
  'bomberman',
  'qbert',
  'doodle',
  'simon',
  'lander',
  'tron',
]);

function collectionsFor(game: GameMeta): GameCollection[] {
  const out = new Set<GameCollection>();
  if (NEON_ORIGINALS.has(game.id)) out.add('neon');
  if (CLASSICS.has(game.id)) out.add('classic');
  if (game.group === 'Brain') out.add('brain');
  if (game.group === 'Puzzle') out.add('puzzle');
  if (['Arcade', 'Skill', 'Shooter', 'Jump', 'Paddle', 'Physics'].includes(game.group)) out.add('action');
  if (game.controls?.preset === 'tap' || game.controls?.preset === 'swipe' || game.controls?.preset === 'drag') out.add('one-thumb');
  if (game.kit !== 'standalone' || game.group === 'Skill' || game.group === 'Shooter') out.add('score');
  if (sessionLengthFor(game) === 'quick') out.add('quick');
  return [...out];
}

function sessionLengthFor(game: GameMeta): NonNullable<GameMeta['sessionLength']> {
  if (['quickmath', 'reflex', 'targettap', 'rps', 'higherlower', 'pulsecatch', 'lockpick', 'gearlock', 'colorclash', 'hotcold'].includes(game.id)) {
    return 'quick';
  }
  if (['sudoku', 'checkers', 'battleship', 'sokoban', 'reversi', 'blackjack', 'yahtzee'].includes(game.id)) {
    return 'deep';
  }
  if (game.group === 'Brain' && game.kit !== 'standalone') return 'medium';
  return game.kit === 'standalone' ? 'quick' : 'medium';
}

function rewardFor(game: GameMeta): RewardProfile {
  const baseTarget: Record<GameMeta['group'], number> = {
    Arcade: 900,
    Puzzle: 1200,
    Brain: 700,
    Skill: 1000,
    Shooter: 1400,
    Paddle: 1100,
    Jump: 850,
    Physics: 900,
  };
  const session = sessionLengthFor(game);
  const difficulty = game.difficulty === 'hard' ? 1.25 : game.difficulty === 'easy' ? 0.85 : 1;
  return {
    targetScore: baseTarget[game.group],
    sessionMin: session === 'quick' ? 1 : session === 'deep' ? 4 : 2,
    sessionMax: session === 'quick' ? 2 : session === 'deep' ? 8 : 4,
    difficulty,
  };
}

/** Mechanic-specific gold mastery goal per game, keyed to the `custom` stat it emits at
 * game over (higher-is-better only; games without a suitable stat keep the score tier). */
const MASTERY_GOLD: Record<string, { label: string; target: number; key: string }> = {
  snake: { label: 'Reach length 30', target: 30, key: 'length' },
  tetris: { label: 'Reach level 10', target: 10, key: 'level' },
  breakout: { label: 'Clear level 3', target: 3, key: 'level' },
  asteroids: { label: 'Survive wave 5', target: 5, key: 'wave' },
  galaga: { label: 'Reach wave 5', target: 5, key: 'wave' },
  invaders: { label: 'Reach wave 4', target: 4, key: 'wave' },
  missile: { label: 'Defend to wave 5', target: 5, key: 'wave' },
  centipede: { label: 'Reach level 4', target: 4, key: 'level' },
  bomberman: { label: 'Clear level 3', target: 3, key: 'level' },
  qbert: { label: 'Reach level 4', target: 4, key: 'level' },
  pacman: { label: 'Clear 2 mazes', target: 2, key: 'cleared' },
  frogger: { label: 'Fill all 5 homes', target: 5, key: 'homes' },
  lander: { label: 'Land 3 times', target: 3, key: 'landed' },
  tron: { label: 'Win 5 rounds', target: 5, key: 'wins' },
  flappy: { label: 'Earn the gold medal', target: 3, key: 'medal' },
  columns: { label: 'Combo x5', target: 5, key: 'combo' },
  crystalvault: { label: 'Reach level 4', target: 4, key: 'level' },
  match3: { label: 'Reach level 4', target: 4, key: 'level' },
  maze: { label: 'Reach level 4', target: 4, key: 'level' },
  minesweeper: { label: 'Reach level 3', target: 3, key: 'level' },
  lightsout: { label: 'Reach level 4', target: 4, key: 'level' },
  sliding: { label: 'Reach level 3', target: 3, key: 'level' },
  flood: { label: 'Reach level 3', target: 3, key: 'level' },
  lasermaze: { label: 'Reach level 4', target: 4, key: 'level' },
  gearlock: { label: 'Reach level 5', target: 5, key: 'level' },
  memorypath: { label: 'Recall 8 steps', target: 8, key: 'level' },
  simon: { label: 'Reach length 12', target: 12, key: 'len' },
  echorunner: { label: 'Recall length 10', target: 10, key: 'length' },
  runereactor: { label: 'Chain x6', target: 6, key: 'chain' },
  starforge: { label: 'Combo x8', target: 8, key: 'combo' },
  targettap: { label: 'Combo x10', target: 10, key: 'combo' },
  neonrush: { label: 'Combo x10', target: 10, key: 'combo' },
  dodger: { label: 'Survive 60s', target: 60, key: 'time' },
  driftracer: { label: 'Clear 20 gates', target: 20, key: 'gates' },
  dualoop: { label: 'Reach zone 5', target: 5, key: 'zone' },
  polara: { label: 'Reach zone 5', target: 5, key: 'zone' },
  higherlower: { label: 'Streak of 10', target: 10, key: 'streak' },
  colorclash: { label: 'Streak of 15', target: 15, key: 'streak' },
  wordmix: { label: 'Streak of 8', target: 8, key: 'streak' },
  quickmath: { label: 'Solve 20', target: 20, key: 'solved' },
  numberhunt: { label: 'Reach level 3', target: 3, key: 'level' },
  reversi: { label: 'Own 40 discs', target: 40, key: 'discs' },
  mastermind: { label: 'Crack round 5', target: 5, key: 'round' },
  hangman: { label: 'Reach round 5', target: 5, key: 'round' },
  lockpick: { label: 'Open 5 locks', target: 5, key: 'locks' },
  stacker: { label: 'Stack 15 blocks', target: 15, key: 'height' },
  yahtzee: { label: 'Score a 30 combo', target: 30, key: 'combo' },
  helicopter: { label: 'Fly 1500m', target: 1500, key: 'dist' },
  blackjack: { label: 'Survive 10 rounds', target: 10, key: 'rounds' },
  chainreaction: { label: 'Reach level 3', target: 3, key: 'level' },
  connectfour: { label: 'Beat the CPU', target: 1, key: 'won' },
  tictactoe: { label: 'Beat the CPU', target: 1, key: 'won' },
  cometputt: { label: 'Sink 5 holes', target: 5, key: 'holes' },
};

function masteryGoalsFor(game: GameMeta): MasteryGoal[] {
  const scoreTarget = rewardFor(game).targetScore;
  const goals: MasteryGoal[] = [
    { id: `${game.id}-bronze`, label: `Score ${Math.round(scoreTarget * 0.5)}`, target: Math.round(scoreTarget * 0.5), metric: 'score' },
    { id: `${game.id}-silver`, label: `Score ${scoreTarget}`, target: scoreTarget, metric: 'score' },
    { id: `${game.id}-gold`, label: `Score ${Math.round(scoreTarget * 1.8)}`, target: Math.round(scoreTarget * 1.8), metric: 'score' },
  ];
  // Mechanic-specific gold goal, keyed to the `custom` payload each game emits on game over,
  // so mastery rewards real skill (waves, levels, combos, streaks) rather than raw score.
  const gold = MASTERY_GOLD[game.id];
  if (gold) {
    goals[2] = { id: `${game.id}-gold`, label: gold.label, target: gold.target, metric: 'custom', customKey: gold.key };
  }
  return goals;
}

function dailyRulesFor(game: GameMeta): DailyRules {
  const allowedModifiers: DailyRules['allowedModifiers'] =
    game.group === 'Brain' || game.kit === 'standalone'
      ? ['classic', 'zen']
      : game.group === 'Shooter' || game.group === 'Skill' || game.group === 'Jump'
        ? ['classic', 'turbo', 'sudden']
        : ['classic', 'turbo', 'zen'];
  return { allowedModifiers, targetScore: Math.round(rewardFor(game).targetScore * 0.8) };
}

function polishFor(game: GameMeta): GamePolish {
  const release: GamePolish['release'] = NEON_ORIGINALS.has(game.id) ? 'featured' : CLASSICS.has(game.id) ? 'classic' : 'new';
  const tips = tipsFor(game);
  const modes: GameMode[] = ['practice', 'challenge'];
  if (['Arcade', 'Skill', 'Shooter', 'Paddle', 'Jump', 'Physics'].includes(game.group)) modes.push('endless');
  return {
    release,
    hotScore: Math.round(rewardFor(game).targetScore * 1.25),
    previewSpeed: game.group === 'Skill' || game.group === 'Shooter' || game.group === 'Jump' ? 'fast' : game.group === 'Brain' ? 'calm' : 'medium',
    tips,
    modes,
  };
}

function tipsFor(game: GameMeta): string[] {
  const generic = [
    `Watch the ${game.group.toLowerCase()} rhythm before chasing risky points.`,
    `Your next mastery target is usually safer than one huge run.`,
  ];
  if (game.kit === 'grid') return ['Plan one move ahead before committing.', 'Use corners and lanes to keep escape routes open.', ...generic];
  if (game.kit === 'shooter') return ['Prioritize threats closest to the breach line.', 'Short controlled movement beats panic dodging.', ...generic];
  if (game.kit === 'paddle') return ['Hit near the paddle edge to change the angle.', 'Recover center position after every risky save.', ...generic];
  if (game.kit === 'vector') return ['Feather inputs instead of holding them forever.', 'Momentum is a resource; spend it deliberately.', ...generic];
  if (game.kit === 'sidescroll') return ['Tap early and correct gently.', 'Coins are optional if the route is unsafe.', ...generic];
  return ['Read the board before the timer pressures you.', 'A clean streak beats a rushed mistake.', ...generic];
}

for (const game of GAMES) {
  game.controls ??= controlsForGame({ id: game.id, kit: game.kit, orientation: game.orientation });
  game.difficulty ??= 'variable';
  game.tags ??= [game.group.toLowerCase(), game.kit];
  game.cover ??= { kind: 'generated', motif: coverMotif(game.kit, game.group) };
  game.defaultHud ??= defaultHudForKit(game.kit);
  game.tutorialSteps ??= tutorialFor(game);
  game.collections ??= collectionsFor(game);
  game.sessionLength ??= sessionLengthFor(game);
  game.reward ??= rewardFor(game);
  game.masteryGoals ??= masteryGoalsFor(game);
  game.dailyRules ??= dailyRulesFor(game);
  game.polish ??= polishFor(game);
}
