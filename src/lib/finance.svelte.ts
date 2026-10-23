// Money maths shared by the dashboard and the Money page.

import { clock, db, settings, uid } from './store.svelte';
import { addDays, nthPayday, payPeriod, paychecksPerYear, weekStart } from './dates';
import type { BudgetLine, Cents, ISODate } from './types';

export interface Envelope {
  line: BudgetLine;
  spent: Cents;
  left: Cents;
  used: number; // 0..1+
}

class Finance {
  goalTotal = $derived(db.accounts.items.filter((a) => a.inGoal).reduce((s, a) => s + a.balance, 0));
  allTotal = $derived(db.accounts.items.reduce((s, a) => s + a.balance, 0));
  target = $derived(settings.v.goalTarget);
  remaining = $derived(Math.max(0, this.target - this.goalTotal));
  progress = $derived(this.target > 0 ? Math.min(1, this.goalTotal / this.target) : 0);

  budgetSorted = $derived([...db.budget.items].sort((a, b) => a.order - b.order));
  savePerPay = $derived(db.budget.items.filter((b) => b.kind === 'save').reduce((s, b) => s + b.amount, 0));
  splitTotal = $derived(db.budget.items.reduce((s, b) => s + b.amount, 0));
  unassigned = $derived(settings.v.payAmount - this.splitTotal);

  period = $derived(payPeriod(settings.v.payFrequency, settings.v.payAnchor, clock.today));

  /** Payday for the first contribution still to come. */
  firstPayday = $derived.by<ISODate>(() => {
    const p = this.period;
    const today = clock.today;
    const loggedToday = db.contributions.items.some((c) => c.date === today);
    return p.known && p.start === today && !loggedToday ? today : p.next;
  });

  paychecksNeeded = $derived(this.paychecksFor(this.savePerPay));
  eta = $derived(this.etaFor(this.savePerPay));

  billsMonthly = $derived(db.bills.items.filter((b) => b.active).reduce((s, b) => s + b.monthly, 0));
  /** Estimate, rounded to the euro. */
  billsPerPay = $derived(Math.round((this.billsMonthly * 12) / paychecksPerYear(settings.v.payFrequency) / 100) * 100);

  periodSpends = $derived(
    db.spends.items.filter((s) => s.date >= this.period.start && s.date < this.period.next),
  );

  /** Spending envelopes for this pay period (everything except savings). */
  envelopes = $derived.by<Envelope[]>(() => {
    const spent = new Map<string, number>();
    for (const s of this.periodSpends) if (s.budgetId) spent.set(s.budgetId, (spent.get(s.budgetId) ?? 0) + s.amount);
    return this.budgetSorted
      .filter((l) => l.kind !== 'save')
      .map((line) => {
        const used = spent.get(line.id) ?? 0;
        return { line, spent: used, left: line.amount - used, used: line.amount > 0 ? used / line.amount : used > 0 ? 1 : 0 };
      });
  });

  flexLeft = $derived(this.envelopes.filter((e) => e.line.kind === 'flex').reduce((s, e) => s + e.left, 0));
  periodSpent = $derived(this.periodSpends.reduce((s, x) => s + x.amount, 0));

  /** Takeout is capped per pay period, or per week when the Money tab is off. */
  takeoutWindow = $derived.by(() => {
    if (settings.has('money')) return { start: this.period.start, end: this.period.next, label: 'this pay period' };
    const start = weekStart(clock.today);
    return { start, end: addDays(start, 7), label: 'this week' };
  });

  takeoutsThisPeriod = $derived(
    db.meals.items.filter((m) => m.takeout && m.date >= this.takeoutWindow.start && m.date < this.takeoutWindow.end).length,
  );

  /** Checkpoints at 40% and 70% of the goal (4k and 7k for a 10k goal). */
  checkpoints = $derived(
    [0.4, 0.7].map((f) => {
      const amount = Math.round((this.target * f) / 10_000) * 10_000; // round to 100 (in the currency)
      const short = Math.max(0, amount - this.goalTotal);
      const n = this.savePerPay > 0 ? Math.ceil(short / this.savePerPay) : Infinity;
      const date = short === 0 ? null : Number.isFinite(n) ? nthPayday(this.firstPayday, n, settings.v.payFrequency) : null;
      return { amount, reached: short === 0, date };
    }),
  );

  paychecksFor(perPay: Cents): number {
    if (this.remaining === 0) return 0;
    return perPay > 0 ? Math.ceil(this.remaining / perPay) : Infinity;
  }

  etaFor(perPay: Cents): ISODate | null {
    const n = this.paychecksFor(perPay);
    if (n === 0) return clock.today;
    if (!Number.isFinite(n)) return null;
    return nthPayday(this.firstPayday, n, settings.v.payFrequency);
  }

  /** Planned path from today's total to the goal, one point per payday. */
  projection = $derived.by(() => {
    const pts: { date: ISODate; total: Cents }[] = [{ date: clock.today, total: this.goalTotal }];
    if (this.savePerPay <= 0) return pts;
    let total = this.goalTotal;
    let n = 1;
    while (total < this.target && n <= 120) {
      total = Math.min(this.target, total + this.savePerPay);
      pts.push({ date: nthPayday(this.firstPayday, n, settings.v.payFrequency), total });
      n++;
    }
    return pts;
  });

  history = $derived([...db.balances.items].sort((a, b) => (a.date < b.date ? -1 : 1)));
}

export const finance = new Finance();

/** Stores today's goal total so the progress chart has real history. */
export function recordBalance(): void {
  const today = clock.today;
  db.balances.put({ id: today, date: today, total: finance.goalTotal });
}

export function adjustAccount(accountId: string, delta: Cents): void {
  const acc = db.accounts.get(accountId);
  if (!acc) return;
  db.accounts.update(accountId, { balance: acc.balance + delta });
  recordBalance();
}

/** Moves the payday saving into a goal account. Returns an undo function. */
export function logPayday(date: ISODate, amount: Cents, accountId: string): () => void {
  const prevAnchor = settings.v.payAnchor;
  const c = db.contributions.add({ id: uid(), date, amount, accountId, note: 'Payday' });
  adjustAccount(accountId, amount);
  if (!prevAnchor) settings.set({ payAnchor: date });
  return () => {
    db.contributions.remove(c.id);
    adjustAccount(accountId, -amount);
    if (!prevAnchor) settings.set({ payAnchor: null });
  };
}

export function addSpend(amount: Cents, budgetId: string | null, note: string, date: ISODate) {
  return db.spends.add({ id: uid(), date, amount, budgetId, note, createdAt: new Date().toISOString() });
}
