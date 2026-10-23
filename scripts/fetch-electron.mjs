// `npm run fetch-electron`: installs the Electron runtime by hand.
//
// Why: Windows Smart App Control blocks the unsigned helper that `npm install`
// normally uses to unpack Electron, which leaves node_modules/electron without
// its program files. This downloads the official release zip from GitHub,
// checks it against the SHA-256 checksums that ship inside the electron npm
// package, and unpacks it with Windows' own tar.exe.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = path.join(root, 'node_modules', 'electron');
const { version } = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
const checksums = JSON.parse(fs.readFileSync(path.join(pkgDir, 'checksums.json'), 'utf8'));
const name = `electron-v${version}-win32-x64.zip`;
const expected = checksums[name];
if (!expected) throw new Error(`No checksum for ${name}`);

const dist = path.join(pkgDir, 'dist');
if (fs.existsSync(path.join(dist, 'electron.exe')) && fs.readFileSync(path.join(dist, 'version'), 'utf8').trim() === version) {
  console.log(`Electron ${version} is already installed.`);
  process.exit(0);
}

const url = `https://github.com/electron/electron/releases/download/v${version}/${name}`;
console.log(`Downloading ${url}`);
const res = await fetch(url);
if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
const buf = Buffer.from(await res.arrayBuffer());

const actual = createHash('sha256').update(buf).digest('hex');
if (actual !== expected) throw new Error(`Checksum mismatch for ${name}: expected ${expected}, got ${actual}`);
console.log('Checksum OK');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compass-electron-'));
const zip = path.join(tmpDir, name);
fs.writeFileSync(zip, buf);
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
const tar = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
execFileSync(tar, ['-xf', zip, '-C', dist], { stdio: 'inherit' });
fs.writeFileSync(path.join(pkgDir, 'path.txt'), 'electron.exe');
fs.rmSync(tmpDir, { recursive: true, force: true });
console.log(`Electron ${version} installed.`);
