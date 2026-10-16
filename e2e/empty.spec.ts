import { expect, test } from '@playwright/test';
import { bootApp } from './helpers';
import { seedApp } from './seed';

test('library empty state offers a way back', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await seedApp(page, { skipIntro: true });
  await bootApp(page);
  await page.locator('input[type="search"], input.search').first().fill('zzzzzzzzzz');
  const empty = page.locator('.empty-state');
  await expect(empty).toBeVisible();
  await empty.locator('.btn').click();
  await expect(page.locator('.empty-state')).toHaveCount(0);
  await expect(page.locator('.tile').first()).toBeVisible();
});
