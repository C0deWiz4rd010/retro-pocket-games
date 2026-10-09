import { expect, test } from '@playwright/test';
import { bootApp, gameIds, launchGame, leaveGame, trackErrors } from './helpers';

const ALL_IDS = gameIds();
// GAME_IDS=pacman,tetris limits the run to specific games (handy while iterating on one game).
const ONLY = process.env.GAME_IDS?.split(',').filter(Boolean);
const IDS = ONLY?.length ? ALL_IDS.filter((id) => ONLY.includes(id)) : ALL_IDS;

test('registry parsing finds all games', () => {
  expect(ALL_IDS.length).toBeGreaterThanOrEqual(85);
});

test.describe('every game starts, runs 3s and tears down', () => {
  test.setTimeout(IDS.length * 12_000);

  test('all games', async ({ page }) => {
    const errors = trackErrors(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await bootApp(page);
    const failures: string[] = [];
    for (const id of IDS) {
      const before = errors.length;
      try {
        await launchGame(page, id);
        await page.waitForTimeout(3000);
        await leaveGame(page);
      } catch (e) {
        failures.push(`${id}: ${(e as Error).message.split('\n')[0]}`);
      }
      if (errors.length > before) failures.push(`${id}: ${errors.slice(before).join(' | ')}`);
    }
    expect(failures).toEqual([]);
  });
});
