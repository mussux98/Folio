const { dialog } = require('electron');
const path = require('path');
const { checkPdfPath } = require('./pdf-path');
const { FILE_OPENED } = require('../shared/ipc-channels');

// Every way of opening a PDF ends up in openDocument (rule 17). It checks the
// file and tells the window about it. Until the window says it is ready,
// requests wait in a queue.
function createDocuments({ settings, getWindow, openWindow, onRecentChanged }) {
  let ready = false;
  let sessionRestored = false;
  const waiting = [];

  // Opens run one after another so tabs appear in the order they were asked for.
  let chain = Promise.resolve();
  function inOrder(task) {
    const run = chain.then(task);
    chain = run.catch(() => {});
    return run;
  }

  function showError(filePath, err) {
    const win = getWindow();
    const options = {
      type: 'error',
      title: 'Folio',
      message: `Can't open ${path.basename(filePath)}`,
      detail: err.message,
    };
    if (win) dialog.showMessageBox(win, options);
    else dialog.showMessageBox(options);
  }

  async function open(filePath, { restore = false, activate = true } = {}) {
    let info;
    try {
      info = await checkPdfPath(filePath);
    } catch (err) {
      if (restore) return false;
      if (err.missing) {
        settings.removeRecent(filePath);
        onRecentChanged();
      }
      showError(filePath, err);
      return false;
    }

    const win = getWindow();
    if (!win) return false;
    if (!restore) {
      settings.addRecent(info.path);
      onRecentChanged();
    }
    win.webContents.send(FILE_OPENED, { ...info, view: settings.getView(info.path), activate });
    if (!restore) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
    return true;
  }

  function openDocument(filePath) {
    if (!ready) {
      waiting.push(filePath);
      if (!getWindow()) openWindow();
      return Promise.resolve(true);
    }
    return inOrder(() => open(filePath));
  }

  async function openDialog() {
    const options = {
      properties: ['openFile', 'multiSelect'],
      filters: [{ name: 'PDF documents', extensions: ['pdf'] }],
    };
    const win = getWindow();
    const { canceled, filePaths } = await (win ? dialog.showOpenDialog(win, options) : dialog.showOpenDialog(options));
    if (canceled) return;
    for (const filePath of filePaths) openDocument(filePath);
  }

  // The window calls this once its scripts are running.
  function handleReady() {
    return inOrder(restoreAndFlush);
  }

  async function restoreAndFlush() {
    if (!sessionRestored) {
      sessionRestored = true;
      const { paths, active } = settings.session;
      // A file passed on launch wins over the remembered active tab.
      const keepActive = waiting.length === 0;
      for (const filePath of paths) {
        await open(filePath, { restore: true, activate: keepActive && filePath === active });
      }
    }
    ready = true;
    for (const filePath of waiting.splice(0)) await open(filePath);
  }

  // The window was closed (Mac keeps the app alive); the next one starts over.
  function reset() {
    ready = false;
  }

  return { openDocument, openDialog, handleReady, reset };
}

module.exports = { createDocuments };
