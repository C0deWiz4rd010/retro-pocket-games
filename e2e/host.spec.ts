import { expect, test } from '@playwright/test';
import { bootApp, launchGame, trackErrors } from './helpers';

test.describe('GameHost pause behaviour', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await bootApp(page);
    await launchGame(page, 'snake');
  });

  test('Enter is a game action and does not pause', async ({ page }) => {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    await expect(page.locator('[data-overlay]')).toHaveCount(0);
  });

  test('Escape pauses, and Escape again resumes via the countdown', async ({ page }) => {
    const errors = trackErrors(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-overlay] .quick-toggles')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-overlay] .quick-toggles')).toHaveCount(0);
    await expect(page.locator('[data-overlay]')).toHaveCount(0, { timeout: 5000 });
    expect(errors).toEqual([]);
  });

  test('sub-panel Back returns to the pause menu', async ({ page }) => {
    await page.keyboard.press('Escape');
    await page.locator('[data-overlay] .panel__row button').first().click();
    await expect(page.locator('[data-overlay] .quick-toggles')).toHaveCount(0);
    await page.locator('[data-overlay] .btn--primary').click();
    await expect(page.locator('[data-overlay] .quick-toggles')).toBeVisible();
  });
});

test('the canvas renders while a game runs (ticker is started by the host)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await bootApp(page);
  await launchGame(page, 'snake');
  await page.waitForTimeout(800);
  const shot = await page.locator('canvas').screenshot();
  // A blank/transparent canvas encodes to a tiny PNG; real game art is far larger.
  expect(shot.length).toBeGreaterThan(3000);
});
