// Exposes only the functions that use the channels listed in shared/ipc-channels.js.
// A sandboxed preload can't require local files, so the names are repeated here;
// tests/ipc-channels.test.js checks that both lists match.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

function listen(channel, callback) {
  ipcRenderer.on(channel, (_event, payload) => callback(payload));
}

contextBridge.exposeInMainWorld('folio', Object.freeze({
  appReady: () => ipcRenderer.invoke('app:ready'),
  openDialog: () => ipcRenderer.invoke('dialog:open'),
  openFile: (path) => ipcRenderer.invoke('file:open', path),
  readFile: (path) => ipcRenderer.invoke('file:read', path),
  print: () => ipcRenderer.invoke('print:run'),
  chooseSavePath: (path) => ipcRenderer.invoke('dialog:save', path),
  askToSave: (names) => ipcRenderer.invoke('dialog:ask-save', names),
  writeFile: (path, bytes) => ipcRenderer.invoke('file:write', path, bytes),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  listSignatures: () => ipcRenderer.invoke('signatures:list'),
  addSignature: (png) => ipcRenderer.invoke('signatures:add', png),
  removeSignature: (id) => ipcRenderer.invoke('signatures:remove', id),
  pickPdfs: () => ipcRenderer.invoke('pages:pick-files'),
  choosePartPaths: (path, count) => ipcRenderer.invoke('pages:pick-parts', path, count),
  findFont: (request) => ipcRenderer.invoke('fonts:find', request),
  saveSession: (session) => ipcRenderer.send('session:save', session),
  saveView: (view) => ipcRenderer.send('view:save', view),
  openLink: (url) => ipcRenderer.send('link:open', url),
  setDirty: (names) => ipcRenderer.send('dirty:set', names),
  onFileOpened: (callback) => listen('file:opened', callback),
  onMenuCommand: (callback) => listen('menu:command', callback),
  // Dropped files have no path in the page; the preload can read it.
  pathForFile: (file) => webUtils.getPathForFile(file),
}));
