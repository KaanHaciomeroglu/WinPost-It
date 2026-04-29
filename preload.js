const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('postit', {
  init:  (callback) => ipcRenderer.on('note:init', (_e, note) => callback(note)),
  save:  (note) => ipcRenderer.send('note:save', note),
  close: (note) => ipcRenderer.invoke('note:close', note),
  new:   () => ipcRenderer.send('note:new'),
});
