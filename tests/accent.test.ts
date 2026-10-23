import { describe, expect, it } from 'vitest';
import { ACCENTS, DEFAULT_ACCENT, accentName, normalizeHex } from '../src/lib/accent';

describe('accent colours', () => {
  it.each([
    ['#34D399', '#34d399'],
    ['34d399', '#34d399'],
    ['#abc', '#aabbcc'],
    [' #F0F ', '#ff00ff'],
  ])('normalizes %j → %s', (input, out) => {
    expect(normalizeHex(input)).toBe(out);
  });

  it.each(['', 'red', '#12345', '#1234567', '#ggg', null, 42])('rejects %j', (input) => {
    expect(normalizeHex(input)).toBeNull();
  });

  it('has a valid, unique set of presets with the default first', () => {
    expect(ACCENTS[0].hex).toBe(DEFAULT_ACCENT);
    expect(new Set(ACCENTS.map((a) => a.hex)).size).toBe(ACCENTS.length);
    for (const a of ACCENTS) expect(normalizeHex(a.hex)).toBe(a.hex);
  });

  it('names presets and calls anything else custom', () => {
    expect(accentName('#38bdf8')).toBe('Sky');
    expect(accentName('#123456')).toBe('Custom');
  });
});
