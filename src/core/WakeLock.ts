/**
 * Screen Wake Lock wrapper — keeps the display awake during play where supported.
 * Progressive: silently no-ops on browsers without the API. Re-acquires on visibility
 * regain (the OS drops the lock when the tab is hidden). See docs/05 §5.
 */
interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
}
interface WakeLockNavigator {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> };
}

class WakeLockManager {
  private sentinel: WakeLockSentinelLike | null = null;
  private wanted = false;

  constructor() {
    document.addEventListener('visibilitychange', () => {
      if (this.wanted && document.visibilityState === 'visible') void this.acquire();
    });
  }

  async request(): Promise<void> {
    this.wanted = true;
    await this.acquire();
  }

  async release(): Promise<void> {
    this.wanted = false;
    try {
      await this.sentinel?.release();
    } catch {
      /* ignore */
    }
    this.sentinel = null;
  }

  private async acquire(): Promise<void> {
    const nav = navigator as Navigator & WakeLockNavigator;
    if (!nav.wakeLock || this.sentinel) return;
    try {
      this.sentinel = await nav.wakeLock.request('screen');
    } catch {
      this.sentinel = null;
    }
  }
}

export const wakeLock = new WakeLockManager();
