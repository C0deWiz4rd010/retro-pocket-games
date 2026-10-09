import { expect, test } from '@playwright/test';
import { VIEWPORTS, bootApp, gameIds, trackErrors } from './helpers';

for (const [name, size] of Object.entries(VIEWPORTS)) {
  test(`boots without errors and shows every game @ ${name}`, async ({ page }) => {
    await page.setViewportSize(size);
    const errors = trackErrors(page);
    await bootApp(page);
    await expect
      .poll(() => page.locator('.tile').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(gameIds().length); // featured/favorite sections repeat tiles
    // No horizontal page scroll at any viewport.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}
