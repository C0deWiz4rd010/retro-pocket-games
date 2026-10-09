import { expect, test } from '@playwright/test';
import { bootApp, gameIds, launchGame, leaveGame } from './helpers';

const IDS = gameIds();

/** Mount/unmount every game; the JS heap must not keep growing unboundedly. */
test('heap stays bounded across all games', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP heap metrics are Chromium-only');
  test.setTimeout(IDS.length * 8_000 + 60_000);
  await page.setViewportSize({ width: 375, height: 812 });
  const cdp = await page.context().newCDPSession(page);
  await bootApp(page);

  const heapMB = async (): Promise<number> => {
    await cdp.send('HeapProfiler.collectGarbage');
    const { usedSize } = (await cdp.send('Runtime.getHeapUsage')) as { usedSize: number };
    return usedSize / 1024 / 1024;
  };

  // Warm up so lazy chunks, textures and fonts are loaded before measuring.
  for (const id of IDS.slice(0, 3)) {
    await launchGame(page, id);
    await leaveGame(page);
  }
  const start = await heapMB();
  for (const id of IDS) {
    await launchGame(page, id);
    await page.waitForTimeout(500);
    await leaveGame(page);
  }
  const end = await heapMB();
  console.info(`heap start=${start.toFixed(1)}MB end=${end.toFixed(1)}MB`);
  // Loaded game modules legitimately add some; a leak per mount would blow far past this.
  expect(end - start).toBeLessThan(40);
});
