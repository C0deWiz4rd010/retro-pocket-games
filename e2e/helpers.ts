import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

export const VIEWPORTS = {
  'phone-320': { width: 320, height: 568 },
  'phone-375': { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
  'phone-landscape': { width: 812, height: 375 },
} as const;

/** All game ids, parsed from the registry source (both `mk('id', …)` and `{ id: 'x' }` forms). */
export function gameIds(): string[] {
  const src = readFileSync('src/core/Registry.ts', 'utf8');
  const ids = new Set<string>();
  for (const m of src.matchAll(/mk\(\s*'([a-z0-9]+)'/g)) ids.add(m[1] as string);
  for (const m of src.matchAll(/^\s+id: '([a-z0-9]+)'/gm)) ids.add(m[1] as string);
  return [...ids];
}

/** Collects console errors and uncaught exceptions for the lifetime of a page. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

/** Loads the app and dismisses first-run onboarding if present. */
export async function bootApp(page: Page): Promise<void> {
  await page.goto('./#/');
  await expect(page.locator('.tile').first()).toBeVisible({ timeout: 20_000 });
  const skip = page.locator('.onboard__skip');
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

/** Opens a game from its start screen and dismisses the first-run tutorial. */
export async function launchGame(page: Page, id: string): Promise<void> {
  await page.evaluate((gid) => {
    location.hash = `#/play/${gid}`;
  }, id);
  const play = page.locator('.start-actions .btn--primary');
  await expect(play).toBeVisible({ timeout: 10_000 });
  await play.click();
  await expect(page.locator('.hud')).toBeVisible({ timeout: 15_000 });
  const tut = page.locator('.overlay .btn--primary');
  if (await tut.isVisible().catch(() => false)) await tut.click();
}

export async function leaveGame(page: Page): Promise<void> {
  await page.evaluate(() => {
    location.hash = '#/';
  });
  await expect(page.locator('.tile').first()).toBeVisible({ timeout: 10_000 });
}
