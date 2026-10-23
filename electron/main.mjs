import { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme, screen, Menu } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './store.mjs';
import * as installer from './installer.mjs';
import * as updater from './updater.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const APP_ID = installer.APP_ID;
const DEV_URL = process.env.COMPASS_DEV_URL || null;
const ICON = path.join(ROOT, 'build', 'icon.ico');
/** `--update --wait-pid=N`: started by an older Compass that is about to quit. */
const UPDATING = process.argv.includes('--update');
const WAIT_PID = Number(process.argv.find((a) => a.startsWith('--wait-pid='))?.split('=')[1]) || 0;

const THEMES = {
  dark: { bg: '#0e0f13', symbol: '#c9cdd6' },
  light: { bg: '#eceef2', symbol: '#1f2329' },
};
const TITLEBAR_HEIGHT = 40;

app.setName('Compass');
// Development runs keep their own data so experiments never touch the real database.
// COMPASS_DATA_DIR points a run at any folder (used for testing a fresh install).
app.setPath(
  'userData',
  process.env.COMPASS_DATA_DIR || path.join(app.getPath('appData'), DEV_URL ? 'Compass Dev' : 'Compass'),
);
app.setAppUserModelId(APP_ID);
nativeTheme.themeSource = 'dark';

// `npm run shortcuts` creates Start menu and Desktop shortcuts, then exits.
if (process.argv.includes('--install-shortcuts')) {
  app.whenReady().then(() => {
    const opts = {
      target: process.execPath,
      args: `"${ROOT}"`,
      cwd: ROOT,
      icon: ICON,
      iconIndex: 0,
      appUserModelId: APP_ID,
      description: 'Compass: money, food, fitness and goals',
    };
    const places = [
      path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Compass.lnk'),
      path.join(app.getPath('desktop'), 'Compass.lnk'),
    ];
    for (const p of places) {
      const ok = shell.writeShortcutLink(p, fs.existsSync(p) ? 'replace' : 'create', opts);
      console.log(`${ok ? 'Created' : 'FAILED'}: ${p}`);
    }
    app.quit();
  });
} else if (process.argv.includes('--uninstall')) {
  app.whenReady().then(runUninstall);
} else {
  dispatch();
}

async function dispatch() {
  // Let the old copy close first, or the lock below (and its open files) would block us.
  if (WAIT_PID) await updater.waitForExit(WAIT_PID);
  if (!app.requestSingleInstanceLock()) {
    if (installer.needsInstall()) {
      app.whenReady().then(() => {
        dialog.showMessageBoxSync({
          type: 'info',
          title: 'Compass',
          message: 'Compass is already open.',
          detail: 'Close it first, then run this again to install or update.',
        });
        app.quit();
      });
    } else {
      app.quit();
    }
  } else if (installer.needsInstall()) {
    startInstaller();
  } else {
    start();
  }
}

/** Theme sync and safe link opening, shared by the installer and the app windows. */
function registerCommonIpc(getWin) {
  // `source` is the user's choice (dark/light/system); `resolved` is what the page is showing.
  ipcMain.handle('win:theme', (_e, source, resolved) => {
    nativeTheme.themeSource = ['dark', 'light', 'system'].includes(source) ? source : 'dark';
    const t = resolved === 'light' ? 'light' : 'dark';
    const win = getWin();
    if (win && !win.isDestroyed()) {
      win.setBackgroundColor(THEMES[t].bg);
      win.setTitleBarOverlay({ color: THEMES[t].bg, symbolColor: THEMES[t].symbol, height: TITLEBAR_HEIGHT });
    }
  });
  ipcMain.handle('app:open-external', (_e, url) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) return shell.openExternal(url);
  });
  ipcMain.handle('install:info', () => installer.info());
}

function baseWindowOptions(width, height) {
  return {
    width,
    height,
    show: false,
    title: 'Compass',
    icon: ICON,
    backgroundColor: THEMES.dark.bg,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: THEMES.dark.bg, symbolColor: THEMES.dark.symbol, height: TITLEBAR_HEIGHT },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  };
}

