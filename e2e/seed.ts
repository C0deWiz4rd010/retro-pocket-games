import type { Page } from '@playwright/test';

export interface Seed {
  settings?: Record<string, unknown>;
  /** Skip onboarding and the per-game tutorial overlays. */
  skipIntro?: boolean;
}

/**
 * Pre-populates the app's IndexedDB (idb-keyval's default store) before it boots, so tests can
 * start in a given skin/shell/theme without clicking through Settings. Values are validated with
 * defaults by the app's zod schemas, so partial objects are fine.
 */
export async function seedApp(page: Page, seed: Seed): Promise<void> {
  await page.addInitScript((s) => {
    const open = indexedDB.open('keyval-store');
    open.onupgradeneeded = () => open.result.createObjectStore('keyval');
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('keyval', 'readwrite');
      const store = tx.objectStore('keyval');
      if (s.settings) store.put({ locale: 'en', ...s.settings }, 'rp:settings:_');
      if (s.skipIntro) {
        store.put({ onboardedV1: true, tutorialsSeen: ['__all__'] }, 'rp:prefs:_');
      }
      db.close();
    };
  }, seed);
}
