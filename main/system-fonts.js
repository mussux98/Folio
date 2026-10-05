const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { readFontFile } = require('./font-files');

const MAX_BYTES = 32 * 1024 * 1024; // bigger fonts (whole CJK sets) are left alone
const FONT_FILE = /\.(ttf|otf|ttc)$/i;

// Platform-specific: where each system keeps its installed fonts.
function fontFolders() {
  const home = os.homedir();
  if (process.platform === 'win32') {
    const windows = process.env.WINDIR || 'C:\\Windows';
    const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    return [path.join(windows, 'Fonts'), path.join(local, 'Microsoft', 'Windows', 'Fonts')];
  }
  if (process.platform === 'darwin') {
    return ['/System/Library/Fonts', '/System/Library/Fonts/Supplemental', '/Library/Fonts', path.join(home, 'Library', 'Fonts')];
  }
  return ['/usr/share/fonts', '/usr/local/share/fonts', path.join(home, '.local', 'share', 'fonts')];
}

// Names compared without case, spaces or punctuation: "Arial,Bold" = "Arial Bold".
const plain = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
// Many PDFs add MT or PS to the PostScript name: "TimesNewRomanPSMT".
const trimmed = (key) => key.replace(/(psmt|mt|ps)$/, '');

// The fonts installed on this computer, found by the names PDFs give them.
// The folders are read once, on the first request.
function createSystemFonts(folders = fontFolders()) {
  let index = null;

  async function build() {
    const faces = [];
    for (const folder of folders) {
      let names;
      try {
        names = await fs.readdir(folder);
      } catch {
        continue;
      }
      for (const name of names.filter((n) => FONT_FILE.test(n))) {
        const file = path.join(folder, name);
        try {
          for (const face of await readFontFile(file)) if (face.embeddable) faces.push({ file, ...face });
        } catch {
          // A broken or unreadable font is just left out.
        }
      }
    }
    const byName = new Map();
    const add = (key, face) => { if (key && !byName.has(key)) byName.set(key, face); };
    for (const face of faces) {
      const ps = plain(face.postscript ?? '');
      add(ps, face);
      add(trimmed(ps), face);
      add(plain(face.full ?? ''), face);
      add(plain(`${face.family}${/^regular$/i.test(face.style ?? '') ? '' : face.style ?? ''}`), face);
    }
    return { faces, byName };
  }

  // The face the PDF names; then, in its family, the one with the wanted
  // bold and italic, closest to a normal weight.
  function pick({ faces, byName }, name, bold, italic) {
    const key = plain(name.replace(/^[A-Z]{6}\+/, ''));
    const named = byName.get(key) ?? byName.get(trimmed(key));
    if (!named) return null;
    if (named.bold === bold && named.italic === italic) return named;
    const family = faces.filter((face) => face.family === named.family && face.bold === bold && face.italic === italic);
    const normal = bold ? 700 : 400;
    family.sort((a, b) => Math.abs(a.weight - normal) - Math.abs(b.weight - normal));
    return family[0] ?? null;
  }

  // Returns { key, family, bytes, index } or null when no installed font fits.
  async function find(name, bold, italic) {
    index ??= build();
    const face = pick(await index, name, bold, italic);
    if (!face) return null;
    const stat = await fs.stat(face.file);
    if (stat.size > MAX_BYTES) return null;
    const bytes = new Uint8Array(await fs.readFile(face.file));
    return { key: `${face.file}#${face.index}`, family: face.family, bytes, index: face.index };
  }

  return { find };
}

module.exports = { createSystemFonts };
