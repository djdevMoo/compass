// Test fixture: a fictional person's plan (made-up numbers), used to check the money maths.
// The app itself ships with no data; real users go through first-run setup.

import { db, settings, uid } from '../../src/lib/store.svelte';

export function seedSamplePlan(): void {
  const now = new Date().toISOString();

  [
    { name: 'Savings', balance: 210_000, kind: 'savings' as const },
    { name: 'Current account', balance: 42_000, kind: 'cash' as const },
    { name: 'Index fund', balance: 18_000, kind: 'invest' as const },
  ].forEach((a, order) => db.accounts.add({ id: uid(), inGoal: true, order, ...a }));

  [
    { name: 'Savings', amount: 50_000, kind: 'save' as const, note: 'Automatic transfer on payday' },
    { name: 'Rent', amount: 30_000, kind: 'fixed' as const, note: 'Paid on payday' },
    { name: 'Transport', amount: 8_000, kind: 'fixed' as const, note: '' },
    { name: 'Bills', amount: 7_000, kind: 'fixed' as const, note: 'Monthly bills, spread across paychecks' },
    { name: 'Groceries', amount: 13_000, kind: 'flex' as const, note: '' },
    { name: 'Daily spending', amount: 9_000, kind: 'flex' as const, note: '' },
    { name: 'Fun', amount: 15_000, kind: 'flex' as const, note: '' },
    { name: 'Buffer', amount: 8_000, kind: 'flex' as const, note: '' },
  ].forEach((b, order) => db.budget.add({ id: uid(), order, ...b }));

  [
    { name: 'Phone', monthly: 3_000, note: '' },
    { name: 'Internet', monthly: 2_500, note: '' },
    { name: 'Gym', monthly: 3_500, note: '' },
    { name: 'YouTube Premium', monthly: 1_400, note: '' },
    { name: 'Spotify', monthly: 1_100, note: '' },
  ].forEach((b, order) => db.bills.add({ id: uid(), active: true, order, ...b }));

  db.balances.put({ id: '2026-10-22', date: '2026-10-22', total: 270_000 });

  db.goals.add({
    id: uid(),
    title: 'Save €10,000',
    area: 'finance',
    why: '',
    targetDate: null,
    status: 'active',
    linked: 'savings',
    createdAt: now,
    order: 0,
    milestones: [{ id: uid(), text: 'Set up the automatic transfer for payday', done: false }],
  });

  settings.set({ lastPage: 'home', goalName: '€10k saved', goalTarget: 1_000_000, payAmount: 140_000 });
}
