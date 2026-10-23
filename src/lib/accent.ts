// Accent colour presets. The app derives every accent shade (dark and light theme,
// button text, soft highlights) from one base colour in app.css, so any colour works.

export const DEFAULT_ACCENT = '#34d399';

export const ACCENTS: { name: string; hex: string }[] = [
  { name: 'Mint', hex: '#34d399' },
  { name: 'Sky', hex: '#38bdf8' },
  { name: 'Indigo', hex: '#818cf8' },
  { name: 'Violet', hex: '#a78bfa' },
  { name: 'Pink', hex: '#f472b6' },
  { name: 'Coral', hex: '#fb7185' },
  { name: 'Orange', hex: '#fb923c' },
  { name: 'Amber', hex: '#fbbf24' },
];

/** "#ABC", "abc123", "#AbC123" → "#aabbcc" / "#abc123"; anything else → null. */
export function normalizeHex(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const s = input.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(s)) return '#' + [...s].map((ch) => ch + ch).join('');
  if (/^[0-9a-f]{6}$/.test(s)) return '#' + s;
  return null;
}

export function accentName(hex: string): string {
  return ACCENTS.find((a) => a.hex === hex)?.name ?? 'Custom';
}
