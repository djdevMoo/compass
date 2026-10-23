import { describe, expect, it } from 'vitest';
import { addDays, diffDays, fmt, nthPayday, payPeriod, toISO, weekStart } from '../src/lib/dates';

describe('date basics', () => {
  it('formats local dates without shifting to UTC', () => {
    expect(toISO(new Date(2026, 9, 23, 23, 59))).toBe('2026-10-23');
    expect(toISO(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });

  it('counts days across daylight-saving changes', () => {
    // Ireland/UK clocks change on 29 Mar and 25 Oct 2026.
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2);
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2);
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('finds the Monday of a week', () => {
    expect(weekStart('2026-10-23')).toBe('2026-10-19'); // Friday
    expect(weekStart('2026-10-19')).toBe('2026-10-19'); // Monday
    expect(weekStart('2026-10-25')).toBe('2026-10-19'); // Sunday
  });

  it('names weekdays without punctuation', () => {
    expect(fmt.weekday('2026-10-23')).toBe('Fri');
  });

  it('describes dates roughly', () => {
    expect(fmt.roughly('2027-07-02')).toBe('early July 2027');
    expect(fmt.roughly('2027-01-15')).toBe('mid January 2027');
    expect(fmt.roughly('2027-05-28')).toBe('late May 2027');
  });
});

describe('payPeriod', () => {
  it('works from a past anchor (every 2 weeks)', () => {
    const p = payPeriod('biweekly', '2026-10-16', '2026-10-23');
    expect(p).toMatchObject({ start: '2026-10-16', next: '2026-10-30', daysLeft: 7, length: 14, known: true });
  });

  it('works from a future anchor', () => {
    const p = payPeriod('biweekly', '2026-11-13', '2026-10-23');
    expect(p.start).toBe('2026-10-16');
    expect(p.next).toBe('2026-10-30');
  });

  it('treats payday itself as the start of a new period', () => {
    const p = payPeriod('biweekly', '2026-10-16', '2026-10-30');
    expect(p.start).toBe('2026-10-30');
    expect(p.next).toBe('2026-11-13');
  });

  it('handles weekly pay', () => {
    const p = payPeriod('weekly', '2026-10-02', '2026-10-23');
    expect(p.start).toBe('2026-10-23');
    expect(p.next).toBe('2026-10-30');
  });

  it('handles monthly pay, clamping to short months', () => {
    expect(payPeriod('monthly', '2026-01-31', '2026-02-15')).toMatchObject({ start: '2026-01-31', next: '2026-02-28' });
    expect(payPeriod('monthly', '2026-01-31', '2026-03-05')).toMatchObject({ start: '2026-02-28', next: '2026-03-31' });
    expect(payPeriod('monthly', '2026-01-25', '2026-12-26')).toMatchObject({ start: '2026-12-25', next: '2027-01-25' });
  });

  it('falls back to today when no payday is set', () => {
    const p = payPeriod('biweekly', null, '2026-10-23');
    expect(p).toMatchObject({ start: '2026-10-23', next: '2026-11-06', known: false });
  });
});

describe('nthPayday', () => {
  it('counts the first payday as 1', () => {
    expect(nthPayday('2026-10-30', 1, 'biweekly')).toBe('2026-10-30');
    expect(nthPayday('2026-10-30', 18, 'biweekly')).toBe('2027-06-25');
  });
  it('steps months safely', () => {
    expect(nthPayday('2026-01-31', 2, 'monthly')).toBe('2026-02-28');
    expect(nthPayday('2026-11-15', 3, 'monthly')).toBe('2027-01-15');
  });
});
