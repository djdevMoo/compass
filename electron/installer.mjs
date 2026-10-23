// Compass installs itself. There is no separate installer program: Smart App
// Control blocks any newly built .exe, so instead the (trusted) Compass.exe copies
// its own folder into place, makes shortcuts and registers with Windows.

import { app, shell } from 'electron';
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const APP_ID = 'app.compass.desktop';
const UNINSTALL_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Compass';

export function installDir() {
  const local = process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local');
  return path.join(local, 'Programs', 'Compass');
}

export const currentDir = () => path.dirname(process.execPath);
const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

/** True when running the packaged Compass.exe from somewhere other than its install folder. */
export function needsInstall() {
  return app.isPackaged && !process.argv.includes('--portable') && !same(currentDir(), installDir());
}

export function readVersion(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'resources', 'app', 'package.json'), 'utf8')).version ?? null;
  } catch {
    return null;
  }
}

export function info() {
  return {
    mode: needsInstall() ? 'install' : 'app',
    version: app.getVersion(),
    installedVersion: readVersion(installDir()),
    installDir: installDir(),
  };
}

function shortcutPaths() {
  return {
    startMenu: path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Compass.lnk'),
    desktop: path.join(app.getPath('desktop'), 'Compass.lnk'),
  };
}

function walk(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, base, out);
    else out.push({ rel: path.relative(base, full), size: fs.statSync(full).size });
  }
  return out;
}

function reg(args) {
  return new Promise((resolve, reject) =>
    execFile('reg.exe', args, { windowsHide: true }, (err, _out, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve())),
  );
}

/**
 * Copies this folder into the install folder, then swaps it in. The old copy is only
 * replaced once the new one is complete, so a failed install never breaks an existing one.
 */
export async function install({ desktopShortcut }, onProgress) {
  const src = currentDir();
  const dest = installDir();
  const staging = `${dest}.new`;
  const old = `${dest}.old`;
  fs.rmSync(staging, { recursive: true, force: true });
  fs.rmSync(old, { recursive: true, force: true });

  const files = walk(src);
  const total = files.reduce((s, f) => s + f.size, 0) || 1;
  let done = 0;
  let lastReport = 0;
  onProgress(0, 'Copying files');
  for (const f of files) {
    const to = path.join(staging, f.rel);
    await fs.promises.mkdir(path.dirname(to), { recursive: true });
    await fs.promises.copyFile(path.join(src, f.rel), to);
    done += f.size;
    const now = Date.now();
    if (now - lastReport > 50) {
      lastReport = now;
      onProgress(0.9 * (done / total), 'Copying files');
    }
  }

  onProgress(0.92, 'Putting it in place');
  if (fs.existsSync(dest)) {
    try {
      fs.renameSync(dest, old);
    } catch {
      fs.rmSync(staging, { recursive: true, force: true });
      throw new Error('Compass is still open somewhere. Close it, then try again.');
    }
  }
  fs.renameSync(staging, dest);
  fs.rmSync(old, { recursive: true, force: true });

  onProgress(0.95, 'Adding shortcuts');
  const exe = path.join(dest, 'Compass.exe');
  const icon = path.join(dest, 'resources', 'app', 'build', 'icon.ico');
  const link = {
    target: exe,
    cwd: dest,
    icon,
    iconIndex: 0,
    appUserModelId: APP_ID,
    description: 'Compass: money, food, fitness and goals',
  };
  const { startMenu, desktop } = shortcutPaths();
  // Always write fresh shortcuts: "replace" keeps old fields (like arguments) that we didn't set.
  const writeLink = (p) => {
    fs.rmSync(p, { force: true });
    if (!shell.writeShortcutLink(p, 'create', link)) throw new Error(`Couldn't create the shortcut ${p}`);
  };
  writeLink(startMenu);
  if (desktopShortcut) writeLink(desktop);
  else fs.rmSync(desktop, { force: true });

  onProgress(0.98, 'Registering with Windows');
  const d = new Date();
  const values = [
    ['DisplayName', 'REG_SZ', 'Compass'],
    ['DisplayVersion', 'REG_SZ', app.getVersion()],
    ['Publisher', 'REG_SZ', 'Compass'],
    ['DisplayIcon', 'REG_SZ', icon],
    ['InstallLocation', 'REG_SZ', dest],
    ['UninstallString', 'REG_SZ', `"${exe}" --uninstall`],
    ['QuietUninstallString', 'REG_SZ', `"${exe}" --uninstall --quiet`],
    ['InstallDate', 'REG_SZ', `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`],
    ['EstimatedSize', 'REG_DWORD', String(Math.round(total / 1024))],
    ['NoModify', 'REG_DWORD', '1'],
    ['NoRepair', 'REG_DWORD', '1'],
  ];
  for (const [name, type, data] of values) await reg(['add', UNINSTALL_KEY, '/v', name, '/t', type, '/d', data, '/f']);

  onProgress(1, 'Done');
}

/** Whether this user currently has a Compass shortcut on their Desktop (kept as-is on update). */
export function hasDesktopShortcut() {
  return fs.existsSync(shortcutPaths().desktop);
}

export function launchInstalled() {
  spawn(path.join(installDir(), 'Compass.exe'), [], { detached: true, stdio: 'ignore', cwd: installDir() }).unref();
}

/**
 * Removes shortcuts and the Windows entry now, then deletes the program folder a moment
 * after Compass exits (a running program can't delete itself).
 */
export async function uninstall({ deleteData }) {
  const { startMenu, desktop } = shortcutPaths();
  for (const p of [startMenu, desktop]) {
    // Only remove shortcuts that point at this install.
    try {
      if (fs.existsSync(p) && same(shell.readShortcutLink(p).target, path.join(installDir(), 'Compass.exe'))) fs.rmSync(p);
    } catch {
      /* unreadable shortcut: leave it */
    }
  }
  await reg(['delete', UNINSTALL_KEY, '/f']).catch(() => {});

  const targets = [installDir()];
  if (deleteData) targets.push(app.getPath('userData'));
  const script = ['ping -n 3 127.0.0.1 >nul', ...targets.map((t) => `rmdir /s /q "${t}"`)].join(' & ');
  spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `"${script}"`], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    windowsVerbatimArguments: true,
    cwd: os.tmpdir(), // not inside a folder that is about to be deleted
  }).unref();
}
