// Pure helpers for the updater (no Electron, no network), so they can be unit-tested.

/** "v1.2.3" / "1.2.3" → [1, 2, 3]; anything else → null. Pre-release tags are ignored. */
export function parseVersion(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(v ?? '').trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Positive when a is newer than b, negative when older, 0 when equal or unparseable. */
export function compareVersions(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/** The "What's new" part of release notes: everything before the "## Install" heading. */
export function whatsNew(body) {
  const text = String(body ?? '').replace(/\r\n/g, '\n');
  const cut = text.search(/^##\s+Install\b/im);
  return (cut >= 0 ? text.slice(0, cut) : text).replace(/^##\s+What'?s new\s*$/im, '').trim();
}

/**
 * Reads GitHub's "latest release" JSON and picks the Windows zip.
 * Returns null when the release has no usable, verifiable download.
 */
export function readRelease(json) {
  if (!json || typeof json !== 'object' || json.draft || json.prerelease) return null;
  const version = parseVersion(json.tag_name);
  if (!version) return null;
  const asset = (Array.isArray(json.assets) ? json.assets : []).find(
    (a) => typeof a?.name === 'string' && /^Compass-\d+\.\d+\.\d+-win-x64\.zip$/.test(a.name),
  );
  if (!asset || typeof asset.browser_download_url !== 'string') return null;
  // GitHub publishes a SHA-256 for every asset; without it there is nothing to verify against.
  const sha256 = /^sha256:([0-9a-f]{64})$/i.exec(String(asset.digest ?? ''))?.[1]?.toLowerCase();
  if (!sha256) return null;
  return {
    version: version.join('.'),
    notes: whatsNew(json.body),
    pageUrl: typeof json.html_url === 'string' ? json.html_url : null,
    asset: { name: asset.name, url: asset.browser_download_url, size: Number(asset.size) || 0, sha256 },
  };
}
