// The text layer OCR adds to a scanned page: each recognised word is written
// where it shows on the picture, in invisible text (render mode 3), so it can
// be found, selected and copied but nothing on the page looks different.
// Like redactions, each page keeps its content from before and after, so undo
// and redo swap one for the other until the file is saved.
import * as mupdf from '../node_modules/mupdf/dist/mupdf.js';
import { winAnsiBytes } from './standard-fonts.js';

const MAX_PIXELS = 6000; // longest side of the picture handed to OCR
const MIN_SCALE = 0.1;

const num = (n) => String(Math.round(n * 1000) / 1000);

// Only the letters the standard font has; anything else is left out of the word.
function encodable(text) {
  return [...text].filter((char) => winAnsiBytes(char)).join('');
}

export function createOcrText(doc, withPage) {
  const changes = new Map(); // key -> { index, before, after }
  let nextKey = 1;
  let font = null; // { font, ref }, added to the file the first time it is needed

  function helvetica() {
    if (!font) {
      const loaded = new mupdf.Font('Helvetica');
      font = { font: loaded, ref: doc.addSimpleFont(loaded, 'Latin') };
    }
    return font;
  }

  // The page as a grey PNG at dpi, for OCR. scale is the pixels per point it ended up with.
  function picture(index, dpi) {
    return withPage(index, (page) => {
      const [x0, y0, x1, y1] = page.getBounds();
      const longest = Math.max(x1 - x0, y1 - y0);
      const scale = Math.max(MIN_SCALE, Math.min(dpi / 72, MAX_PIXELS / longest));
      const pixmap = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceGray, false);
      try {
        return { png: pixmap.asPNG().slice(), scale };
      } finally {
        pixmap.destroy();
      }
    });
  }

  // Pages without a single letter of text: the ones worth reading with OCR.
  function withoutText(indexes) {
    return indexes.filter((index) => withPage(index, (page) => {
      const text = page.toStructuredText();
      try {
        return !text.asText().trim();
      } finally {
        text.destroy();
      }
    }));
  }

  const snapshot = (obj) => ({ contents: obj.get('Contents'), resources: obj.get('Resources') });

  function restore(obj, { contents, resources }) {
    for (const [key, value] of [['Contents', contents], ['Resources', resources]]) {
      if (value.isNull()) obj.delete(key);
      else obj.put(key, value);
    }
  }

  // The page gets its own copy of its resources, with the font under a name not used yet.
  function addFontResource(obj, ref) {
    const old = obj.getInheritable('Resources');
    const resources = doc.newDictionary();
    if (old.isDictionary()) old.forEach((value, key) => resources.put(key, value));
    const list = doc.newDictionary();
    const oldList = resources.get('Font');
    if (oldList.isDictionary()) oldList.forEach((value, key) => list.put(key, value));
    let n = 1;
    while (!list.get(`FolioOcr${n}`).isNull()) n++;
    list.put(`FolioOcr${n}`, ref);
    resources.put('Font', list);
    obj.put('Resources', resources);
    return `FolioOcr${n}`;
  }

  // The page's own drawing is wrapped in q/Q so nothing it leaves set moves the text.
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

  // Each word starts at x on its baseline y, in page space, and is stretched
  // to its width w. The text matrix maps that back to the file's own space.
  function shown(face, back, { text, x, y, w, size }) {
    const letters = encodable(text);
    if (!letters || !(w > 0) || !(size > 0)) return null;
    const natural = [...letters].reduce((sum, char) => sum + face.advanceGlyph(face.encodeCharacter(char.codePointAt(0)), 0), 0) * size;
    const stretch = natural > 0 ? (100 * w) / natural : 100;
    const matrix = mupdf.Matrix.concat([1, 0, 0, -1, x, y], back);
    const hex = winAnsiBytes(letters).map((b) => b.toString(16).padStart(2, '0')).join('');
    return { size, ops: `${num(stretch)} Tz ${matrix.map(num).join(' ')} Tm <${hex}> Tj` };
  }

  // words: [{ text, x, y, w, size }] in page space, y on the baseline.
  // Returns a key for undo, or null if no word could be written.
  function add(index, words) {
    return withPage(index, (page) => {
      const { font: face, ref } = helvetica();
      const back = mupdf.Matrix.invert(page.getTransform());
      const parts = words.map((word) => shown(face, back, word)).filter(Boolean);
      if (!parts.length) return null;
      const obj = page.getObject();
      const before = snapshot(obj);
      const resource = addFontResource(obj, ref);
      const ops = parts.map(({ size, ops: word }) => `/${resource} ${num(size)} Tf ${word}`);
      appendContent(obj, `q BT 3 Tr ${ops.join('\n')} ET Q\n`);
      const key = nextKey++;
      changes.set(key, { index, before, after: snapshot(obj) });
      return key;
    });
  }

  // which: 'before' takes the text off again, 'after' puts it back.
  function swap(key, which) {
    const change = changes.get(key);
    if (!change) throw new Error('That OCR text is no longer known.');
    withPage(change.index, (page) => restore(page.getObject(), change[which]));
  }

  return { picture, withoutText, add, swap };
}
