const { app, BrowserWindow } = require('electron');
const path = require('path');
const { Settings } = require('./settings');
const { createMainWindow, getMainWindow, lockDownSession } = require('./window');
const { createDocuments } = require('./documents');
const { createSaving } = require('./saving');
const { createSignatureLibrary } = require('./signature-library');
const { buildMenu } = require('./menu');
const { registerIpc } = require('./ipc');
const { createSystemFonts } = require('./system-fonts');
const { pdfPathsFromArgv } = require('./pdf-path');
const { MENU_COMMAND } = require('../shared/ipc-channels');

// Rule 18: one Folio at a time. A second launch hands its files to the first.
const isFirstInstance = app.requestSingleInstanceLock();
if (!isFirstInstance) app.quit();

let settings;
let documents;
let saving;

function openWindow() {
  const win = createMainWindow(settings);
  saving.guardWindow(win);
  win.on('closed', () => {
    documents.reset();
    saving.setDirty([]);
    if (saving.quitting) app.quit();
  });
}

function refreshMenu() {
  buildMenu({
    recent: settings.recent,
    actions: {
      openDialog: () => documents.openDialog(),
      openRecent: (filePath) => documents.openDocument(filePath),
      clearRecent: () => {
        settings.clearRecent();
        refreshMenu();
      },
      command: (name) => getMainWindow()?.webContents.send(MENU_COMMAND, name),
    },
  });
}

function openFiles(filePaths) {
  for (const filePath of filePaths) documents.openDocument(filePath);
}

// Mac: must be registered before the app is ready (rule 17).
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (documents) documents.openDocument(filePath);
});

app.on('second-instance', (_event, argv, workingDir) => {
  const win = getMainWindow();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  } else {
    openWindow();
  }
  openFiles(pdfPathsFromArgv(argv.slice(1), workingDir));
});

function start() {
  settings = new Settings(path.join(app.getPath('userData'), 'settings.json'));
  saving = createSaving({ settings, getWindow: getMainWindow, onRecentChanged: refreshMenu });
  documents = createDocuments({
    settings,
    getWindow: getMainWindow,
    openWindow,
    onRecentChanged: refreshMenu,
    allowWrite: saving.allowWrite,
  });
  const signatures = createSignatureLibrary(path.join(app.getPath('userData'), 'signatures'));
  registerIpc({ settings, documents, saving, signatures, systemFonts: createSystemFonts(), getWindow: getMainWindow });
  lockDownSession();
  refreshMenu();

  // Files from the command line wait in the queue until the window is ready.
  openFiles(pdfPathsFromArgv(process.argv.slice(1), process.cwd()));
  if (!getMainWindow()) openWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openWindow();
  });
}

if (isFirstInstance) app.whenReady().then(start);

app.on('before-quit', () => {
  saving?.startQuit();
  settings?.flush();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
