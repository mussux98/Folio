const fs = require('fs/promises');
const path = require('path');
const { readFontFile } = require('./font-files');

// Fonts that ship with the app, used when a PDF names a font that isn't
// installed (most often on a Mac). Each has the same letter widths as the font
// it stands in for, so an edited line keeps its length.
// Liberation and Carlito are under the SIL Open Font License (see fonts/).
const FOLDER = path.join(__dirname, 'fonts');
const FILE = /\.ttf$/i;

// The names PDFs give, without case, spaces or punctuation, and the family
// that stands in. Longer names come first so "timesnewroman" wins over "times".
const STAND_INS = [
  ['timesnewroman', 'Liberation Serif'],
  ['couriernew', 'Liberation Mono'],
  ['helvetica', 'Liberation Sans'],
  ['arial', 'Liberation Sans'],
  ['times', 'Liberation Serif'],
  ['courier', 'Liberation Mono'],
  ['calibri', 'Carlito'],
];

const plain = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

function standIn(name) {
  const key = plain(name.replace(/^[A-Z]{6}\+/, ''));
  return STAND_INS.find(([start]) => key.startsWith(start))?.[1] ?? null;
}

function createLookalikes(folder = FOLDER) {
  let faces = null;

  async function load() {
    const found = [];
    for (const name of (await fs.readdir(folder)).filter((n) => FILE.test(n))) {
      const file = path.join(folder, name);
      for (const face of await readFontFile(file)) found.push({ file, ...face });
    }
    return found;
  }

  // Returns { key, family, bytes, index } or null when the name has no look-alike.
  async function find(name, bold, italic) {
    const family = standIn(name);
    if (!family) return null;
    faces ??= load();
    const face = (await faces).find((f) => f.family === family && f.bold === bold && f.italic === italic);
    if (!face) return null;
    const bytes = new Uint8Array(await fs.readFile(face.file));
    return { key: `${face.file}#${face.index}`, family: face.family, bytes, index: face.index };
  }

  return { find };
}

module.exports = { createLookalikes };
