import { signal } from './store';
import { read, write } from '@data/db';
import { AchievementsSchema, type Achievements } from '@data/schemas';
import { profile, addTokens } from './profile';
import { daily } from './dailyStore';
import { GAMES } from '@core/Registry';

/**
 * Declarative achievement system. Each achievement has a `test` that runs after every game
 * over against a context (the finished run + lifetime profile stats). This keeps the games
 * themselves untouched — they only emit `score` + a `custom` record, which we read here.
 */
export interface AchContext {
  gameId: string;
  score: number;
  custom: Record<string, number>;
  /** lifetime games played across all titles */
  gamesPlayed: number;
  /** number of distinct games played at least once */
  distinctGames: number;
  /** current daily streak */
  streak: number;
}

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
  tokens: number;
  secret?: boolean;
  test: (c: AchContext) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  // ── per-game milestones (read from each game's `custom` payload) ──
  { id: 'snake-50', title: 'Long Boi', desc: 'Reach length 50 in Snake', icon: '🐍', tokens: 5, test: (x) => x.gameId === 'snake' && (x.custom.length ?? 0) >= 50 },
  { id: 'tetris-tetris', title: 'Tetris!', desc: 'Clear 4 lines at once', icon: '🧱', tokens: 5, test: (x) => x.gameId === 'tetris' && (x.custom.lines ?? 0) >= 4 },
  { id: 'tetris-lv10', title: 'Speed Stacker', desc: 'Reach level 10 in Tetris', icon: '⚡', tokens: 8, test: (x) => x.gameId === 'tetris' && (x.custom.level ?? 0) >= 10 },
  { id: '2048-win', title: 'The Big Tile', desc: 'Reach 2048', icon: '🔢', tokens: 10, test: (x) => x.gameId === 'g2048' && (x.custom.best ?? 0) >= 2048 },
  { id: 'breakout-3', title: 'Brick Buster', desc: 'Clear 3 levels of Breakout', icon: '🧱', tokens: 6, test: (x) => x.gameId === 'breakout' && (x.custom.level ?? 0) >= 3 },
  { id: 'pong-win', title: 'Paddle Master', desc: 'Beat the CPU at Pong', icon: '🏓', tokens: 5, test: (x) => x.gameId === 'pong' && (x.custom.won ?? 0) >= 1 },
  { id: 'pong-rally', title: 'Rally King', desc: '15-hit rally in Pong', icon: '🔥', tokens: 6, test: (x) => x.gameId === 'pong' && (x.custom.rally ?? 0) >= 15 },
  { id: 'invaders-w3', title: 'Earth Defender', desc: 'Reach wave 3 in Space Invaders', icon: '👾', tokens: 6, test: (x) => x.gameId === 'invaders' && (x.custom.wave ?? 0) >= 3 },
  { id: 'asteroids-w5', title: 'Belt Runner', desc: 'Survive wave 5 in Asteroids', icon: '🚀', tokens: 8, test: (x) => x.gameId === 'asteroids' && (x.custom.wave ?? 0) >= 5 },
  { id: 'flappy-25', title: 'Frequent Flyer', desc: 'Score 25 in Flappy', icon: '🐤', tokens: 8, test: (x) => x.gameId === 'flappy' && x.score >= 25 },
  { id: 'pacman-clear', title: 'Maze Muncher', desc: 'Clear a Pac-Man maze', icon: '🟡', tokens: 10, test: (x) => x.gameId === 'pacman' && (x.custom.cleared ?? 0) >= 1 },
  { id: 'mines-clear', title: 'Bomb Squad', desc: 'Clear a Minesweeper board', icon: '💣', tokens: 8, test: (x) => x.gameId === 'minesweeper' && (x.custom.cleared ?? 0) >= 1 },
  { id: 'frogger-home', title: 'Home Free', desc: 'Fill all 5 homes in Frogger', icon: '🐸', tokens: 8, test: (x) => x.gameId === 'frogger' && (x.custom.homes ?? 0) >= 5 },
  { id: 'lander-perfect', title: 'Eagle Has Landed', desc: 'Land on a ×5 pad', icon: '🌙', tokens: 8, test: (x) => x.gameId === 'lander' && (x.custom.landed ?? 0) >= 1 && (x.custom.fuel ?? 0) >= 30 },
  { id: 'simon-10', title: 'Total Recall', desc: 'Reach length 10 in Simon', icon: '🎵', tokens: 6, test: (x) => x.gameId === 'simon' && x.score >= 10 },
  { id: 'tictactoe-draw', title: 'Unbeatable Foe', desc: 'Force a draw vs the CPU', icon: '⭕', tokens: 4, test: (x) => x.gameId === 'tictactoe' && (x.custom.won ?? 0) === 0 && x.score >= 400 },
  { id: 'connect4-win', title: 'Four Up', desc: 'Beat the CPU at Connect Four', icon: '🔴', tokens: 6, test: (x) => x.gameId === 'connectfour' && (x.custom.won ?? 0) >= 1 },
  { id: 'reversi-win', title: 'Disc Jockey', desc: 'Win a game of Reversi', icon: '⚫', tokens: 8, test: (x) => x.gameId === 'reversi' && x.score >= 500 },
  { id: 'lightsout-solve', title: 'Lights Out', desc: 'Solve a Lights Out board', icon: '💡', tokens: 6, test: (x) => x.gameId === 'lightsout' && (x.custom.moves ?? 99) >= 0 && x.score >= 50 },
  { id: 'pinball-5k', title: 'Silver Ball', desc: 'Score 5,000 in Pinball', icon: '🎰', tokens: 8, test: (x) => x.gameId === 'pinball' && x.score >= 5000 },
  { id: 'stacker-15', title: 'Sky High', desc: 'Stack 15 blocks', icon: '🧱', tokens: 6, test: (x) => x.gameId === 'stacker' && x.score >= 15 },

  // ── meta achievements (lifetime / cross-game) ──
  { id: 'first-play', title: 'Welcome, Player One', desc: 'Play your first game', icon: '🕹️', tokens: 2, test: () => true },
  { id: 'play-10', title: 'Getting Warmed Up', desc: 'Play 10 games', icon: '🎮', tokens: 5, test: (x) => x.gamesPlayed >= 10 },
  { id: 'play-100', title: 'Arcade Regular', desc: 'Play 100 games', icon: '🏆', tokens: 15, test: (x) => x.gamesPlayed >= 100 },
  { id: 'sampler', title: 'Variety Pack', desc: 'Try 10 different games', icon: '🎲', tokens: 8, test: (x) => x.distinctGames >= 10 },
  { id: 'collector', title: 'Cartridge Collector', desc: 'Try 25 different games', icon: '📼', tokens: 15, test: (x) => x.distinctGames >= 25 },
  { id: 'completionist', title: 'The Whole Pocket', desc: 'Play all 40 games', icon: '💎', tokens: 40, test: (x) => x.distinctGames >= GAMES.filter((g) => g.available).length },
  { id: 'streak-3', title: 'On a Roll', desc: '3-day daily streak', icon: '🔥', tokens: 10, test: (x) => x.streak >= 3 },
  { id: 'streak-7', title: 'Daily Devotion', desc: '7-day daily streak', icon: '🔥', tokens: 20, test: (x) => x.streak >= 7 },
];

