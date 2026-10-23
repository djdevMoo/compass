import { describe, expect, it } from 'vitest';
import { buildPlan, paydaysUntil, perPayFromMonthly, perPayFromWeekly, type PlanInput } from '../src/lib/plan';

const base: PlanInput = {
  pay: 140_000,
  freq: 'biweekly',
  rentMonthly: 65_000, // €300 per paycheck
  transportMonthly: 17_500, // ≈ €80.77 → €80
  groceriesWeekly: 6_500, // €130
  billsMonthly: 11_500, // ≈ €53 → €55
  goalRemaining: 730_000,
  goalDate: null,
  firstPayday: '2026-10-30',
};

const total = (lines: { amount: number }[]) => lines.reduce((s, l) => s + l.amount, 0);

describe('conversions', () => {
  it('converts monthly and weekly amounts to per-paycheck, rounded to 5', () => {
    expect(perPayFromMonthly(65_000, 'biweekly')).toBe(30_000);
    expect(perPayFromMonthly(100_000, 'monthly')).toBe(100_000);
    expect(perPayFromWeekly(6_500, 'biweekly')).toBe(13_000);
    expect(perPayFromWeekly(6_500, 'weekly')).toBe(6_500);
  });

  it('counts paydays up to a date', () => {
    expect(paydaysUntil('2026-10-30', '2026-10-30', 'biweekly')).toBe(1);
    expect(paydaysUntil('2026-10-30', '2027-06-25', 'biweekly')).toBe(18);
    expect(paydaysUntil('2026-10-30', '2027-06-24', 'biweekly')).toBe(17);
    expect(paydaysUntil('2026-10-30', '2026-10-29', 'biweekly')).toBe(0);
    expect(paydaysUntil('2026-11-25', '2027-01-25', 'monthly')).toBe(3);
    expect(paydaysUntil('2026-11-25', '2027-01-24', 'monthly')).toBe(2);
  });
});

describe('buildPlan', () => {
  it('always adds up to the paycheck exactly', () => {
    for (const pay of [80_000, 140_000, 123_457, 250_000]) {
      const p = buildPlan({ ...base, pay });
      expect(total(p.lines)).toBe(pay);
      expect(p.lines.every((l) => l.amount >= 0)).toBe(true);
    }
  });

  it('suggests saving half of what is free when there is no date', () => {
    const p = buildPlan(base);
    // free = 1400 - 300 - 80 - 55 - 130 = 835 → save half, rounded down to 5
    expect(p.free).toBe(83_500);
    expect(p.save).toBe(41_500);
  });

  it('aims for the goal date, but never more than 80% of what is free', () => {
    const soon = buildPlan({ ...base, goalDate: '2027-05-14' }); // 15 paydays
    expect(soon.neededForDate).toBe(49_000); // 7300 / 15 = 486.7 → 490
    expect(soon.save).toBe(49_000);
    const tooSoon = buildPlan({ ...base, goalDate: '2026-12-31' }); // 5 paydays
    expect(tooSoon.save).toBe(66_500); // 80% of 835 = 668 → 665
  });

  it('respects a chosen amount, capped at what is free', () => {
    expect(buildPlan({ ...base, saveOverride: 47_500 }).save).toBe(47_500);
    expect(buildPlan({ ...base, saveOverride: 999_999 }).save).toBe(83_500);
  });

  it('reports a shortfall instead of inventing money', () => {
    const p = buildPlan({ ...base, pay: 30_000 });
    expect(p.shortfall).toBe(26_500);
    expect(p.save).toBe(0);
  });
});
