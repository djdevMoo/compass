import { describe, expect, it } from 'vitest';
import { centsToInput, money, parseMoney, pct } from '../src/lib/money';

describe('parseMoney', () => {
  it.each([
    ['12', 1200],
    ['12.5', 1250],
    ['12.50', 1250],
    ['12,50', 1250],
    ['4,5', 450],
    ['€1,234.56', 123456],
    ['1.234,56', 123456],
    ['1,234', 123400],
    ['1234', 123400],
    [' 475 ', 47500],
    ['0.1', 10],
    ['0.29', 29], // floating point: 0.29 * 100 = 28.999…
    ['1.005', 101],
    ['-5', -500],
    ['+5', 500],
    ['.5', 50],
  ])('%s → %i cents', (input, cents) => {
    expect(parseMoney(input)).toBe(cents);
  });

  it.each([
    ['£1,234.50', 123450],
    ['$12.99', 1299],
    ['kr 1 234,50', 123450],
    ['1 234,50 kr', 123450],
    ['CHF 12.50', 1250],
    ["1'234.50", 123450],
    ['₹999', 99900],
  ])('other currencies: %s → %i cents', (input, cents) => {
    expect(parseMoney(input)).toBe(cents);
  });

  it.each(['', 'abc', '12a', '.', '1.2.3', '€'])('rejects %j', (input) => {
    expect(parseMoney(input)).toBeNull();
  });
});

describe('money', () => {
  it('drops cents when whole', () => {
    expect(money(123_400)).toBe('€1,234');
  });
  it('shows cents when there are some', () => {
    expect(money(450)).toBe('€4.50');
  });
  it('signs positives on request', () => {
    expect(money(50_000, { sign: true })).toBe('+€500');
  });
  it('compacts large values', () => {
    expect(money(1_000_000, { compact: true })).toBe('€10K');
  });
  it('round-trips through the input format', () => {
    for (const c of [0, 5, 450, 1250, 47_500, 123_456]) expect(parseMoney(centsToInput(c))).toBe(c);
  });
});

describe('pct', () => {
  it('clamps to 0..1', () => {
    expect(pct(5, 10)).toBe(0.5);
    expect(pct(20, 10)).toBe(1);
    expect(pct(-1, 10)).toBe(0);
    expect(pct(1, 0)).toBe(0);
  });
});
