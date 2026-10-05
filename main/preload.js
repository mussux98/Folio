// Exposes only the functions listed in shared/ipc-channels.js (none yet).
// A sandboxed preload cannot require local files, so channels get wired in here
// when the first one is added.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('folio', Object.freeze({}));
