import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { bootApp } from './helpers';
import { seedApp } from './seed';

const VIEWS = ['', 'settings', 'achievements', 'scores', 'profile', 'about'];

for (const theme of ['cyberpunk', 'gameboy', 'c64', 'amber']) {
  test(`no serious axe violations on home @ ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await seedApp(page, { settings: { theme }, skipIntro: true });
    await bootApp(page);
    await page.waitForTimeout(600);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(
      bad.map((v) => `${v.id}: ${v.nodes.length} nodes, e.g. ${v.nodes[0]?.target.join(' ')}`),
    ).toEqual([]);
  });
}

for (const view of VIEWS.slice(1)) {
  test(`no serious axe violations on #/${view}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await seedApp(page, { skipIntro: true });
    await bootApp(page);
    await page.evaluate((v) => (location.hash = `#/${v}`), view);
    await page.waitForTimeout(700);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(
      bad.map((v) => `${v.id}: ${v.nodes.length} nodes, e.g. ${v.nodes[0]?.target.join(' ')}`),
    ).toEqual([]);
  });
}

test('closed drawer is inert; opens with focus inside and closes on Escape', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await seedApp(page, { skipIntro: true });
  await bootApp(page);
  const nav = page.locator('nav.nav');
  await expect(nav).toHaveJSProperty('inert', true);
  const menu = page.locator('.topbar__menu').first();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  await expect(nav).toHaveJSProperty('inert', false);
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  expect(await nav.evaluate((n) => n.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(nav).toHaveJSProperty('inert', true);
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
});

test('a game tile is a real link reachable by keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await seedApp(page, { skipIntro: true });
  await bootApp(page);
  const link = page.locator('a.tile__hit').first();
  await link.focus();
  await expect(link).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/play\//);
});

test('pinch zoom is not disabled', async ({ page }) => {
  await bootApp(page);
  const content = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(content).not.toMatch(/user-scalable=no|maximum-scale/);
});
