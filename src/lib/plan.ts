// Builds a starting paycheck split from a few answers in setup.
// Pure maths (no state), so it is easy to test. All money is integer cents.

import { diffDays, nthPayday, paychecksPerYear, paydayStep, parseISO } from './dates';
import type { BudgetKind, Cents, ISODate, PayFrequency } from './types';

export interface PlanInput {
  pay: Cents;
  freq: PayFrequency;
  rentMonthly: Cents;
  transportMonthly: Cents;
  groceriesWeekly: Cents;
  billsMonthly: Cents;
  /** Still to save towards the goal (target minus what is saved already). */
  goalRemaining: Cents;
  goalDate: ISODate | null;
  /** The first payday that money can be saved from. */
  firstPayday: ISODate;
  /** A savings amount chosen by the person, overriding the suggestion. */
  saveOverride?: Cents | null;
}

export interface PlanLine {
  name: string;
  amount: Cents;
  kind: BudgetKind;
  note: string;
}

export interface Plan {
  lines: PlanLine[];
  save: Cents;
  /** Money left after fixed costs and groceries, before saving. */
  free: Cents;
  /** How much costs exceed pay (0 when they fit). */
  shortfall: Cents;
  /** Saving needed per payday to hit the goal date (null without a date). */
  neededForDate: Cents | null;
}

const STEP = 500; // round suggestions to 5 currency units

const down = (c: Cents) => Math.max(0, Math.floor(c / STEP) * STEP);
const near = (c: Cents) => Math.max(0, Math.round(c / STEP) * STEP);
const up = (c: Cents) => Math.max(0, Math.ceil(c / STEP) * STEP);

/** Monthly amount → amount per paycheck. */
export function perPayFromMonthly(monthly: Cents, freq: PayFrequency): Cents {
  return near((monthly * 12) / paychecksPerYear(freq));
}

/** Weekly amount → amount per paycheck. */
export function perPayFromWeekly(weekly: Cents, freq: PayFrequency): Cents {
  return near((weekly * 52) / paychecksPerYear(freq));
}

/** Paydays from `first` up to and including `until`. */
export function paydaysUntil(first: ISODate, until: ISODate, freq: PayFrequency): number {
  if (until < first) return 0;
  const step = paydayStep(freq);
  if (step > 0) return Math.floor(diffDays(first, until) / step) + 1;
  const a = parseISO(first);
  const b = parseISO(until);
  let n = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
  // The last month only counts if its payday falls on or before `until`.
  if (nthPayday(first, n, freq) > until) n--;
  return Math.max(0, n);
}

export function buildPlan(i: PlanInput): Plan {
  const rent = perPayFromMonthly(i.rentMonthly, i.freq);
  const transport = perPayFromMonthly(i.transportMonthly, i.freq);
  const bills = perPayFromMonthly(i.billsMonthly, i.freq);
  const groceries = perPayFromWeekly(i.groceriesWeekly, i.freq);

  const free = i.pay - rent - transport - bills - groceries;
  const shortfall = Math.max(0, -free);

  let neededForDate: Cents | null = null;
  if (i.goalDate && i.goalRemaining > 0) {
    const n = paydaysUntil(i.firstPayday, i.goalDate, i.freq);
    neededForDate = n > 0 ? up(Math.ceil(i.goalRemaining / n)) : i.goalRemaining;
  }

  let save: Cents;
  if (free <= 0) save = 0;
  else if (i.saveOverride != null) save = Math.min(Math.max(0, i.saveOverride), free);
  else if (i.goalRemaining <= 0) save = down(free * 0.3);
  else if (neededForDate !== null) save = Math.min(neededForDate, down(free * 0.8));
  else save = down(free * 0.5);

  // Whatever is left becomes everyday spending, fun and a buffer, and the
  // buffer absorbs rounding so the plan always adds up to the paycheck exactly.
  const rest = Math.max(0, free - save);
  const daily = down(rest * 0.3);
  const fun = down(rest * 0.45);
  const buffer = rest - daily - fun;

  const lines: PlanLine[] = [
    { name: 'Savings', amount: save, kind: 'save', note: 'Moved out automatically the day pay lands' },
    { name: 'Rent', amount: rent, kind: 'fixed', note: 'Rent or housing' },
    { name: 'Transport', amount: transport, kind: 'fixed', note: '' },
    { name: 'Bills', amount: bills, kind: 'fixed', note: 'Bills and subscriptions, spread across paychecks' },
    { name: 'Groceries', amount: groceries, kind: 'flex', note: '' },
    { name: 'Daily spending', amount: daily, kind: 'flex', note: 'Coffee, snacks and small stuff' },
    { name: 'Fun', amount: fun, kind: 'flex', note: 'Games, going out and takeout come from here' },
    { name: 'Buffer', amount: buffer, kind: 'flex', note: 'Surprises; whatever is left moves to savings' },
  ].filter((l) => l.amount > 0 || l.kind === 'save') as PlanLine[];

  return { lines, save, free, shortfall, neededForDate };
}