/** The welcome / install screen shown when Compass.exe runs from a download folder. */
function startInstaller() {
  /** @type {BrowserWindow | null} */
  let win = null;
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    registerCommonIpc(() => win);
    let running = false;
    ipcMain.handle('install:run', async (e, opts) => {
      if (running) return;
      running = true;
      try {
        const desktopShortcut =
          typeof opts?.desktopShortcut === 'boolean' ? opts.desktopShortcut : installer.hasDesktopShortcut();
        await installer.install({ desktopShortcut }, (p, label) => {
          if (!e.sender.isDestroyed()) e.sender.send('install:progress', p, label);
        });
      } finally {
        running = false;
      }
    });
    ipcMain.handle('install:launch', () => {
      app.releaseSingleInstanceLock();
      installer.launchInstalled();
      setTimeout(() => app.quit(), 300);
    });

    win = new BrowserWindow({ ...baseWindowOptions(760, 640), minWidth: 480, minHeight: 560, center: true });
    win.once('ready-to-show', () => win.show());
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (e) => e.preventDefault());
    win.loadFile(path.join(ROOT, 'dist', 'index.html'), {
      query: UPDATING ? { mode: 'install', auto: '1' } : { mode: 'install' },
    });
  });
  app.on('window-all-closed', () => app.quit());
}