const defaults = (): Achievements => AchievementsSchema.parse({});
export const achievements = signal<Achievements>(defaults());

export async function loadAchievements(): Promise<void> {
  achievements.set(await read('achievements', '_', AchievementsSchema, defaults()));
}

export const isUnlocked = (id: string): boolean => Boolean(achievements().unlocked[id]);
export const unlockedCount = (): number => Object.keys(achievements().unlocked).length;

/**
 * Progress (cur/target) for the incremental meta achievements, so the screen can show a
 * "12 / 25" hint on locked ones. Returns null for binary/one-shot achievements.
 */
export function achievementProgress(id: string): { cur: number; target: number } | null {
  const p = profile();
  const distinct = Object.keys(p.stats.perGamePlays).length;
  const available = GAMES.filter((g) => g.available).length;
  const best = daily().bestStreak;
  switch (id) {
    case 'play-10':
      return { cur: Math.min(p.stats.gamesPlayed, 10), target: 10 };
    case 'play-100':
      return { cur: Math.min(p.stats.gamesPlayed, 100), target: 100 };
    case 'sampler':
      return { cur: Math.min(distinct, 10), target: 10 };
    case 'collector':
      return { cur: Math.min(distinct, 25), target: 25 };
    case 'completionist':
      return { cur: Math.min(distinct, available), target: available };
    case 'streak-3':
      return { cur: Math.min(best, 3), target: 3 };
    case 'streak-7':
      return { cur: Math.min(best, 7), target: 7 };
    default:
      return null;
  }
}

/**
 * Evaluate all achievements after a run. Returns the achievements newly unlocked this call
 * (so the host can toast them); awards their token bounties and persists.
 */
export function evaluateAchievements(ctx: AchContext): Achievement[] {
  const state = achievements();
  const newlyUnlocked: Achievement[] = [];
  const unlocked = { ...state.unlocked };

  for (const a of ACHIEVEMENTS) {
    if (unlocked[a.id]) continue;
    let pass = false;
    try {
      pass = a.test(ctx);
    } catch {
      pass = false;
    }
    if (pass) {
      unlocked[a.id] = Date.now();
      newlyUnlocked.push(a);
    }
  }

  if (newlyUnlocked.length) {
    achievements.set({ ...state, unlocked });
    void write('achievements', '_', achievements());
    const bounty = newlyUnlocked.reduce((s, a) => s + a.tokens, 0);
    if (bounty > 0) addTokens(bounty);
  }
  return newlyUnlocked;
}

/** Build the live context for an evaluation from the current profile + a daily streak. */
export function buildContext(
  gameId: string,
  score: number,
  custom: Record<string, number>,
  streak: number,
): AchContext {
  const p = profile();
  const distinct = Object.keys(p.stats.perGamePlays).length;
  return {
    gameId,
    score,
    custom,
    gamesPlayed: p.stats.gamesPlayed,
    distinctGames: distinct,
    streak,
  };
}
