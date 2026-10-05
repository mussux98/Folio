// Editing the text that is part of a page. The old line is removed with a
// redaction, so its letters are really gone from the file, not covered up, and
// the new text is written in the same place: with the line's own font when
// the file's copy has every letter, else the same font installed on this
// computer, else the closest standard font.
// Positions are in page space (see coords.js).
//
// Every change remembers the page's content and resources from before and
// after it. Undo and redo swap them back in; the old objects stay in memory
// only, and Save leaves out the ones no page uses any more.
import * as mupdf from '../node_modules/mupdf/dist/mupdf.js';
import { standardFont, styleOf, looksStandard, winAnsiBytes } from './standard-fonts.js';
import { findEmbedded, documentFonts, withoutTag } from './embedded-fonts.js';

const LEADING = 1.2; // line spacing of new text, in font sizes
const NEAR = 1; // points; a click this close to a line is on it
const NBSP = ' ';
const SPACE = 0.25; // width of a space, in font sizes, when the line has none to measure

const num = (n) => String(Math.round(n * 1000) / 1000);

function rgbOf(color) {
  return Array.isArray(color) && color.length === 3 ? color : [0, 0, 0];
}

// The lines of a page with their characters. The fonts are only lent to the
// walker, so their style is read at once.
function readLines(page) {
  const text = page.toStructuredText('preserve-whitespace');
  const lines = [];
  let line = null;
  try {
    text.walk({
      beginLine(_bbox, _wmode, dir) { line = { dir, chars: [] }; },
      onChar(c, origin, font, size, quad, color) {
        line.chars.push({ c, origin, size, quad, color, style: { ...styleOf(font), id: font.getName() } });
      },
      endLine() {
        if (line.chars.some((char) => char.c.trim())) lines.push(line);
        line = null;
      },
    });
  } finally {
    text.destroy();
  }
  return lines;
}

