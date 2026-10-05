const { dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { partPaths } = require('./part-paths');

// The file and folder questions the page tools ask. Like saving, Folio only
// writes to paths the user picked here.
function createPageDialogs({ getWindow, allowWrite }) {
  const show = (kind, options) => {
    const win = getWindow();
    return win ? dialog[kind](win, options) : dialog[kind](options);
  };

  // PDFs to take pages from, in the order they were picked; [] when cancelled.
  async function pickPdfs() {
    const { canceled, filePaths } = await show('showOpenDialog', {
      title: 'Choose PDFs',
      properties: ['openFile', 'multiSelect'],
      filters: [{ name: 'PDF documents', extensions: ['pdf'] }],
    });
    return canceled ? [] : filePaths;
  }

  // Asks for a folder and gives the paths of count parts named after the current
  // file, or null when cancelled. All of them are allowed to be written.
  async function choosePartPaths(current, count) {
    const { canceled, filePaths } = await show('showOpenDialog', {
      title: 'Choose a folder for the parts',
      defaultPath: path.dirname(current),
      properties: ['openDirectory', 'createDirectory'],
    });
    if (canceled || !filePaths[0]) return null;
    const base = path.basename(current, path.extname(current));
    const paths = partPaths(filePaths[0], base, count, fs.existsSync);
    paths.forEach(allowWrite);
    return paths;
  }

  return { pickPdfs, choosePartPaths };
}

module.exports = { createPageDialogs };
