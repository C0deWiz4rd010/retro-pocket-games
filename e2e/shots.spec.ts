import { test } from '@playwright/test';
import { VIEWPORTS, bootApp, launchGame } from './helpers';
import { seedApp } from './seed';

/**
 * Visual review helper, not a regression test: SHOTS=1 SHOT_DIR=... npx playwright test shots
 * writes screenshots for a skin × viewport × screen matrix.
 */
test.skip(!process.env.SHOTS, 'set SHOTS=1 to capture review screenshots');

const OUT = process.env.SHOT_DIR ?? 'shots';
const SKINS = (process.env.SKINS ?? 'launcher,console').split(',');
const VPS = (process.env.VPS ?? Object.keys(VIEWPORTS).join(',')).split(',');
const GAMES = (process.env.GAMES ?? 'snake').split(',');

for (const skin of SKINS)
  for (const vp of VPS)
    for (const game of GAMES) {
      test(`${skin} ${vp} ${game}`, async ({ page }) => {
        await page.setViewportSize(VIEWPORTS[vp as keyof typeof VIEWPORTS]);
        await seedApp(page, {
          settings: { skin, shell: process.env.SHELL_ID ?? 'brick' },
          skipIntro: true,
        });
        await bootApp(page);
        if (game === 'home') {
          await page.waitForTimeout(600);
          await page.screenshot({ path: `${OUT}/${skin}-${vp}-home.png` });
          return;
        }
        await launchGame(page, game);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${OUT}/${skin}-${vp}-${game}.png` });
      });
    }
