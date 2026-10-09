import { signal } from './store';
import { read, write } from '@data/db';
import { PrefsSchema, type Prefs } from '@data/schemas';

const defaults = (): Prefs => PrefsSchema.parse({});
export const prefs = signal<Prefs>(defaults());

export async function loadPrefs(): Promise<void> {
  const loaded = await read('prefs', '_', PrefsSchema, defaults());
  // One-time migration: the name used to live in localStorage (outside backups/wipes).
  try {
    const legacy = localStorage.getItem('rp:name');
    if (legacy !== null) {
      if (!loaded.playerName) loaded.playerName = legacy.slice(0, 8);
      localStorage.removeItem('rp:name');
      prefs.set(loaded);
      persist();
      return;
    }
  } catch {
    /* storage blocked: nothing to migrate */
  }
  prefs.set(loaded);
}

export const playerName = (): string => prefs().playerName;

export function setPlayerName(name: string): void {
  prefs.set({ ...prefs(), playerName: name.slice(0, 8) });
  persist();
}

function persist(): void {
  void write('prefs', '_', prefs());
}

export const isFavorite = (id: string): boolean => prefs().favorites.includes(id);

export function toggleFavorite(id: string): boolean {
  const fav = prefs().favorites;
  const next = fav.includes(id) ? fav.filter((f) => f !== id) : [...fav, id];
  prefs.set({ ...prefs(), favorites: next });
  persist();
  return next.includes(id);
}

export const hasOnboarded = (): boolean => prefs().onboardedV1;

export function markOnboarded(): void {
  if (prefs().onboardedV1) return;
  prefs.set({ ...prefs(), onboardedV1: true });
  persist();
}

export const hasSeenTutorial = (id: string): boolean => prefs().tutorialsSeen.includes(id);

export function markTutorialSeen(id: string): void {
  if (hasSeenTutorial(id)) return;
  prefs.set({ ...prefs(), tutorialsSeen: [...prefs().tutorialsSeen, id] });
  persist();
}
