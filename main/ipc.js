const { ipcMain } = require('electron');
const channels = require('../shared/ipc-channels');
const { parseSession, parseView } = require('./validate');

function registerIpc({ settings, documents, getWindow }) {
  // Only the Folio window may talk to the main process.
  const fromWindow = (event) => event.sender === getWindow()?.webContents;

  ipcMain.handle(channels.APP_READY, (event) => {
    if (fromWindow(event)) return documents.handleReady();
  });

  ipcMain.handle(channels.DIALOG_OPEN, (event) => {
    if (fromWindow(event)) return documents.openDialog();
  });

  ipcMain.handle(channels.FILE_OPEN, (event, filePath) => {
    if (!fromWindow(event) || typeof filePath !== 'string') return false;
    return documents.openDocument(filePath);
  });

  ipcMain.on(channels.SESSION_SAVE, (event, value) => {
    const session = fromWindow(event) && parseSession(value);
    if (session) settings.setSession(session);
  });

  ipcMain.on(channels.VIEW_SAVE, (event, value) => {
    const view = fromWindow(event) && parseView(value);
    if (view) settings.setView(view.path, view);
  });
}

module.exports = { registerIpc };
