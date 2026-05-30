import './styles/index.css';
import { loadSettings, settings } from '@store/settings';
import { loadProfile } from '@store/profile';
import { App } from '@app/App';

async function boot(): Promise<void> {
  await Promise.all([loadSettings(), loadProfile()]);

  // Show the BIOS boot on the very first launch, or whenever the user opts in.
  const firstLaunch = !localStorage.getItem('rp:seen');
  if ((firstLaunch || settings().bios.showEachLaunch) && !location.hash) {
    location.hash = '#/bios';
  }
  localStorage.setItem('rp:seen', '1');

  const app = new App();
  await app.init();
}

void boot();
