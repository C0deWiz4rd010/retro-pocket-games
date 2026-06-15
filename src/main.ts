import './styles/index.css';
import { registerSW } from 'virtual:pwa-register';
import { loadSettings, settings, updateSettings, onSettingsChange } from '@store/settings';
import { audio } from '@core/AudioManager';
import { screenFX } from '@core/ScreenFX';
import { loadProfile } from '@store/profile';
import { loadAchievements } from '@store/achievements';
import { loadDaily } from '@store/dailyStore';
import { loadPrefs } from '@store/prefs';
import { detectLocale } from '@i18n/index';
import { initPwaUx, offlineReadyToast, updateReadyBanner } from '@app/pwa';
import { showErrorScreen } from '@app/errorScreen';
import { App } from '@app/App';

async function boot(): Promise<void> {
  await Promise.all([loadSettings(), loadProfile(), loadAchievements(), loadDaily(), loadPrefs()]);

  // First-run system-preference detection (locale + reduced motion).
  if (!localStorage.getItem('rp:localeSet')) {
    updateSettings({ locale: detectLocale() });
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      updateSettings({ a11y: { ...settings().a11y, reducedMotion: true } });
    }
    localStorage.setItem('rp:localeSet', '1');
  }

  // Count sessions (drives the delayed install banner).
  localStorage.setItem('rp:sessions', String(Number(localStorage.getItem('rp:sessions') ?? '0') + 1));

  // Move older installs that still carried the old console default onto the new launcher landing.
  if (!location.hash && !localStorage.getItem('rp:launcherDefaultApplied') && settings().skin === 'console') {
    updateSettings({ skin: 'launcher' });
    localStorage.setItem('rp:launcherDefaultApplied', '1');
  }

  // Keep the launcher as the default landing page. BIOS remains opt-in.
  if (settings().bios.showEachLaunch && !location.hash) {
    location.hash = '#/bios';
  }
  localStorage.setItem('rp:seen', '1');

  // React to live settings changes: re-sync music + CRT shader.
  onSettingsChange(() => {
    audio.syncMusic();
    screenFX.apply();
  });

  initPwaUx();
  const app = new App();
  await app.init();
}

// Service worker: prompt to refresh when a new build is waiting + offline-ready confirmation.
const updateSW = registerSW({
  immediate: true,
  onOfflineReady: () => offlineReadyToast(),
  onNeedRefresh: () => updateReadyBanner(() => void updateSW(true)),
});

// Global safety net — surface a friendly screen instead of a blank page on a fatal error.
window.addEventListener('error', (e) => showErrorScreen(String(e.error?.stack ?? e.message)));
window.addEventListener('unhandledrejection', (e) =>
  showErrorScreen(String((e.reason as Error)?.stack ?? e.reason)),
);

boot().catch((err: unknown) => showErrorScreen(String((err as Error)?.stack ?? err)));
