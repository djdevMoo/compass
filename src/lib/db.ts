// Storage backend. Inside the desktop app this talks to the SQLite store in the
// Electron main process; in a plain browser (UI development) it falls back to
// localStorage with the same API.

export interface DocRow {
  collection: string;
  id: string;
  data: unknown;
}

export interface Snapshot {
  docs: DocRow[];
  kv: Record<string, unknown>;
}

export type Op =
  | { op: 'put'; collection: string; id: string; data: unknown }
  | { op: 'delete'; collection: string; id: string }
  | { op: 'kv'; key: string; value: unknown };

interface Backend {
  loadAll(): Promise<Snapshot>;
  apply(ops: Op[]): Promise<void>;
}

export interface InstallInfo {
  /** 'install' when Compass.exe is running from a download folder and should install itself. */
  mode: 'install' | 'app';
  version: string;
  installedVersion: string | null;
  installDir: string;
}

/** Functions the Electron preload script exposes (see electron/preload.cjs). */
export interface DesktopBridge {
  loadAll(): Promise<Snapshot>;
  apply(ops: Op[]): Promise<void>;
  exportData(): Promise<string | null>;
  importData(): Promise<boolean>;
  backupNow(): Promise<string>;
  openDataFolder(): Promise<string>;
  dataDir(): Promise<string>;
  openExternal(url: string): Promise<void>;
  setTheme(source: 'dark' | 'light' | 'system', resolved: 'dark' | 'light'): Promise<void>;
  resetData(): Promise<void>;
  installInfo(): Promise<InstallInfo>;
  install(opts: { desktopShortcut: boolean }): Promise<void>;
  launchInstalled(): Promise<void>;
  onInstallProgress(fn: (progress: number, label: string) => void): void;
  onFlushRequest(fn: () => Promise<void>): void;
}

declare global {
  interface Window {
    compass?: DesktopBridge;
  }
}

export const desktop: DesktopBridge | null = typeof window !== 'undefined' ? (window.compass ?? null) : null;
export const isDesktop = desktop !== null;

const desktopBackend: Backend = {
  loadAll: () => desktop!.loadAll(),
  apply: (ops) => desktop!.apply(ops),
};

const LS_KEY = 'compass:db:v1';
interface LocalShape {
  docs: Record<string, Record<string, unknown>>;
  kv: Record<string, unknown>;
}

function readLocal(): LocalShape {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as LocalShape;
  } catch {
    /* fall through to an empty store */
  }
  return { docs: {}, kv: {} };
}

const localBackend: Backend = {
  async loadAll() {
    const s = readLocal();
    const docs: DocRow[] = [];
    for (const [collection, rows] of Object.entries(s.docs)) {
      for (const [id, data] of Object.entries(rows)) docs.push({ collection, id, data });
    }
    return { docs, kv: s.kv };
  },
  async apply(ops) {
    const s = readLocal();
    for (const o of ops) {
      if (o.op === 'put') (s.docs[o.collection] ??= {})[o.id] = o.data;
      else if (o.op === 'delete') delete s.docs[o.collection]?.[o.id];
      else s.kv[o.key] = o.value;
    }
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  },
};

export const backend: Backend = isDesktop ? desktopBackend : localBackend;

/**
 * Coalesces writes and sends them in order, one batch (one SQLite transaction) at a time.
 * Rapid edits to the same record collapse into a single write.
 */
class WriteQueue {
  private pending = new Map<string, Op>();
  private flushing: Promise<void> | null = null;
  private scheduled = false;
  onError: (e: unknown) => void = (e) => console.error(e);

  push(op: Op) {
    const key = op.op === 'kv' ? `kv\u0000${op.key}` : `${op.collection}\u0000${op.id}`;
    this.pending.delete(key); // re-insert so the newest write goes last
    this.pending.set(key, op);
    if (!this.scheduled) {
      this.scheduled = true;
      queueMicrotask(() => {
        this.scheduled = false;
        void this.flush();
      });
    }
  }

  async flush(): Promise<void> {
    while (this.flushing) await this.flushing;
    if (this.pending.size === 0) return;
    const ops = [...this.pending.values()];
    this.pending.clear();
    this.flushing = backend
      .apply(ops)
      .catch((e) => {
        // Put the failed writes back (unless newer ones replaced them) and report.
        for (const op of ops) {
          const key = op.op === 'kv' ? `kv\u0000${op.key}` : `${op.collection}\u0000${op.id}`;
          if (!this.pending.has(key)) this.pending.set(key, op);
        }
        this.onError(e);
      })
      .finally(() => {
        this.flushing = null;
      });
    await this.flushing;
  }

  get idle() {
    return this.pending.size === 0 && !this.flushing;
  }
}

export const writes = new WriteQueue();
