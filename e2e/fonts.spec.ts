import { expect, test } from '@playwright/test';
import { bootApp } from './helpers';

test('fonts are self-hosted: no third-party requests, all families load', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.hostname !== 'localhost' && u.protocol.startsWith('http')) external.push(r.url());
  });
  await bootApp(page);
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() =>
    [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')),
  );
  expect(loaded).toEqual(expect.arrayContaining(['Inter', 'Press Start 2P']));
  expect(external).toEqual([]);
});
