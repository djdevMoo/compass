// The only bridge between the page and the system. The page gets these few
// functions and nothing else (no Node, no file system).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('compass', {
  loadAll: () => ipcRenderer.invoke('db:load'),
  apply: (ops) => ipcRenderer.invoke('db:apply', ops),
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: () => ipcRenderer.invoke('data:import'),
  backupNow: () => ipcRenderer.invoke('data:backup'),
  openDataFolder: () => ipcRenderer.invoke('data:open-folder'),
  dataDir: () => ipcRenderer.invoke('data:dir'),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
  setTheme: (source, resolved) => ipcRenderer.invoke('win:theme', source, resolved),
  resetData: () => ipcRenderer.invoke('data:reset'),
  installInfo: () => ipcRenderer.invoke('install:info'),
  install: (opts) => ipcRenderer.invoke('install:run', opts),
  launchInstalled: () => ipcRenderer.invoke('install:launch'),
  onInstallProgress: (fn) => {
    ipcRenderer.removeAllListeners('install:progress');
    ipcRenderer.on('install:progress', (_e, p, label) => fn(p, label));
  },
  onFlushRequest: (fn) => {
    ipcRenderer.removeAllListeners('app:flush');
    ipcRenderer.on('app:flush', async () => {
      try {
        await fn();
      } finally {
        ipcRenderer.send('app:flushed');
      }
    });
  },
});
