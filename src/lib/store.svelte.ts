// Reactive, persistent app state. Every collection lives in memory (so the UI is
// instant) and writes through to the database in the background.

import { backend, writes } from './db';
import { setDateLocale, toISO } from './dates';
import { localeFor, setCurrency } from './money';
import { DEFAULT_ACCENT, normalizeHex } from './accent';
import type {
  Account, BalancePoint, Bill, BudgetLine, Contribution, DayLog, Goal, Meal, ModuleId,
  PlaybookItem, Settings, Spend, WeightEntry, Wish, Workout,
} from './types';

export const uid = (): string => crypto.randomUUID();

export interface Removed<T> {
  item: T;
  index: number;
}

export class Collection<T extends { id: string }> {
  items = $state<T[]>([]);

  constructor(readonly name: string) {}

  get(id: string): T | undefined {
    return this.items.find((x) => x.id === id);
  }

  add(item: T): T {
    this.items.push(item);
    this.save(item);
    return item;
  }

  /** Insert, or replace the record with the same id. */
  put(item: T): void {
    const i = this.items.findIndex((x) => x.id === item.id);
    if (i < 0) this.items.push(item);
    else this.items[i] = item;
    this.save(item);
  }

  update(id: string, patch: Partial<T>): void {
    const i = this.items.findIndex((x) => x.id === id);
    if (i < 0) return;
    const next = { ...($state.snapshot(this.items[i]) as T), ...patch };
    this.items[i] = next;
    this.save(next);
  }

  remove(id: string): Removed<T> | null {
    const index = this.items.findIndex((x) => x.id === id);
    if (index < 0) return null;
    const item = $state.snapshot(this.items[index]) as T;
    this.items.splice(index, 1);
    writes.push({ op: 'delete', collection: this.name, id });
    return { item, index };
  }

  restore(r: Removed<T>): void {
    this.items.splice(Math.min(r.index, this.items.length), 0, r.item);
    this.save(r.item);
  }

  hydrate(rows: T[]): void {
    this.items = rows;
  }

  private save(item: T): void {
    writes.push({ op: 'put', collection: this.name, id: item.id, data: $state.snapshot(item) });
  }
}

export const db = {
  accounts: new Collection<Account>('accounts'),
  budget: new Collection<BudgetLine>('budget'),
  bills: new Collection<Bill>('bills'),
  spends: new Collection<Spend>('spends'),
  contributions: new Collection<Contribution>('contributions'),
  balances: new Collection<BalancePoint>('balances'),
  playbook: new Collection<PlaybookItem>('playbook'),
  wishes: new Collection<Wish>('wishes'),
  goals: new Collection<Goal>('goals'),
  workouts: new Collection<Workout>('workouts'),
  weights: new Collection<WeightEntry>('weights'),
  meals: new Collection<Meal>('meals'),
  days: new Collection<DayLog>('days'),
};

export const ALL_MODULES: ModuleId[] = ['money', 'wishlist', 'goals', 'fitness', 'diet'];

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  currency: 'EUR',
  modules: [...ALL_MODULES],
  theme: 'dark',
  accent: DEFAULT_ACCENT,
  autoCheckUpdates: true,
  lastVersion: '',
  uiScale: 1,
  sidebarCollapsed: false,
  lastPage: 'home',

  payAmount: 105_000,
  payFrequency: 'biweekly',
  payAnchor: null,

  goalName: 'Savings goal',
  goalTarget: 1_000_000,
  emergencyBuffer: 50_000,
  takeoutCap: 2,
  wishCooldownHours: 72,

  kcalTarget: 2400,
  proteinTarget: 140,
  waterTarget: 8,
  workoutsPerWeek: 3,
};

class SettingsStore {
  v = $state<Settings>({ ...DEFAULT_SETTINGS });

  set(patch: Partial<Settings>): void {
    const currencyChanged = patch.currency !== undefined && patch.currency !== this.v.currency;
    Object.assign(this.v, patch);
    if (currencyChanged) applyLocale(this.v.currency);
    writes.push({ op: 'kv', key: 'settings', value: $state.snapshot(this.v) });
  }

  hydrate(raw: unknown): void {
    const saved = raw && typeof raw === 'object' ? (raw as Partial<Settings>) : {};
    this.v = {
      ...DEFAULT_SETTINGS,
      ...saved,
      modules: [...(saved.modules ?? DEFAULT_SETTINGS.modules)],
      accent: normalizeHex(saved.accent) ?? DEFAULT_ACCENT,
    };
    applyLocale(this.v.currency);
  }

  has(m: ModuleId): boolean {
    return this.v.modules.includes(m);
  }
}

function applyLocale(currency: string): void {
  setCurrency(currency);
  setDateLocale(localeFor(currency));
}

export const settings = new SettingsStore();

/** Ticks every 20s so countdowns stay fresh and "today" rolls over at midnight. */
class Clock {
  now = $state(Date.now());
  today = $derived(toISO(new Date(this.now)));
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => (this.now = Date.now()), 20_000);
    // Catch up straight away when the window wakes from sleep or is refocused.
    window.addEventListener('focus', () => (this.now = Date.now()));
  }
}

export const clock = new Clock();

/** Loads everything from disk. Returns true when this is a fresh install that needs setup. */
export async function boot(): Promise<boolean> {
  const snap = await backend.loadAll();
  const groups = new Map<string, unknown[]>();
  for (const d of snap.docs) {
    if (!d.data || typeof d.data !== 'object') continue;
    const list = groups.get(d.collection) ?? [];
    list.push(d.data);
    groups.set(d.collection, list);
  }
  for (const c of Object.values(db) as Collection<{ id: string }>[]) {
    c.hydrate((groups.get(c.name) ?? []) as { id: string }[]);
  }
  settings.hydrate(snap.kv.settings);
  // "seeded" is set once setup has run (older installs were seeded directly).
  return !snap.kv.seeded;
}

/** Marks setup as finished so it never shows again. */
export async function finishSetup(): Promise<void> {
  writes.push({ op: 'kv', key: 'seeded', value: true });
  await writes.flush();
}
