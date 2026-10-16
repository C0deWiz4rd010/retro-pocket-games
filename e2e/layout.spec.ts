import { expect, test } from '@playwright/test';
import { VIEWPORTS, bootApp, launchGame } from './helpers';
import { seedApp } from './seed';

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

for (const skin of ['launcher', 'console']) {
  for (const [name, size] of Object.entries(VIEWPORTS)) {
    test(`in-game HUD and controls fit the screen @ ${skin} ${name}`, async ({ page }) => {
      await page.setViewportSize(size);
      await seedApp(page, { settings: { skin }, skipIntro: true });
      await bootApp(page);
      await launchGame(page, 'tetris'); // D-pad + two action buttons

      const boxes = await page.evaluate(() => {
        const rect = (e: Element): Box => {
          const r = e.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        };
        const screen = document.querySelector('.screen');
        const dpad = document.querySelector('.touch .dpad');
        const actions = document.querySelector('.touch .actionbtns');
        const hud = [...document.querySelectorAll('.hud > *')].filter(
          (e) => (e as HTMLElement).offsetParent !== null,
        );
        return {
          screen: rect(screen!),
          dpad: dpad ? rect(dpad) : null,
          actions: actions ? rect(actions) : null,
          hud: hud.map(rect),
          pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });

      const inside = (b: Box): void => {
        expect(b.left).toBeGreaterThanOrEqual(boxes.screen.left - 1);
        expect(b.right).toBeLessThanOrEqual(boxes.screen.right + 1);
      };
      expect(boxes.pageOverflow).toBeLessThanOrEqual(0);
      for (const b of boxes.hud) inside(b);
      expect(boxes.dpad).not.toBeNull();
      expect(boxes.actions).not.toBeNull();
      inside(boxes.dpad!);
      inside(boxes.actions!);
      // The two pads must not overlap each other.
      expect(boxes.dpad!.right).toBeLessThanOrEqual(boxes.actions!.left + 1);
    });
  }
}
