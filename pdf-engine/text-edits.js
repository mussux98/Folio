// Editing the text that is part of a page. The old line is removed with a
// redaction, so its letters are really gone from the file, not covered up, and
// the new text is written in the same place with the closest standard font.
// Positions are in page space (see coords.js).
//
// Every change remembers the page's content and resources from before and
// after it. Undo and redo swap them back in; the old objects stay in memory
// only, and Save leaves out the ones no page uses any more.
import * as mupdf from '../node_modules/mupdf/dist/mupdf.js';
import { standardFont, styleOf, looksStandard, winAnsiBytes } from './standard-fonts.js';

const LEADING = 1.2; // line spacing of new text, in font sizes
const NEAR = 1; // points; a click this close to a line is on it

const hex = (codes, width) => codes.map((code) => code.toString(16).padStart(width, '0')).join('');
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
      onChar(c, origin, font, size, quad, color) { line.chars.push({ c, origin, size, quad, color, style: styleOf(font) }); },
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
  return {
    ...box,
    text: chars.map((char) => char.c).join(''),
    origin: { x, y },
    size: first.size,
    color: rgbOf(first.color),
    font: first.style,
    standard: looksStandard(first.style.name),
    straight: Math.abs(dir[1]) < 0.001 && dir[0] > 0,
    area: { x: box.x - 0.5, y: box.y + box.h / 4, w: box.w + 1, h: box.h / 2 },
  };
}

export function createTextEdits(doc, withPage) {
  const changes = new Map(); // key -> { index, before, after }
  const fonts = new Map(); // standard name + kind -> { font, ref }
  let nextKey = 1;

  // The line under a point, or null. Where lines overlap, the smaller one wins.
  function lineAt(index, { x, y }) {
    const hits = withPage(index, readLines).map(describe).filter((line) => (
      x >= line.x - NEAR && x <= line.x + line.w + NEAR && y >= line.y - NEAR && y <= line.y + line.h + NEAR
    ));
    hits.sort((a, b) => a.w * a.h - b.w * b.h);
    return hits[0] ?? null;
  }

  // The font object for the text, added to the file once. Text that WinAnsi can
  // hold uses the plain standard font; anything else embeds MuPDF's copy of it.
  function fontFor(style, text) {
    const name = standardFont(style);
    const simple = winAnsiBytes(text) !== null;
    const id = `${name}/${simple ? 'simple' : 'full'}`;
    if (!fonts.has(id)) {
      const font = new mupdf.Font(name);
      fonts.set(id, { font, ref: simple ? doc.addSimpleFont(font, 'Latin') : null });
    }
    const entry = fonts.get(id);
    if (simple) return { name, ref: entry.ref, encode: (line) => `<${hex(winAnsiBytes(line), 2)}>` };
    const missing = [...new Set([...text].filter((char) => !entry.font.encodeCharacter(char.codePointAt(0))))];
    if (missing.length) throw new Error(`The standard fonts can't show these characters: ${missing.join(' ')}`);
    entry.ref ??= doc.addFont(entry.font);
    return { name, ref: entry.ref, encode: (line) => `<${hex([...line].map((c) => entry.font.encodeCharacter(c.codePointAt(0))), 4)}>` };
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
  function write(page, font, { origin, size, color }, lines) {
    const obj = page.getObject();
    const resource = addFontResource(obj, font.ref);
    const back = mupdf.Matrix.invert(page.getTransform());
    const shown = lines.map((line, i) => {
      const matrix = mupdf.Matrix.concat([1, 0, 0, -1, origin.x, origin.y + i * size * LEADING], back);
      return `${matrix.map(num).join(' ')} Tm ${font.encode(line)} Tj`;
    });
    appendContent(obj, `q BT /${resource} ${num(size)} Tf ${rgbOf(color).map(num).join(' ')} rg ${shown.join(' ')} ET Q\n`);
  }

  function erase(page, { x, y, w, h }) {
    const annot = page.createAnnotation('Redact');
    annot.setRect([x, y, x + w, y + h]);
    annot.applyRedaction(0, mupdf.PDFPage.REDACT_IMAGE_NONE, mupdf.PDFPage.REDACT_LINE_ART_NONE, mupdf.PDFPage.REDACT_TEXT_REMOVE);
  }

  // edit: { area, text, origin, size, font: { family, bold, italic }, color: [r, g, b] }.
  // area (the old line) is removed if given; text may hold several lines.
  // Returns { key, font }: the change's name for undo, and the standard font used.
  function replace(index, edit) {
    const lines = edit.text.replace(/\t/g, '    ').split('\n');
    const font = lines.some((line) => line.trim()) ? fontFor(edit.font, lines.join('')) : null;
    return withPage(index, (page) => {
      const obj = page.getObject();
      const before = snapshot(obj);
      if (edit.area) erase(page, edit.area);
      if (font) write(page, font, edit, lines);
      const key = nextKey++;
      changes.set(key, { index, before, after: snapshot(obj) });
      return { key, font: font?.name ?? null };
    });
  }

  // which: 'before' undoes the change, 'after' does it again.
  function swap(key, which) {
    const change = changes.get(key);
    if (!change) throw new Error('That text change is no longer known.');
    withPage(change.index, (page) => restore(page.getObject(), change[which]));
  }

  return { lineAt, replace, swap };
}
