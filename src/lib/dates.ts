import type { ISODate, PayFrequency } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date, never UTC (toISOString would shift days near midnight). */
export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): ISODate {
  return toISO(new Date());
}

export function parseISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isISODate(s: unknown): s is ISODate {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseISO(s).getTime());
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

function utcDay(s: ISODate): number {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Whole days from a to b (b - a). Safe across daylight-saving changes. */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round(utcDay(b) - utcDay(a));
}

function daysInMonth(y: number, m0: number): number {
  return new Date(y, m0 + 1, 0).getDate();
}

/** Same day-of-month as `day`, clamped to short months (31st → 30th/28th). */
function monthlyDate(y: number, m0: number, day: number): ISODate {
  // Normalise month overflow first.
  const base = new Date(y, m0, 1);
  const yy = base.getFullYear();
  const mm = base.getMonth();
  return toISO(new Date(yy, mm, Math.min(day, daysInMonth(yy, mm))));
}

export function paydayStep(freq: PayFrequency): number {
  return freq === 'weekly' ? 7 : freq === 'biweekly' ? 14 : 0;
}

export function paychecksPerYear(freq: PayFrequency): number {
  return freq === 'weekly' ? 52 : freq === 'biweekly' ? 26 : 12;
}

export interface PayPeriod {
  /** Most recent payday on or before today. */
  start: ISODate;
  /** The next payday after today. */
  next: ISODate;
  length: number;
  daysLeft: number;
  /** False when no payday has been set and the period is a guess. */
  known: boolean;
}

export function payPeriod(freq: PayFrequency, anchor: ISODate | null, today: ISODate = todayISO()): PayPeriod {
  const known = !!anchor && isISODate(anchor);
  const a = known ? anchor! : today;
  let start: ISODate;
  let next: ISODate;
  const step = paydayStep(freq);
  if (step > 0) {
    const k = Math.floor(diffDays(a, today) / step);
    start = addDays(a, k * step);
    next = addDays(start, step);
  } else {
    const ad = parseISO(a).getDate();
    const t = parseISO(today);
    start = monthlyDate(t.getFullYear(), t.getMonth(), ad);
    if (start > today) start = monthlyDate(t.getFullYear(), t.getMonth() - 1, ad);
    const s = parseISO(start);
    next = monthlyDate(s.getFullYear(), s.getMonth() + 1, ad);
  }
  return { start, next, length: diffDays(start, next), daysLeft: diffDays(today, next), known };
}

/** The n-th payday counting `first` as n = 1. */
export function nthPayday(first: ISODate, n: number, freq: PayFrequency): ISODate {
  if (n <= 1) return first;
  const step = paydayStep(freq);
  if (step > 0) return addDays(first, (n - 1) * step);
  const d = parseISO(first);
  return monthlyDate(d.getFullYear(), d.getMonth() + (n - 1), d.getDate());
}

/** Monday of the week containing `s`. */
export function weekStart(s: ISODate): ISODate {
  const dow = (parseISO(s).getDay() + 6) % 7; // Mon = 0
  return addDays(s, -dow);
}

let fmtShort: Intl.DateTimeFormat;
let fmtDay: Intl.DateTimeFormat;
let fmtWeekday: Intl.DateTimeFormat;
let fmtLong: Intl.DateTimeFormat;
let fmtMonthYear: Intl.DateTimeFormat;
let fmtFull: Intl.DateTimeFormat;
let dateLocale = 'en-IE';

/** Date wording follows the region of the chosen currency (en-IE by default). */
export function setDateLocale(locale: string): void {
  dateLocale = locale;
  fmtShort = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  fmtDay = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  fmtWeekday = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  fmtLong = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  fmtMonthYear = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  fmtFull = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}
setDateLocale('en-IE');

export function getDateLocale(): string {
  return dateLocale;
}

export const fmt = {
  short: (s: ISODate) => fmtShort.format(parseISO(s)),
  day: (s: ISODate) => fmtDay.format(parseISO(s)),
  weekday: (s: ISODate) => fmtWeekday.format(parseISO(s)),
  long: (s: ISODate) => fmtLong.format(parseISO(s)),
  full: (s: ISODate) => fmtFull.format(parseISO(s)),
  /** "early July 2027" */
  roughly(s: ISODate): string {
    const d = parseISO(s);
    const part = d.getDate() <= 10 ? 'early' : d.getDate() <= 20 ? 'mid' : 'late';
    return `${part} ${fmtMonthYear.format(d)}`;
  },
  /** "today", "tomorrow", "in 5 days", "3 days ago" */
  relative(s: ISODate, today: ISODate = todayISO()): string {
    const n = diffDays(today, s);
    if (n === 0) return 'today';
    if (n === 1) return 'tomorrow';
    if (n === -1) return 'yesterday';
    return n > 0 ? `in ${n} days` : `${-n} days ago`;
  },
};

/** "2d 4h", "5h 12m", "12m" until a timestamp. */
export function countdown(ms: number): string {
  if (ms <= 0) return 'now';
  const m = Math.ceil(ms / 60_000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${mm}m`;
  return `${mm}m`;
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
