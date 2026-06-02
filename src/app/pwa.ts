import { el } from '@utils/dom';
import { t } from '@i18n/index';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Custom install prompt + offline-ready toast. Captures `beforeinstallprompt`, then shows a
 * dismissible banner after the second session so it isn't pushy. See docs/05 §5.
 */
export function initPwaUx(): void {
  let deferred: BeforeInstallPromptEvent | null = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    const sessions = Number(localStorage.getItem('rp:sessions') ?? '0');
    if (sessions >= 2 && !localStorage.getItem('rp:installDismissed')) showInstallBanner();
  });

  function showInstallBanner(): void {
    if (document.querySelector('.install-banner')) return;
    const banner = el('div', { class: 'install-banner' }, [
      el('span', {}, ['🎮 ' + t('install.text')]),
      el('div', { class: 'install-banner__actions' }, [
        el('button', {
          class: 'btn btn--primary',
          onClick: async () => {
            banner.remove();
            if (!deferred) return;
            await deferred.prompt();
            await deferred.userChoice;
            deferred = null;
          },
        }, [t('install.cta')]),
        el('button', {
          class: 'iconbtn',
          'aria-label': 'Dismiss',
          onClick: () => {
            localStorage.setItem('rp:installDismissed', '1');
            banner.remove();
          },
        }, ['✕']),
      ]),
    ]);
    document.body.append(banner);
  }
}

/** Briefly confirm the app is cached for offline use (fired by the SW registration). */
export function offlineReadyToast(): void {
  const toast = el('div', { class: 'toast toast--offline' }, [`✓ ${t('offline.ready')}`]);
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 2600);
}

/**
 * Non-intrusive "new version available" banner. `reload` is provided by the SW registration
 * (updateSW) and activates the waiting worker before reloading. See docs/05 §4.
 */
export function updateReadyBanner(reload: () => void): void {
  if (document.querySelector('.install-banner')) return;
  const banner = el('div', { class: 'install-banner' }, [
    el('span', {}, ['↻ ' + t('update.text')]),
    el('div', { class: 'install-banner__actions' }, [
      el('button', { class: 'btn btn--primary', onClick: () => reload() }, [t('update.cta')]),
      el('button', {
        class: 'iconbtn',
        'aria-label': 'Dismiss',
        onClick: (e: Event) => (e.currentTarget as HTMLElement).closest('.install-banner')?.remove(),
      }, ['✕']),
    ]),
  ]);
  document.body.append(banner);
}
