const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dialogApi', {
  respond: (action) => ipcRenderer.send('dialog:response', action),
  onTheme: (cb) => ipcRenderer.on('dialog:theme', (_e, isDark) => cb(isDark)),
});
