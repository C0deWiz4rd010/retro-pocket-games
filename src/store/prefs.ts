import { signal } from './store';
import { read, write } from '@data/db';
import { PrefsSchema, type Prefs } from '@data/schemas';

const defaults = (): Prefs => PrefsSchema.parse({});
export const prefs = signal<Prefs>(defaults());

export async function loadPrefs(): Promise<void> {
  prefs.set(await read('prefs', '_', PrefsSchema, defaults()));
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
