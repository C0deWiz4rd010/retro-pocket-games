import { expect, test } from '@playwright/test';
import { bootApp, launchGame, leaveGame, trackErrors } from './helpers';

/**
 * Batch 8.3: the differentiated concept games each have a signature mechanic driven by specific
 * inputs. This drives those inputs and checks nothing throws (the 85-game loop only idles).
 */
const SCRIPTS: Record<string, string[]> = {
  retrosnake: ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'],
  brickbreaker: ['Space', 'ArrowLeft', 'ArrowRight'],
  dotcollector: ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'],
  galacticinvaders: ['Space', 'KeyX', 'ArrowLeft', 'KeyX', 'Space', 'ArrowRight'],
  memorymatch: ['ArrowRight', 'Space', 'ArrowDown', 'Space', 'ArrowLeft', 'Space', 'KeyX'],
  pixeldash: ['Space', 'KeyX', 'Space', 'KeyX', 'ArrowDown'],
  jumpquest: ['Space', 'ArrowRight', 'Space', 'ArrowLeft'],
  turbodrift: ['Space', 'ArrowLeft', 'ArrowRight', 'Space'],
};

test.describe('signature mechanics', () => {
  for (const [id, keys] of Object.entries(SCRIPTS)) {
    test(`${id} responds to its special inputs without errors`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      const errors = trackErrors(page);
      await bootApp(page);
      await launchGame(page, id);
      await page.waitForTimeout(800);
      for (const k of keys) {
        // hold each key a little so charge / drift style mechanics actually engage
        await page.keyboard.down(k);
        await page.waitForTimeout(220);
        await page.keyboard.up(k);
        await page.waitForTimeout(80);
      }
      await page.waitForTimeout(600);
      await expect(page.locator('.hud')).toBeVisible();
      await leaveGame(page);
      expect(errors).toEqual([]);
    });
  }
});
