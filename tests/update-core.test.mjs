import { describe, expect, it } from 'vitest';
import { compareVersions, parseVersion, readRelease, whatsNew } from '../electron/update-core.mjs';

const sha = 'a'.repeat(64);
const release = (over = {}) => ({
  tag_name: 'v0.4.0',
  draft: false,
  prerelease: false,
  html_url: 'https://github.com/djdevMoo/compass/releases/tag/v0.4.0',
  body: "## What's new\n\n- Auto-updates\n\n## Install\n\n1. Download…",
  assets: [{ name: 'Compass-0.4.0-win-x64.zip', browser_download_url: 'https://example.test/c.zip', size: 123, digest: `sha256:${sha}` }],
  ...over,
});

describe('versions', () => {
  it('parses plain and v-prefixed versions only', () => {
    expect(parseVersion('v1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('0.10.0')).toEqual([0, 10, 0]);
    expect(parseVersion('1.2')).toBeNull();
    expect(parseVersion('1.2.3-beta.1')).toBeNull();
    expect(parseVersion(undefined)).toBeNull();
  });

  it('compares numerically, not as text', () => {
    expect(compareVersions('0.10.0', '0.9.9')).toBeGreaterThan(0);
    expect(compareVersions('v0.4.0', '0.4.0')).toBe(0);
    expect(compareVersions('0.3.0', '0.4.0')).toBeLessThan(0);
    expect(compareVersions('garbage', '0.4.0')).toBe(0);
  });
});

describe('readRelease', () => {
  it('picks the Windows zip and its checksum', () => {
    const r = readRelease(release());
    expect(r).toMatchObject({ version: '0.4.0', notes: '- Auto-updates', asset: { url: 'https://example.test/c.zip', size: 123, sha256: sha } });
  });

  it('refuses releases it cannot verify or should not install', () => {
    expect(readRelease(release({ assets: [{ ...release().assets[0], digest: undefined }] }))).toBeNull();
    expect(readRelease(release({ assets: [{ ...release().assets[0], name: 'Compass-0.4.0-mac.dmg' }] }))).toBeNull();
    expect(readRelease(release({ prerelease: true }))).toBeNull();
    expect(readRelease(release({ draft: true }))).toBeNull();
    expect(readRelease(release({ tag_name: 'nightly' }))).toBeNull();
    expect(readRelease(null)).toBeNull();
  });
});

describe('whatsNew', () => {
  it('keeps only the part above the install instructions', () => {
    expect(whatsNew("## What's new\r\n\r\n- A\r\n- B\r\n\r\n## Install\r\nsteps")).toBe('- A\n- B');
    expect(whatsNew('Just text')).toBe('Just text');
    expect(whatsNew(null)).toBe('');
  });
});