function boundsOf(chars) {
  const xs = chars.flatMap(({ quad }) => [quad[0], quad[2], quad[4], quad[6]]);
  const ys = chars.flatMap(({ quad }) => [quad[1], quad[3], quad[5], quad[7]]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// What the editor needs to know about one line. area is what gets redacted:
// the middle half of the line, since a letter goes when its middle is inside,
// and the lines above and below must stay.
// Spaces at either end are left out, so the caret ends where the text does.
function describe({ dir, chars: all }) {
  const inked = all.map((char) => Boolean(char.c.trim()));
  const chars = all.slice(inked.indexOf(true), inked.lastIndexOf(true) + 1);
  const box = boundsOf(chars);
  const first = chars[0];
  const [x, y] = first.origin;
  const spaces = chars.filter((char) => char.c === ' ' || char.c === NBSP).map(({ quad, size }) => (quad[2] - quad[0]) / size);
  return {
    ...box,
    text: chars.map((char) => (char.c === NBSP ? ' ' : char.c)).join(''),
    origin: { x, y },
    size: first.size,
    color: rgbOf(first.color),
    space: spaces.length ? spaces.reduce((a, b) => a + b) / spaces.length : SPACE,
    font: first.style,
    standard: looksStandard(first.style.name),
    straight: Math.abs(dir[1]) < 0.001 && dir[0] > 0,
    area: { x: box.x - 0.5, y: box.y + box.h / 4, w: box.w + 1, h: box.h / 2 },
  };
}

export function createTextEdits(doc, withPage) {
  const changes = new Map(); // key -> { index, before, after }
  const fonts = new Map(); // standard name + kind, or installed font key -> { font, ref }
  let wholeFonts = false; // an installed font went in whole and needs subsetting on Save
  let knownFonts = null; // see known()
  const drawn = new Map(); // font name in the file -> the characters drawn with it
  const scanned = new Set(); // pages already read into drawn
  let nextKey = 1;

  // The line under a point, or null. Where lines overlap, the smaller one wins.
  function lineAt(index, { x, y }) {
    const hits = withPage(index, readLines).map(describe).filter((line) => (
      x >= line.x - NEAR && x <= line.x + line.w + NEAR && y >= line.y - NEAR && y <= line.y + line.h + NEAR
    ));
    hits.sort((a, b) => a.w * a.h - b.w * b.h);
    return hits[0] ?? null;
  }

  // Codes for a font MuPDF adds whole: its glyph numbers. Its ToUnicode table
  // reads the space glyph as a no-break space, so spaces are left as gaps.
  const glyphs = (font) => (char) => (char === ' ' ? undefined : font.encodeCharacter(char.codePointAt(0)));

  // Text that WinAnsi can hold uses the plain standard font; anything else
  // embeds MuPDF's copy of it.
  function standardFor(style, text) {
    const name = standardFont(style);
    const simple = winAnsiBytes(text) !== null;
    const id = `${name}/${simple ? 'simple' : 'full'}`;
    if (!fonts.has(id)) {
      const font = new mupdf.Font(name);
      fonts.set(id, { font, ref: simple ? doc.addSimpleFont(font, 'Latin') : null });
    }
    const entry = fonts.get(id);
    if (simple) return { name, kind: 'standard', ref: entry.ref, digits: 2, codeOf: (char) => winAnsiBytes(char)[0] };
    const missing = [...new Set(text)].filter((char) => !entry.font.encodeCharacter(char.codePointAt(0)));
    if (missing.length) throw new Error(`The standard fonts can't show these characters: ${missing.join(' ')}`);
    entry.ref ??= doc.addFont(entry.font);
    return { name, kind: 'standard', ref: entry.ref, digits: 4, codeOf: glyphs(entry.font) };
  }

  // installed: { key, family, bytes, index } from the computer's fonts. The whole font
  // goes into the file once; Save keeps only the letters used.
  function installedFor({ key, family, bytes, index }, text) {
    if (!fonts.has(key)) fonts.set(key, { font: new mupdf.Font(family, bytes, index), ref: null });
    const entry = fonts.get(key);
    if ([...text].some((char) => !entry.font.encodeCharacter(char.codePointAt(0)))) return null;
    if (!entry.ref) {
      entry.ref = doc.addFont(entry.font);
      wholeFonts = true;
    }
    return { name: entry.font.getName(), kind: 'installed', ref: entry.ref, digits: 4, codeOf: glyphs(entry.font) };
  }

  // Whether every character of the text is drawn with the font somewhere in
  // the file, so its shape is surely there. Pages are read, the edited one
  // first, only until all are found.
  function allDrawn(index, name, text) {
    const wanted = [...new Set(text)].filter((char) => char !== ' ');
    const missing = () => wanted.some((char) => !drawn.get(name)?.has(char));
    for (const at of [index, ...Array(doc.countPages()).keys()]) {
      if (!missing()) return true;
      if (scanned.has(at)) continue;
      scanned.add(at);
      for (const { chars } of withPage(at, readLines)) {
        for (const { c, style } of chars) {
          if (!drawn.has(style.id)) drawn.set(style.id, new Set());
          drawn.get(style.id).add(c);
        }
      }
    }
    return !missing();
  }

  // The document's fonts, read again after each change since one may add a font.
  function known() {
    knownFonts ??= documentFonts(doc);
    return knownFonts;
  }

  // The fonts the document uses, for the editor: [{ id, name, family, bold, italic }],
  // with id the font's name in the file.
  const listFonts = () => [...known()].map(([id, { style }]) => ({ id, ...style }));

  // Where the text's font comes from, best first: one of the file's fonts
  // (edit.reuse, names in the file), the same font installed here, or the
  // closest standard font. Returns { name, kind, ref, digits, codeOf }.
  function fontFor(index, edit, text) {
    for (const id of edit.reuse ?? []) {
      const own = allDrawn(index, id, text) ? findEmbedded(known().get(id)?.fonts ?? [], text) : null;
      if (own) return { name: withoutTag(id), kind: 'file', ref: own.ref, digits: own.width * 2, codeOf: (char) => own.codes.get(char) };
    }
    return (edit.installed && installedFor(edit.installed, text)) || standardFor(edit.font, text);
  }

  // A line as a TJ array. A space the font has no code for becomes a gap of a space's width.
  function encode(font, line, space) {
    let out = '';
    let run = '';
    for (const char of line) {
      const code = font.codeOf(char);
      if (code === undefined) {
        if (run) out += `<${run}>`;
        out += ` ${num(-space * 1000)} `;
        run = '';
      } else {
        run += code.toString(16).padStart(font.digits, '0');
      }
    }
    return `[${out}${run ? `<${run}>` : ''}]`;
  }

  const snapshot = (obj) => ({ contents: obj.get('Contents'), resources: obj.get('Resources') });

  function restore(obj, { contents, resources }) {
    for (const [key, value] of [['Contents', contents], ['Resources', resources]]) {
      if (value.isNull()) obj.delete(key);
      else obj.put(key, value);
    }
  }

  // The page gets its own copy of its resources (they may be shared or
  // inherited), and the font goes in under a name not used yet.
  function addFontResource(obj, ref) {
    const old = obj.getInheritable('Resources');
    const resources = doc.newDictionary();
    if (old.isDictionary()) old.forEach((value, key) => resources.put(key, value));
    const list = doc.newDictionary();
    const oldList = resources.get('Font');
    if (oldList.isDictionary()) oldList.forEach((value, key) => list.put(key, value));
    let n = 1;
    while (!list.get(`FolioF${n}`).isNull()) n++;
    list.put(`FolioF${n}`, ref);
    resources.put('Font', list);
    obj.put('Resources', resources);
    return `FolioF${n}`;
  }

  // The page's own drawing is wrapped in q/Q so nothing it leaves set moves the new text.
  function appendContent(obj, ops) {
    const old = obj.get('Contents');
    const parts = doc.newArray();
    if (!old.isNull()) {
      parts.push(doc.addStream('q\n', {}));
      if (old.isArray()) old.forEach((part) => parts.push(part));
      else parts.push(old);
      ops = `Q\n${ops}`;
    }
    parts.push(doc.addStream(ops, {}));
    obj.put('Contents', parts);
  }

  // Each line starts at its origin on the page as displayed; the text matrix
  // maps that back to the file's own space, whatever the page's turn or crop.
  function write(page, font, { origin, size, color, space = SPACE }, lines) {
    const obj = page.getObject();
    const resource = addFontResource(obj, font.ref);
    const back = mupdf.Matrix.invert(page.getTransform());
    const shown = lines.map((line, i) => {
      const matrix = mupdf.Matrix.concat([1, 0, 0, -1, origin.x, origin.y + i * size * LEADING], back);
      return `${matrix.map(num).join(' ')} Tm ${encode(font, line, space)} TJ`;
    });
    appendContent(obj, `q BT /${resource} ${num(size)} Tf ${rgbOf(color).map(num).join(' ')} rg ${shown.join(' ')} ET Q\n`);
  }

  function erase(page, { x, y, w, h }) {
    const annot = page.createAnnotation('Redact');
    annot.setRect([x, y, x + w, y + h]);
    annot.applyRedaction(0, mupdf.PDFPage.REDACT_IMAGE_NONE, mupdf.PDFPage.REDACT_LINE_ART_NONE, mupdf.PDFPage.REDACT_TEXT_REMOVE);
  }

  // edit: { area, text, origin, size, space, font: { family, bold, italic }, color: [r, g, b],
  // reuse, installed }. area (the old line) is removed if given; text may hold
  // several lines. reuse is the name in the file of the font to keep, and
  // installed is the same font from this computer (see fontFor).
  // Returns { key, font: { name, kind } }: the change's name for undo, and the font used.
  function replace(index, edit) {
    const lines = edit.text.replace(/\t/g, '    ').split('\n');
    return withPage(index, (page) => {
      const obj = page.getObject();
      // The font is found first: removing the old line may drop it from the page.
      const font = lines.some((line) => line.trim()) ? fontFor(index, edit, lines.join('')) : null;
      const before = snapshot(obj);
      if (edit.area) erase(page, edit.area);
      if (font) write(page, font, edit, lines);
      const key = nextKey++;
      changes.set(key, { index, before, after: snapshot(obj) });
      knownFonts = null;
      return { key, font: font && { name: font.name, kind: font.kind } };
    });
  }

  // which: 'before' undoes the change, 'after' does it again.
  function swap(key, which) {
    const change = changes.get(key);
    if (!change) throw new Error('That text change is no longer known.');
    withPage(change.index, (page) => restore(page.getObject(), change[which]));
    knownFonts = null;
  }

  return { lineAt, listFonts, replace, swap, hasWholeFonts: () => wholeFonts };
}
