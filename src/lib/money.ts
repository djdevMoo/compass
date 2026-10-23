import type { Cents } from './types';

/** Currencies with two decimal places that Compass offers. Money is always stored in cents (1/100). */
export const CURRENCIES: { code: string; label: string; locale: string }[] = [
  { code: 'EUR', label: 'Euro (€)', locale: 'en-IE' },
  { code: 'GBP', label: 'Pound sterling (£)', locale: 'en-GB' },
  { code: 'USD', label: 'US dollar ($)', locale: 'en-US' },
  { code: 'CAD', label: 'Canadian dollar ($)', locale: 'en-CA' },
  { code: 'AUD', label: 'Australian dollar ($)', locale: 'en-AU' },
  { code: 'NZD', label: 'New Zealand dollar ($)', locale: 'en-NZ' },
  { code: 'CHF', label: 'Swiss franc (CHF)', locale: 'de-CH' },
  { code: 'SEK', label: 'Swedish krona (kr)', locale: 'sv-SE' },
  { code: 'NOK', label: 'Norwegian krone (kr)', locale: 'nb-NO' },
  { code: 'DKK', label: 'Danish krone (kr)', locale: 'da-DK' },
  { code: 'PLN', label: 'Polish złoty (zł)', locale: 'pl-PL' },
  { code: 'ZAR', label: 'South African rand (R)', locale: 'en-ZA' },
  { code: 'INR', label: 'Indian rupee (₹)', locale: 'en-IN' },
];

export function localeFor(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.locale ?? 'en-IE';
}

let whole: Intl.NumberFormat;
let exact: Intl.NumberFormat;
let compactFmt: Intl.NumberFormat;
let symbol = '€';

/** Switch the currency used everywhere. Defaults to euros. */
export function setCurrency(code: string): void {
  const locale = localeFor(code);
  whole = new Intl.NumberFormat(locale, { style: 'currency', currency: code, maximumFractionDigits: 0, minimumFractionDigits: 0 });
  exact = new Intl.NumberFormat(locale, { style: 'currency', currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  compactFmt = new Intl.NumberFormat(locale, { style: 'currency', currency: code, notation: 'compact', maximumFractionDigits: 1 });
  symbol = whole.formatToParts(0).find((p) => p.type === 'currency')?.value ?? code;
}
setCurrency('EUR');

/** The currency sign, e.g. "€" or "£". */
export function currencySymbol(): string {
  return symbol;
}

/** €1,234 when whole, €12.50 when there are cents. */
export function money(c: Cents, opts: { exact?: boolean; compact?: boolean; sign?: boolean } = {}): string {
  const v = c / 100;
  let s: string;
  if (opts.compact && Math.abs(v) >= 1000) s = compactFmt.format(v);
  else if (opts.exact || c % 100 !== 0) s = exact.format(v);
  else s = whole.format(v);
  if (opts.sign && c > 0) s = '+' + s;
  return s;
}

/** Plain number for an input field: 12.5 → "12.50", 1500 → "1500". */
export function centsToInput(c: Cents): string {
  if (!Number.isFinite(c)) return '';
  return c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2);
}

/**
 * Parses what a person types: "12", "12.5", "12,50", "€1,234.56", "1.234,56".
 * Returns integer cents, or null when it is not a number.
 */
export function parseMoney(input: string): Cents | null {
  let s = input
    .trim()
    .replace(/^(kr|chf|zł|r)\.?\s*/i, '') // written currency names before…
    .replace(/\s*(kr|chf|zł)\.?$/i, '') // …or after the number
    .replace(/[\s\p{Sc}'’]/gu, '') // currency signs, spaces, apostrophe separators
    .replace(/^\+/, '');
  if (!/\d/.test(s)) return null;
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1);
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // Whichever separator comes last is the decimal point.
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    const decimals = s.length - lastComma - 1;
    s = decimals === 3 && s.indexOf(',') === lastComma && s.length > 4 ? s.replace(',', '') : s.replace(',', '.');
    if (s.includes(',')) s = s.replace(/,/g, '');
  }
  if (!/^\d*\.?\d*$/.test(s) || s === '.') return null;
  // Work on the digits directly: parseFloat("1.005") * 100 is 100.49999…, which would round wrong.
  const [intPart, frac = ''] = s.split('.');
  const digits = (frac + '000').slice(0, 3);
  const value = Number(intPart || '0') * 100 + Number(digits.slice(0, 2)) + (Number(digits[2]) >= 5 ? 1 : 0);
  if (!Number.isSafeInteger(value)) return null;
  return neg ? -value : value;
}

export function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.max(0, Math.min(1, part / whole));
}
