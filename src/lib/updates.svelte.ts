// Update state for the UI. The main process does the actual checking and installing.

import { desktop, writes, type UpdateInfo } from './db';
import { settings } from './store.svelte';

const RECHECK_MS = 6 * 60 * 60 * 1000; // every 6 hours while the app stays open

class Updates {
  status = $state<'idle' | 'checking' | 'available' | 'current' | 'downloading' | 'error'>('idle');
  info = $state<UpdateInfo | null>(null);
  progress = $state(0);
  label = $state('');
  error = $state('');
  open = $state(false);
  lastChecked = $state<number | null>(null);
  private timer: ReturnType<typeof setInterval> | null = null;

  get supported(): boolean {
    return !!desktop;
  }

  async check(manual = false): Promise<void> {
    if (!desktop || this.status === 'checking' || this.status === 'downloading') return;
    this.status = 'checking';
    this.error = '';
    try {
      const info = await desktop.checkForUpdate();
      this.info = info;
      this.status = info.available ? 'available' : 'current';
      this.lastChecked = Date.now();
      if (info.available && manual) this.open = true;
    } catch (e) {
      // Offline or GitHub unreachable: only worth mentioning when the user asked.
      this.status = manual ? 'error' : 'idle';
      this.error = friendly(e);
    }
  }

  async install(): Promise<void> {
    if (!desktop || this.status === 'downloading') return;
    this.status = 'downloading';
    this.progress = 0;
    this.label = 'Starting download';
    this.error = '';
    desktop.onUpdateProgress((p, l) => {
      this.progress = p;
      this.label = l;
    });
    try {
      await writes.flush();
      await desktop.installUpdate();
      this.label = 'Restarting Compass';
      this.progress = 1;
    } catch (e) {
      this.status = 'error';
      this.error = friendly(e);
    }
  }

  /** Called once the app is open: first check after a short delay, then every few hours. */
  start(): void {
    if (!desktop || this.timer) return;
    const auto = () => {
      if (settings.v.autoCheckUpdates) void this.check();
    };
    setTimeout(auto, 8000);
    this.timer = setInterval(auto, RECHECK_MS);
  }
}

function friendly(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}

export const updates = new Updates();
