import './styles/index.css';
import { registerSW } from 'virtual:pwa-register';
import { loadSettings, settings, updateSettings } from '@store/settings';
import { loadProfile } from '@store/profile';
import { loadAchievements } from '@store/achievements';
import { loadDaily } from '@store/dailyStore';
import { detectLocale } from '@i18n/index';
import { initPwaUx, offlineReadyToast } from '@app/pwa';
import { App } from '@app/App';

async function boot(): Promise<void> {
  await Promise.all([loadSettings(), loadProfile(), loadAchievements(), loadDaily()]);

  // First-run locale detection (German user → DE automatically).
  if (!localStorage.getItem('rp:localeSet')) {
    updateSettings({ locale: detectLocale() });
    localStorage.setItem('rp:localeSet', '1');
  }

  // Count sessions (drives the delayed install banner).
  localStorage.setItem('rp:sessions', String(Number(localStorage.getItem('rp:sessions') ?? '0') + 1));

  // Show the BIOS boot on the very first launch, or whenever the user opts in.
  const firstLaunch = !localStorage.getItem('rp:seen');
  if ((firstLaunch || settings().bios.showEachLaunch) && !location.hash) {
    location.hash = '#/bios';
  }
  localStorage.setItem('rp:seen', '1');

  initPwaUx();
  const app = new App();
  await app.init();
}

// Service worker: auto-update + offline-ready confirmation.
registerSW({ immediate: true, onOfflineReady: () => offlineReadyToast() });

void boot();
