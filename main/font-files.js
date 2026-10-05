const fs = require('fs/promises');

// Reads the names and flags of the fonts inside one font file (.ttf, .otf or a
// .ttc collection) without loading the whole file: only the header and the
// 'name' and 'OS/2' tables are read.

const NAME_IDS = { 1: 'family', 2: 'style', 4: 'full', 6: 'postscript', 16: 'family', 17: 'style' };

async function readAt(handle, position, length) {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buffer, 0, length, position);
  if (bytesRead < length) throw new Error('Font file is cut short.');
  return buffer;
}

async function readTable(handle, tables, tag, max) {
  const entry = tables.get(tag);
  if (!entry || entry.length > max) return null;
  return readAt(handle, entry.offset, entry.length);
}

function decode(buffer, platform, encoding) {
  if (platform === 3 || platform === 0) {
    let text = '';
    for (let at = 0; at + 1 < buffer.length; at += 2) text += String.fromCharCode(buffer.readUInt16BE(at));
    return text;
  }
  return platform === 1 && encoding === 0 ? buffer.toString('latin1') : null;
}

// English Windows names win over Mac ones; IDs 16 and 17 (the typographic
// family and style) win over 1 and 2, since 1 and 2 split big families up.
function parseNames(table) {
  const count = table.readUInt16BE(2);
  const strings = table.readUInt16BE(4);
  const found = {};
  const rank = {};
  for (let i = 0; i < count; i++) {
    const at = 6 + i * 12;
    if (at + 12 > table.length) break;
    const [platform, encoding, language, id, length, offset] = [0, 2, 4, 6, 8, 10].map((n) => table.readUInt16BE(at + n));
    const key = NAME_IDS[id];
    if (!key) continue;
    const score = (platform === 3 && language === 0x409 ? 2 : platform === 1 ? 1 : 0) + (id >= 16 ? 4 : 0);
    if (score <= (rank[key] ?? -1)) continue;
    const start = strings + offset;
    if (start + length > table.length) continue;
    const text = decode(table.subarray(start, start + length), platform, encoding);
    if (text) {
      found[key] = text;
      rank[key] = score;
    }
  }
  return found;
}

async function readFace(handle, offset) {
  const header = await readAt(handle, offset, 12);
  const count = header.readUInt16BE(4);
  const directory = await readAt(handle, offset + 12, count * 16);
  const tables = new Map();
  for (let i = 0; i < count; i++) {
    const at = i * 16;
    tables.set(directory.toString('latin1', at, at + 4), { offset: directory.readUInt32BE(at + 8), length: directory.readUInt32BE(at + 12) });
  }
  const name = await readTable(handle, tables, 'name', 1 << 20);
  if (!name) return null;
  const os2 = await readTable(handle, tables, 'OS/2', 1024);
  const names = parseNames(name);
  if (!names.family) return null;
  const fsType = os2 && os2.length >= 10 ? os2.readUInt16BE(8) : 0;
  const selection = os2 && os2.length >= 64 ? os2.readUInt16BE(62) : 0;
  const weight = os2 && os2.length >= 6 ? os2.readUInt16BE(4) : 400;
  const style = (names.style ?? '').toLowerCase();
  return {
    ...names,
    weight,
    bold: Boolean(selection & 0x20) || weight >= 600 || /bold|black|heavy/.test(style),
    italic: Boolean(selection & 0x01) || /italic|oblique/.test(style),
    // Bit 1 alone: the maker forbids embedding. Bit 9: only bitmaps may be embedded.
    embeddable: (fsType & 0x000f) !== 0x0002 && !(fsType & 0x0200),
  };
}

// Every font in a file: [{ index, family, style, full, postscript, weight, bold, italic, embeddable }].
async function readFontFile(file) {
  const handle = await fs.open(file, 'r');
  try {
    const head = await readAt(handle, 0, 12);
    const offsets = [];
    if (head.toString('latin1', 0, 4) === 'ttcf') {
      const count = Math.min(head.readUInt32BE(8), 64);
      const list = await readAt(handle, 12, count * 4);
      for (let i = 0; i < count; i++) offsets.push(list.readUInt32BE(i * 4));
    } else {
      offsets.push(0);
    }
    const faces = [];
    for (const [index, offset] of offsets.entries()) {
      const face = await readFace(handle, offset);
      if (face) faces.push({ index, ...face });
    }
    return faces;
  } finally {
    await handle.close();
  }
}

module.exports = { readFontFile };
