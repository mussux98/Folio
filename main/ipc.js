const { ipcMain, shell } = require('electron');
const channels = require('../shared/ipc-channels');
const { parseSession, parseView, parseExternalLink, parseNames, parseWrite, parseSignaturePng, parseFontRequest, parsePartsRequest } = require('./validate');
const { readPdf } = require('./pdf-path');

function registerIpc({ settings, documents, saving, pageDialogs, signatures, systemFonts, getWindow }) {
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

  // The renderer gets the bytes or a message it can show; never a raw exception.
  ipcMain.handle(channels.FILE_READ, async (event, filePath) => {
    if (!fromWindow(event)) return { error: 'Not allowed.' };
    try {
      return { bytes: await readPdf(filePath) };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle(channels.PRINT_RUN, (event) => {
    if (!fromWindow(event)) return false;
    return new Promise((resolve) => {
      event.sender.print({ printBackground: true }, (printed) => resolve(printed));
    });
  });

  ipcMain.handle(channels.DIALOG_SAVE, (event, current) => {
    if (fromWindow(event)) return saving.chooseSavePath(typeof current === 'string' ? current : undefined);
    return null;
  });

  ipcMain.handle(channels.DIALOG_ASK_SAVE, (event, value) => {
    const names = fromWindow(event) && parseNames(value);
    return names && names.length ? saving.askToSave(names) : 'cancel';
  });

  ipcMain.handle(channels.FILE_WRITE, (event, filePath, bytes) => {
    const request = fromWindow(event) && parseWrite(filePath, bytes);
    return request ? saving.write(request.filePath, request.bytes) : false;
  });

  ipcMain.handle(channels.WINDOW_CLOSE, (event) => {
    if (fromWindow(event)) saving.closeWindow();
  });

  ipcMain.handle(channels.SIGNATURES_LIST, (event) => (fromWindow(event) ? signatures.list() : []));

  // Resolves to the new id, or null when the picture is unusable or the library is full.
  ipcMain.handle(channels.SIGNATURES_ADD, async (event, png) => {
    const clean = fromWindow(event) && parseSignaturePng(png);
    return clean ? signatures.add(clean) : null;
  });

  ipcMain.handle(channels.SIGNATURES_REMOVE, (event, id) => (fromWindow(event) && typeof id === 'string' ? signatures.remove(id) : false));

  // The installed font a PDF names, for text edits; null when there is none.
  ipcMain.handle(channels.FONTS_FIND, async (event, value) => {
    const request = fromWindow(event) && parseFontRequest(value);
    if (!request) return null;
    try {
      return await systemFonts.find(request.name, request.bold, request.italic);
    } catch {
      return null;
    }
  });

  ipcMain.handle(channels.PAGES_PICK_FILES, (event) => (fromWindow(event) ? pageDialogs.pickPdfs() : []));

  ipcMain.handle(channels.PAGES_PICK_PARTS, (event, current, count) => {
    const ok = fromWindow(event) && parsePartsRequest(current, count);
    return ok ? pageDialogs.choosePartPaths(current, count) : null;
  });

  ipcMain.on(channels.DIRTY_SET, (event, value) => {
    const names = fromWindow(event) && parseNames(value);
    if (names) saving.setDirty(names);
  });

  ipcMain.on(channels.LINK_OPEN, (event, value) => {
    const url = fromWindow(event) && parseExternalLink(value);
    if (url) shell.openExternal(url);
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
