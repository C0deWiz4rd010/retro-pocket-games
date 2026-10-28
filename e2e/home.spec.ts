import { expect, test } from '@playwright/test';
import { bootApp, trackErrors } from './helpers';

test.describe('home screen patches instead of re-rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await bootApp(page);
  });

  test('chip, sort and favourite taps keep scroll position and the page shell', async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await page.evaluate(() => {
      (window as unknown as { __shell: Element | null }).__shell =
        document.querySelector('.landing');
    });
    const scroller = page.locator('.scroll.landing');
    await page.locator('.library-head').scrollIntoViewIfNeeded();

    await page.locator('.cat-chip[data-filter="duration:quick"]').click();
    await expect(page.locator('.cat-chip[data-filter="duration:quick"]')).toHaveClass(/is-active/);
    await page.locator('.cat-chip[data-sort="az"]').click();
    await expect(page.locator('.cat-chip[data-sort="az"]')).toHaveClass(/is-active/);

    const star = page.locator('.library-stage .tile__fav').first();
    await star.click();
    await expect(star).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.section-host .tile').first()).toBeVisible();

    const same = await page.evaluate(
      () =>
        (window as unknown as { __shell: Element | null }).__shell ===
        document.querySelector('.landing'),
    );
    expect(same).toBe(true);
    // the page was patched, not rebuilt: the scroller never lost its scroll position entirely
    expect(await scroller.evaluate((n) => n.scrollTop)).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('search filters after the debounce and clearing restores the list', async ({ page }) => {
    const tiles = page.locator('.library-stage .tile');
    const total = await tiles.count();
    await page.locator('input.search').fill('tetris');
    await expect.poll(() => tiles.count()).toBeLessThan(total);
    expect(await tiles.count()).toBeGreaterThan(0);
    await page.locator('input.search').fill('zzzzqqq');
    await expect(page.locator('.library-stage .empty-state')).toBeVisible();
    await page.locator('input.search').fill('');
    await expect.poll(() => tiles.count()).toBe(total);
  });
});
