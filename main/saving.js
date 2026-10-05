const { dialog } = require('electron');
const path = require('path');
const { writeFileAtomic } = require('./save-file');
const { MENU_COMMAND } = require('../shared/ipc-channels');

const CHOICES = ['save', 'discard', 'cancel'];

// Saving and the "Save changes?" questions (rules 14 and 15). Folio only
// writes to files the user opened or picked in the Save As dialog.
function createSaving({ settings, getWindow, onRecentChanged }) {
  const writable = new Set();
  let dirtyNames = []; // the tabs with unsaved changes, as the window reports them
  let asking = false;
  let quitting = false;

  // Dialogs belong to the window when there is one.
  const show = (kind, options) => {
    const win = getWindow();
    return win ? dialog[kind](win, options) : dialog[kind](options);
  };

  function allowWrite(filePath) {
    writable.add(filePath);
  }

  async function chooseSavePath(current) {
    const { canceled, filePath } = await show('showSaveDialog', {
      defaultPath: current,
      filters: [{ name: 'PDF documents', extensions: ['pdf'] }],
    });
    if (canceled || !filePath) return null;
    const chosen = path.extname(filePath).toLowerCase() === '.pdf' ? filePath : `${filePath}.pdf`;
    writable.add(chosen);
    return chosen;
  }

  // Returns true once the file is safely on disk; otherwise the user is told why.
  async function write(filePath, bytes) {
    if (!writable.has(filePath)) return false;
    try {
      await writeFileAtomic(filePath, bytes);
    } catch (err) {
      show('showMessageBox', {
        type: 'error',
        title: 'Folio',
        message: `Can't save ${path.basename(filePath)}`,
        detail: err.message,
      });
      return false;
    }
    settings.addRecent(filePath);
    onRecentChanged();
    return true;
  }

  // 'save', 'discard' or 'cancel'.
  async function askToSave(names) {
    const one = names.length === 1;
    const { response } = await show('showMessageBox', {
      type: 'warning',
      title: 'Folio',
      message: one
        ? `Do you want to save the changes to ${names[0]}?`
        : `Do you want to save the changes to ${names.length} documents?`,
      detail: `${one ? '' : `${names.join('\n')}\n\n`}Your changes will be lost if you don't save them.`,
      buttons: [one ? 'Save' : 'Save All', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    });
    return CHOICES[response];
  }

  // Closing the window (or quitting) with unsaved changes asks first. To save,
  // the window is told to save everything; it then asks to close again.
  function guardWindow(win) {
    let discard = false;
    win.on('close', async (event) => {
      if (discard || !dirtyNames.length) return;
      event.preventDefault();
      if (asking) return;
      asking = true;
      const choice = await askToSave(dirtyNames).finally(() => { asking = false; });
      if (choice === 'cancel') {
        quitting = false;
      } else if (choice === 'discard') {
        discard = true;
        win.close();
      } else {
        win.webContents.send(MENU_COMMAND, 'save-all-and-close');
      }
    });
  }

  return {
    allowWrite,
    chooseSavePath,
    write,
    askToSave,
    guardWindow,
    setDirty: (names) => { dirtyNames = names; },
    closeWindow: () => getWindow()?.close(),
    // A quit that was held up by the question goes on once the window is closed.
    startQuit: () => { quitting = true; },
    get quitting() { return quitting; },
  };
}

module.exports = { createSaving };
