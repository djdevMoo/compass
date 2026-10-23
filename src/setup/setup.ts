// Turns the answers from first-run setup into a personalised Compass.

import { ALL_MODULES, db, finishSetup, settings, uid } from '../lib/store.svelte';
import { buildPlan, type Plan } from '../lib/plan';
import { CURRENCIES, money } from '../lib/money';
import { payPeriod, todayISO } from '../lib/dates';
import type { Cents, ISODate, ModuleId, PayFrequency, Theme } from '../lib/types';

export interface BillAnswer {
  id: string;
  name: string;
  monthly: Cents | null;
}

export interface Answers {
  name: string;
  modules: ModuleId[];
  currency: string;

  pay: Cents | null;
  freq: PayFrequency;
  payday: ISODate | '';

  goalName: string;
  goalTarget: Cents | null;
  saved: Cents | null;
  goalDate: ISODate | '';

  rent: Cents | null; // monthly
  transport: Cents | null; // monthly
  groceries: Cents | null; // weekly
  bills: BillAnswer[];
  saveOverride: Cents | null;

  cooldownHours: number;
  workoutsPerWeek: number;
  weightKg: number | null;
  kcal: number;
  protein: number;
  water: number;
  takeoutCap: number;
  aspirations: string[];
  theme: Theme;
}

/** Best guess at someone's currency from their Windows language. */
function guessCurrency(): string {
  const lang = typeof navigator !== 'undefined' ? navigator.language : 'en-IE';
  const byLocale = CURRENCIES.find((c) => c.locale.toLowerCase() === lang.toLowerCase());
  if (byLocale) return byLocale.code;
  if (/^en-(GB|UK)/i.test(lang)) return 'GBP';
  if (/^en-US/i.test(lang)) return 'USD';
  return 'EUR';
}

export function defaultAnswers(): Answers {
  return {
    name: '',
    modules: [...ALL_MODULES],
    currency: guessCurrency(),
    pay: null,
    freq: 'biweekly',
    payday: '',
    goalName: 'Savings goal',
    goalTarget: 1_000_000,
    saved: null,
    goalDate: '',
    rent: null,
    transport: null,
    groceries: null,
    bills: [
      { id: uid(), name: 'Phone', monthly: null },
      { id: uid(), name: 'Internet', monthly: null },
      { id: uid(), name: 'Streaming', monthly: null },
    ],
    saveOverride: null,
    cooldownHours: 72,
    workoutsPerWeek: 3,
    weightKg: null,
    kcal: 2200,
    protein: 120,
    water: 8,
    takeoutCap: 2,
    aspirations: ['', '', ''],
    theme: 'dark',
  };
}

export const billsTotal = (a: Answers): Cents => a.bills.reduce((s, b) => s + (b.monthly ?? 0), 0);

/** The first payday that can be saved from: the given payday if it's today or later, else the next one. */
export function firstPaydayFor(a: Answers, today: ISODate = todayISO()): ISODate {
  if (!a.payday) return payPeriod(a.freq, null, today).next;
  if (a.payday >= today) return a.payday;
  return payPeriod(a.freq, a.payday, today).next;
}

export function planFor(a: Answers): Plan {
  return buildPlan({
    pay: a.pay ?? 0,
    freq: a.freq,
    rentMonthly: a.rent ?? 0,
    transportMonthly: a.transport ?? 0,
    groceriesWeekly: a.groceries ?? 0,
    billsMonthly: billsTotal(a),
    goalRemaining: Math.max(0, (a.goalTarget ?? 0) - (a.saved ?? 0)),
    goalDate: a.goalDate || null,
    firstPayday: firstPaydayFor(a),
    saveOverride: a.saveOverride,
  });
}

/** Writes everything. Runs once, at the end of setup. */
export async function applySetup(a: Answers): Promise<void> {
  const has = (m: ModuleId) => a.modules.includes(m);
  const today = todayISO();
  const now = new Date().toISOString();

  settings.set({
    name: a.name.trim(),
    currency: a.currency,
    modules: [...a.modules],
    theme: a.theme,
    lastPage: 'home',
    payAmount: a.pay ?? 0,
    payFrequency: a.freq,
    payAnchor: a.payday || null,
    goalName: a.goalName.trim() || 'Savings goal',
    goalTarget: a.goalTarget ?? 0,
    wishCooldownHours: a.cooldownHours,
    workoutsPerWeek: a.workoutsPerWeek,
    kcalTarget: a.kcal,
    proteinTarget: a.protein,
    waterTarget: a.water,
    takeoutCap: a.takeoutCap,
  });

  if (has('money')) {
    const plan = planFor(a);
    db.accounts.add({ id: uid(), name: 'Savings', balance: a.saved ?? 0, kind: 'savings', inGoal: true, order: 0 });
    plan.lines.forEach((l, order) => db.budget.add({ id: uid(), order, ...l }));
    a.bills
      .filter((b) => b.name.trim() && (b.monthly ?? 0) > 0)
      .forEach((b, order) => db.bills.add({ id: uid(), name: b.name.trim(), monthly: b.monthly!, note: '', active: true, order }));
    db.balances.put({ id: today, date: today, total: a.saved ?? 0 });

    const steps = [
      `Set up an automatic transfer of ${money(plan.save)} for payday`,
      'Log your first payday in Compass',
    ];
    if (has('wishlist')) steps.push('Put the next thing you want on the wishlist instead of buying it');
    db.goals.add({
      id: uid(),
      title: a.goalName.trim() || 'Savings goal',
      area: 'finance',
      why: '',
      targetDate: a.goalDate || null,
      status: 'active',
      linked: 'savings',
      createdAt: now,
      order: 0,
      milestones: steps.map((text) => ({ id: uid(), text, done: false })),
    });

    const rules: [string, string][] = [
      ['Always', 'Move savings out the moment pay lands, then live on what is left.'],
      ['Always', 'Any raise, bonus or refund goes straight to savings and pulls the date forward.'],
      ['Daily small spends', 'Give daily spending its own card or pot. When it is empty, you are done until payday.'],
      ['Daily small spends', 'For two weeks, note every small spend. Most people find two or three habits that add up.'],
    ];
    if (has('wishlist')) {
      rules.push(['Impulse buys', `${a.cooldownHours}-hour rule: anything you want goes on the wishlist first. Buy it only if you still want it after the wait and it fits your Fun money.`]);
      rules.push(['Impulse buys', 'Remove saved cards from shops and app stores so buying takes effort.']);
    }
    if (has('diet')) {
      rules.push(['Takeout', `Keep takeout to ${a.takeoutCap} per paycheck, paid from Fun.`]);
      rules.push(['Takeout', 'Keep two or three easy meals at home so the cheap option is also the easy one.']);
    }
    rules.forEach(([group, text], order) => db.playbook.add({ id: uid(), group, text, order }));
  }

  if (has('goals')) {
    a.aspirations
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((title, i) =>
        db.goals.add({
          id: uid(),
          title,
          area: 'personal',
          why: '',
          targetDate: null,
          status: 'active',
          linked: null,
          createdAt: now,
          order: i + 1,
          milestones: [],
        }),
      );
  }

  if (has('fitness') && a.weightKg && a.weightKg >= 20 && a.weightKg <= 400) {
    db.weights.put({ id: today, date: today, kg: Math.round(a.weightKg * 10) / 10 });
  }

  await finishSetup();
}
