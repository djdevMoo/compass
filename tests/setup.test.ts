// First-run setup turns answers into a personalised app.
import { beforeAll, describe, expect, it, vi } from 'vitest';

const mem = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
});

type Store = typeof import('../src/lib/store.svelte');
type Setup = typeof import('../src/setup/setup');
let store: Store;
let setup: Setup;

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 23, 12, 0));
  store = await import('../src/lib/store.svelte');
  setup = await import('../src/setup/setup');
});

describe('setup', () => {
  it('a fresh install needs setup', async () => {
    expect(await store.boot()).toBe(true);
  });

  it('builds the app from the answers', async () => {
    const a = setup.defaultAnswers();
    Object.assign(a, {
      name: 'Sam',
      currency: 'GBP',
      modules: ['money', 'wishlist', 'diet'],
      pay: 180_000,
      freq: 'monthly',
      payday: '2026-10-28',
      goalName: 'House deposit',
      goalTarget: 2_000_000,
      saved: 250_000,
      rent: 75_000,
      transport: 12_000,
      groceries: 6_000,
      cooldownHours: 48,
      takeoutCap: 3,
      accent: '#fb923c',
    });
    a.bills[0].monthly = 2_500;
    a.bills[1].monthly = 3_000;
    await setup.applySetup(a);

    const s = store.settings.v;
    expect(s.name).toBe('Sam');
    expect(s.currency).toBe('GBP');
    expect(s.modules).toEqual(['money', 'wishlist', 'diet']);
    expect(s.payAmount).toBe(180_000);
    expect(s.payAnchor).toBe('2026-10-28');
    expect(s.goalTarget).toBe(2_000_000);
    expect(s.wishCooldownHours).toBe(48);
    expect(s.accent).toBe('#fb923c');

    expect(store.db.accounts.items).toHaveLength(1);
    expect(store.db.accounts.items[0].balance).toBe(250_000);
    const budgetTotal = store.db.budget.items.reduce((t, b) => t + b.amount, 0);
    expect(budgetTotal).toBe(180_000);
    expect(store.db.bills.items.map((b) => b.name)).toEqual(['Phone', 'Internet']); // empty "Streaming" skipped

    const goal = store.db.goals.items.find((g) => g.linked === 'savings');
    expect(goal?.title).toBe('House deposit');
    expect(store.db.playbook.items.some((p) => p.text.startsWith('48-hour rule'))).toBe(true);
    expect(store.db.playbook.items.some((p) => p.text.includes('3 per paycheck'))).toBe(true);
    expect(store.settings.has('fitness')).toBe(false);
  });

  it('remembers that setup is done', async () => {
    expect(await store.boot()).toBe(false);
  });
});
