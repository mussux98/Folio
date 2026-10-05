const { BrowserWindow, Menu, screen, session } = require('electron');
const path = require('path');

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const SAVE_DEBOUNCE_MS = 400;

let mainWindow = null;

function getMainWindow() {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
}

function lockDownSession() {
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({
      responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [CSP] },
    });
  });
  // Rule 6: no permission requests (camera, notifications, ...) are granted.
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
}

// A saved position is only reused if it still lands on a connected screen.
function visibleBounds(state) {
  const bounds = { width: state.width, height: state.height };
  if (!Number.isFinite(state.x) || !Number.isFinite(state.y)) return bounds;
  const onScreen = screen.getAllDisplays().some(({ workArea: a }) =>
    state.x < a.x + a.width && state.x + state.width > a.x &&
    state.y < a.y + a.height && state.y + state.height > a.y);
  return onScreen ? { ...bounds, x: state.x, y: state.y } : bounds;
}

function contextMenuFor(params) {
  const { editFlags } = params;
  return Menu.buildFromTemplate([
    { role: 'cut', enabled: editFlags.canCut },
    { role: 'copy', enabled: editFlags.canCopy },
    { role: 'paste', enabled: editFlags.canPaste },
    { type: 'separator' },
    { role: 'selectAll', enabled: editFlags.canSelectAll },
  ]);
}

function createMainWindow(settings) {
  const saved = settings.windowState;
  const win = new BrowserWindow({
    ...visibleBounds(saved),
    title: 'Folio',
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindow = win;
  if (saved.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());

  // Rule 4: never navigate or open windows inside Folio.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.on('context-menu', (_e, params) => contextMenuFor(params).popup({ window: win }));

  // Remember size and position; getNormalBounds ignores maximized/minimized state.
  let timer = null;
  const remember = () => {
    if (win.isDestroyed()) return;
    settings.setWindowState({ ...win.getNormalBounds(), maximized: win.isMaximized() });
  };
  const rememberSoon = () => {
    clearTimeout(timer);
    timer = setTimeout(remember, SAVE_DEBOUNCE_MS);
  };
  win.on('resize', rememberSoon);
  win.on('move', rememberSoon);
  win.on('maximize', rememberSoon);
  win.on('unmaximize', rememberSoon);
  win.on('close', () => {
    clearTimeout(timer);
    remember();
  });
  win.on('closed', () => { mainWindow = null; });

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  return win;
}

module.exports = { createMainWindow, getMainWindow, lockDownSession };
