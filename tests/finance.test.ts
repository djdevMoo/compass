// End-to-end check of the money maths using a fictional sample plan.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// The browser storage fallback needs localStorage; give it an in-memory one.
const mem = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
});

let mod: {
  finance: typeof import('../src/lib/finance.svelte').finance;
  logPayday: typeof import('../src/lib/finance.svelte').logPayday;
  addSpend: typeof import('../src/lib/finance.svelte').addSpend;
  db: typeof import('../src/lib/store.svelte').db;
  settings: typeof import('../src/lib/store.svelte').settings;
};

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 23, 19, 30)); // Fri 23 Oct 2026
  const store = await import('../src/lib/store.svelte');
  const fin = await import('../src/lib/finance.svelte');
  const { seedSamplePlan } = await import('./fixtures/sample-plan');
  await store.boot();
  seedSamplePlan();
  mod = { finance: fin.finance, logPayday: fin.logPayday, addSpend: fin.addSpend, db: store.db, settings: store.settings };
});

afterAll(() => {
  vi.useRealTimers();
});

describe('seeded plan', () => {
  it('adds up the goal: €2,700 saved, €7,300 to go, €500 per payday', () => {
    expect(mod.finance.goalTotal).toBe(270_000);
    expect(mod.finance.remaining).toBe(730_000);
    expect(mod.finance.savePerPay).toBe(50_000);
  });

  it('splits the €1,400 paycheck exactly', () => {
    expect(mod.finance.splitTotal).toBe(140_000);
    expect(mod.finance.unassigned).toBe(0);
  });

  it('needs 15 paydays; with paydays from 30 Oct the 15th is 14 May 2027', () => {
    mod.settings.set({ payAnchor: '2026-10-16' });
    expect(mod.finance.paychecksNeeded).toBe(15);
    expect(mod.finance.eta).toBe('2027-05-14');
  });

  it('puts the €4k and €7k checkpoints on the 3rd and 9th paydays', () => {
    const [a, b] = mod.finance.checkpoints;
    expect(a.amount).toBe(400_000);
    expect(b.amount).toBe(700_000);
    expect(a.date).toBe('2026-11-27');
    expect(b.date).toBe('2027-02-19');
  });

  it('bills come to €115 a month, about €53 per paycheck', () => {
    expect(mod.finance.billsMonthly).toBe(11_500);
    expect(mod.finance.billsPerPay).toBe(5_300);
  });
});

describe('payday and spending', () => {
  it('logging a payday moves money in, and undo puts it back', () => {
    const savings = mod.db.accounts.items.find((a) => a.name === 'Savings')!;
    const undo = mod.logPayday('2026-10-23', 50_000, savings.id);
    expect(mod.finance.goalTotal).toBe(320_000);
    expect(mod.db.balances.get('2026-10-23')?.total).toBe(320_000);
    undo();
    expect(mod.finance.goalTotal).toBe(270_000);
    expect(mod.db.contributions.items).toHaveLength(0);
  });

  it('spends reduce the right envelope for this pay period only', () => {
    const fun = mod.db.budget.items.find((b) => b.name === 'Fun')!;
    mod.addSpend(2_500, fun.id, 'Takeout', '2026-10-20');
    mod.addSpend(9_999, fun.id, 'Last period', '2026-10-10');
    const env = mod.finance.envelopes.find((e) => e.line.id === fun.id)!;
    expect(env.spent).toBe(2_500);
    expect(env.left).toBe(12_500);
  });
});
