// `npm run package`: builds a shareable Compass folder and zip in ./release.
//
// The package is Electron's own runtime, unmodified, with electron.exe renamed to
// Compass.exe and the app placed in resources/app (Electron loads that folder by
// itself). Nothing is recompiled or re-signed, so the .exe stays byte-for-byte the
// one Windows already trusts, and Smart App Control lets it run on any PC.
import { build } from 'vite';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const runtime = path.join(root, 'node_modules', 'electron', 'dist');
const name = `Compass-${pkg.version}-win-x64`;
const releaseDir = path.join(root, 'release');
const out = path.join(releaseDir, name);
const appDir = path.join(out, 'resources', 'app');

const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const step = (msg) => console.log(`\n▸ ${msg}`);

if (!fs.existsSync(path.join(runtime, 'electron.exe'))) {
  throw new Error('Electron runtime missing. Run `npm run fetch-electron` first.');
}

step('Building the UI');
await build({ configFile: path.join(root, 'vite.config.ts'), logLevel: 'warn' });

step(`Assembling ${path.relative(root, out)}`);
fs.rmSync(out, { recursive: true, force: true });
fs.rmSync(`${out}.zip`, { force: true });
fs.cpSync(runtime, out, {
  recursive: true,
  // Electron's demo app would shadow ours, and the version file is only for npm.
  filter: (src) => !/[\\/]resources[\\/]default_app\.asar$/.test(src) && path.basename(src) !== 'version',
});
fs.renameSync(path.join(out, 'electron.exe'), path.join(out, 'Compass.exe'));

const appPkg = {
  name: pkg.name,
  productName: pkg.productName,
  version: pkg.version,
  description: pkg.description,
  type: 'module',
  main: 'electron/main.mjs',
};
fs.mkdirSync(appDir, { recursive: true });
fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(appPkg, null, 2));
for (const f of ['main.mjs', 'preload.cjs', 'store.mjs', 'installer.mjs']) {
  fs.cpSync(path.join(root, 'electron', f), path.join(appDir, 'electron', f));
}
fs.cpSync(path.join(root, 'dist'), path.join(appDir, 'dist'), { recursive: true });
fs.cpSync(path.join(root, 'build', 'icon.ico'), path.join(appDir, 'build', 'icon.ico'));
fs.writeFileSync(
  path.join(out, 'START HERE.txt'),
  [
    `Compass ${pkg.version}`,
    '',
    'To install: double-click Compass.exe in this folder.',
    'It installs itself for your Windows account (no admin rights needed),',
    'adds Start menu and Desktop shortcuts, then asks a few questions to set itself up.',
    '',
    'After installing you can delete this folder.',
    'To remove Compass later: Settings > Apps > Installed apps > Compass > Uninstall.',
    '',
  ].join('\r\n'),
);

step('Checking Compass.exe is the untouched Electron binary');
if (sha(path.join(out, 'Compass.exe')) !== sha(path.join(runtime, 'electron.exe'))) {
  throw new Error('Compass.exe differs from electron.exe; Smart App Control would block it.');
}
console.log('  identical ✓');

step('Zipping');
const tar = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
execFileSync(tar, ['-a', '-c', '-f', `${name}.zip`, name], { cwd: releaseDir, stdio: 'inherit' });

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(0)} MB`;
console.log(`\n✔ ${path.relative(root, out)}  (folder)`);
console.log(`✔ ${path.relative(root, out)}.zip  (${mb(fs.statSync(`${out}.zip`).size)}, share this one)`);