/** Settings → Apps → Compass → Uninstall lands here. */
async function runUninstall() {
  if (!app.requestSingleInstanceLock()) {
    dialog.showMessageBoxSync({ type: 'info', title: 'Compass', message: 'Close Compass first, then uninstall it.' });
    return app.quit();
  }
  // `--uninstall --quiet` (Windows' "quiet uninstall") removes the program and keeps data.
  if (process.argv.includes('--quiet')) {
    await installer.uninstall({ deleteData: false }).catch(() => {});
    return app.quit();
  }
  const r = await dialog.showMessageBox({
    type: 'question',
    title: 'Uninstall Compass',
    message: 'Remove Compass from this PC?',
    detail: `Your data stays in ${app.getPath('userData')} unless you tick the box, so you can reinstall later and pick up where you left off.`,
    checkboxLabel: 'Also delete my data and backups',
    buttons: ['Uninstall', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  });
  if (r.response === 0) {
    try {
      await installer.uninstall({ deleteData: r.checkboxChecked });
    } catch (e) {
      dialog.showErrorBox('Uninstall failed', String(e?.message ?? e));
    }
  }
  app.quit();
}

function start() {
  /** @type {BrowserWindow | null} */
  let win = null;
  /** @type {Store} */
  let store;

  const stateFile = path.join(app.getPath('userData'), 'window-state.json');

  function readWindowState() {
    try {
      const s = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      if (typeof s.width !== 'number' || typeof s.height !== 'number') return null;
      // Only restore a position that is still on a connected screen.
      if (typeof s.x === 'number' && typeof s.y === 'number') {
        const area = screen.getDisplayMatching({ x: s.x, y: s.y, width: s.width, height: s.height }).workArea;
        const visible =
          s.x < area.x + area.width - 80 && s.x + s.width > area.x + 80 && s.y >= area.y - 10 && s.y < area.y + area.height - 80;
        if (!visible) {
          delete s.x;
          delete s.y;
        }
      }
      return s;
    } catch {
      return null;
    }
  }

  function saveWindowState() {
    if (!win || win.isDestroyed()) return;
    const b = win.getNormalBounds();
    const s = { x: b.x, y: b.y, width: b.width, height: b.height, maximized: win.isMaximized() };
    try {
      fs.writeFileSync(stateFile, JSON.stringify(s));
    } catch {
      /* not worth failing a close over */
    }
  }

  function createWindow() {
    const saved = readWindowState();
    const work = screen.getPrimaryDisplay().workAreaSize;
    const width = saved?.width ?? Math.min(1320, Math.round(work.width * 0.85));
    const height = saved?.height ?? Math.min(880, Math.round(work.height * 0.88));

    win = new BrowserWindow({
      ...baseWindowOptions(width, height),
      x: saved?.x,
      y: saved?.y,
      minWidth: 480,
      minHeight: 560,
    });

    win.once('ready-to-show', () => {
      if (saved?.maximized) win.maximize();
      win.show();
    });

    // Never navigate the app window away; open web links in the real browser.
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (e, url) => {
      const allowed = DEV_URL ? url.startsWith(DEV_URL) : url.startsWith('file://');
      if (!allowed) {
        e.preventDefault();
        if (/^https?:\/\//i.test(url)) shell.openExternal(url);
      }
    });

    // Right-click menu for text: spelling suggestions, cut, copy, paste.
    win.webContents.on('context-menu', (_e, params) => {
      const items = [];
      if (params.isEditable) {
        for (const s of params.dictionarySuggestions.slice(0, 4)) {
          items.push({ label: s, click: () => win.webContents.replaceMisspelling(s) });
        }
        if (params.misspelledWord) {
          items.push({
            label: 'Add to dictionary',
            click: () => win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
          });
        }
        if (items.length) items.push({ type: 'separator' });
        items.push({ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { type: 'separator' }, { role: 'selectAll' });
      } else if (params.selectionText.trim()) {
        items.push({ role: 'copy' });
      }
      if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
    });

    // F12 / Ctrl+Shift+I open developer tools.
    win.webContents.on('before-input-event', (e, input) => {
      if (input.type !== 'keyDown') return;
      const ctrl = input.control || input.meta;
      if (input.key === 'F12' || (ctrl && input.shift && input.key.toLowerCase() === 'i')) {
        win.webContents.toggleDevTools();
        e.preventDefault();
      }
    });

    // Let the page finish its pending saves before the window goes away.
    let flushed = false;
    win.on('close', (e) => {
      saveWindowState();
      if (flushed) return;
      e.preventDefault();
      const done = () => {
        if (flushed) return;
        flushed = true;
        if (win && !win.isDestroyed()) win.close();
      };
      ipcMain.once('app:flushed', done);
      setTimeout(done, 1500);
      win.webContents.send('app:flush');
    });
    win.on('closed', () => {
      win = null;
    });

    if (DEV_URL) win.loadURL(DEV_URL);
    else win.loadFile(path.join(ROOT, 'dist', 'index.html'));
  }

  function registerIpc() {
    ipcMain.handle('db:load', () => store.loadAll());
    ipcMain.handle('db:apply', (_e, ops) => store.apply(ops));

    ipcMain.handle('data:export', async () => {
      const d = new Date();
      const name = `compass-export-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
      const r = await dialog.showSaveDialog(win, {
        title: 'Export Compass data',
        defaultPath: path.join(app.getPath('documents'), name),
        filters: [{ name: 'Compass export', extensions: ['json'] }],
      });
      if (r.canceled || !r.filePath) return null;
      store.exportTo(r.filePath);
      return r.filePath;
    });

    ipcMain.handle('data:import', async () => {
      const r = await dialog.showOpenDialog(win, {
        title: 'Import Compass data',
        properties: ['openFile'],
        filters: [{ name: 'Compass export', extensions: ['json'] }],
      });
      if (r.canceled || !r.filePaths[0]) return false;
      const ok = await dialog.showMessageBox(win, {
        type: 'warning',
        title: 'Replace all data?',
        message: 'Replace everything in Compass with this file?',
        detail: 'A backup of your current data is saved first, so this can be undone from the backups folder.',
        buttons: ['Replace', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
      });
      if (ok.response !== 0) return false;
      store.importFrom(r.filePaths[0]);
      return true;
    });

    ipcMain.handle('data:backup', () => store.backup('manual'));
    ipcMain.handle('data:dir', () => app.getPath('userData'));
    ipcMain.handle('data:open-folder', () => shell.openPath(app.getPath('userData')));

    // Updates: check GitHub, then download + verify + hand over to the new version.
    ipcMain.handle('update:check', () => updater.check());
    let updating = false;
    ipcMain.handle('update:install', async (e) => {
      if (updating) return;
      updating = true;
      try {
        const exe = await updater.stage((p, label) => {
          if (!e.sender.isDestroyed()) e.sender.send('update:progress', p, label);
        });
        updater.handOff(exe);
        setTimeout(() => app.quit(), 200); // the window's close handler saves first
      } catch (err) {
        updating = false;
        throw err;
      }
    });

    // "Start over": back up, then empty everything so setup runs again.
    ipcMain.handle('data:reset', () => {
      store.backup('pre-reset');
      store.clearAll();
    });

    registerCommonIpc(() => win);
  }

  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    const dir = app.getPath('userData');
    store = new Store(path.join(dir, 'compass.db'), path.join(dir, 'backups'));
    try {
      store.backupIfDue();
    } catch (e) {
      console.error('backup skipped:', e);
    }
    registerIpc();
    createWindow();
    // Leftover update downloads are removed once the new version is up and running.
    if (app.isPackaged) setTimeout(updater.cleanupStaged, 15000);
  });

  app.on('window-all-closed', () => {
    store?.close();
    app.quit();
  });
}
