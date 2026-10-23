// In-app updates from GitHub Releases.
//
// check()  → asks GitHub for the latest release (nothing about the user is sent).
// stage()  → downloads the Windows zip, verifies its SHA-256 against the checksum GitHub
//            publishes, and unpacks it into a temp folder.
// handOff() → starts the new Compass.exe in update mode and lets this one quit; the new
//            copy waits for us to exit, installs itself over the old one, and reopens.

import { app, net } from 'electron';
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compareVersions, readRelease } from './update-core.mjs';

const REPO = 'djdevMoo/compass';
// For testing against a local feed only; normal runs always use GitHub over HTTPS.
const FEED = process.env.COMPASS_UPDATE_URL || `https://api.github.com/repos/${REPO}/releases/latest`;
const ALLOW_HTTP = !!process.env.COMPASS_UPDATE_URL;
const STAGE_PREFIX = 'compass-update-';

/** Updates only install into a real installed copy on Windows. */
export const canInstall = () => process.platform === 'win32' && app.isPackaged;

let latest = null;

export async function check() {
  const res = await net.fetch(FEED, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': `Compass/${app.getVersion()}` },
    cache: 'no-store',
  });
  if (res.status === 404) return { available: false, current: app.getVersion() };
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const release = readRelease(await res.json());
  if (!release) return { available: false, current: app.getVersion() };
  latest = release;
  return {
    available: compareVersions(release.version, app.getVersion()) > 0,
    current: app.getVersion(),
    version: release.version,
    notes: release.notes,
    pageUrl: release.pageUrl,
    size: release.asset.size,
    canInstall: canInstall(),
  };
}

function safeUrl(u) {
  const url = new URL(u);
  if (url.protocol === 'https:' || (ALLOW_HTTP && url.protocol === 'http:')) return url.toString();
  throw new Error('Refusing to download over an insecure connection');
}

/** Downloads, verifies and unpacks the latest release. Returns the path of the new Compass.exe. */
export async function stage(onProgress) {
  if (!latest) throw new Error('Check for updates first');
  if (!canInstall()) throw new Error('Updates install only in the installed Windows app');
  const { version, asset } = latest;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${STAGE_PREFIX}${version}-`));
  const zip = path.join(dir, asset.name);

  const res = await net.fetch(safeUrl(asset.url), { headers: { 'User-Agent': `Compass/${app.getVersion()}` } });
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
  const total = Number(res.headers.get('content-length')) || asset.size || 0;
  const hash = createHash('sha256');
  const out = fs.createWriteStream(zip);
  let got = 0;
  let last = 0;
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      hash.update(value);
      if (!out.write(value)) await new Promise((r) => out.once('drain', r));
      got += value.length;
      const now = Date.now();
      if (total && now - last > 100) {
        last = now;
        onProgress(Math.min(0.95, (got / total) * 0.95), 'Downloading');
      }
    }
  } finally {
    await new Promise((r) => out.end(r));
  }

  onProgress(0.96, 'Checking the download');
  if (hash.digest('hex') !== asset.sha256) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw new Error("The download didn't match GitHub's checksum, so it wasn't installed. Try again later.");
  }

  onProgress(0.97, 'Unpacking');
  const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  await new Promise((resolve, reject) =>
    execFile(tar, ['-xf', zip, '-C', dir], { windowsHide: true }, (err) => (err ? reject(err) : resolve())),
  );
  fs.rmSync(zip, { force: true });

  const folder = path.join(dir, `Compass-${version}-win-x64`);
  const exe = path.join(folder, 'Compass.exe');
  const pkg = JSON.parse(fs.readFileSync(path.join(folder, 'resources', 'app', 'package.json'), 'utf8'));
  if (!fs.existsSync(exe) || pkg.version !== version) throw new Error('The downloaded update looks incomplete');
  onProgress(1, 'Ready');
  return exe;
}

/** Starts the staged Compass.exe in update mode. The caller then quits this app. */
export function handOff(exe) {
  spawn(exe, ['--update', `--wait-pid=${process.pid}`], {
    detached: true,
    stdio: 'ignore',
    cwd: path.dirname(exe),
  }).unref();
}

/** Removes leftover update downloads (best effort, called by the installed app at start). */
export function cleanupStaged() {
  try {
    for (const name of fs.readdirSync(os.tmpdir())) {
      if (name.startsWith(STAGE_PREFIX)) fs.rmSync(path.join(os.tmpdir(), name), { recursive: true, force: true });
    }
  } catch {
    /* nothing to clean, or a file still in use; try again next start */
  }
}

/** Waits until a process has exited (or the timeout passes). */
export async function waitForExit(pid, timeoutMs = 20000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      process.kill(pid, 0);
    } catch {
      return;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}
