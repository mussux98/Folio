// The only file that talks to MuPDF.js (rule 9). It runs inside the worker,
// and the tests load it directly in Node. Positions are in PDF points,
// measured from the top-left corner of the page as it is displayed.
import * as mupdf from '../node_modules/mupdf/dist/mupdf.js';
import { findInLine } from './fuzzy-search.js';
import { inReadingOrder } from './reading-order.js';
import { createSignatures } from './signatures.js';
import { createTextEdits } from './text-edits.js';

const MAX_SNIPPET = 120;

export function createEngine() {
  let nextId = 1;
  const documents = new Map();
  const textEdits = new Map(); // document id -> its text changes, kept for undo

  function get(id) {
    const doc = documents.get(id);
    if (!doc) throw new Error('This document is no longer open.');
    return doc;
  }

  // Pages are loaded for one call and released at once so memory stays flat.
  function withPage(id, index, task) {
    const page = get(id).loadPage(index);
    try {
      return task(page);
    } finally {
      page.destroy();
    }
  }

  // needsPassword() stays true after a good password, so the caller says whether the file is unlocked.
  function describe(id, doc, locked) {
    return locked ? { id, locked } : { id, locked, pageCount: doc.countPages() };
  }

  function openDocument(bytes) {
    let doc;
    try {
      doc = mupdf.Document.openDocument(bytes, 'application/pdf');
    } catch {
      throw new Error('This file is damaged or is not a valid PDF.');
    }
    const id = nextId++;
    documents.set(id, doc);
    return describe(id, doc, doc.needsPassword());
  }

  function authenticate(id, password) {
    const doc = get(id);
    return describe(id, doc, !doc.authenticatePassword(password));
  }

  function closeDocument(id) {
    documents.get(id)?.destroy();
    documents.delete(id);
    textEdits.delete(id);
  }

  // [width, height] for every page, as one flat array.
  function pageSizes(id) {
    const doc = get(id);
    const count = doc.countPages();
    const sizes = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const [x0, y0, x1, y1] = withPage(id, i, (page) => page.getBounds());
      sizes[i * 2] = x1 - x0;
      sizes[i * 2 + 1] = y1 - y0;
    }
    return sizes;
  }

  // RGBA pixels, transparent where the page draws nothing.
  function renderPage(id, index, scale) {
    return withPage(id, index, (page) => {
      const pixmap = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, true);
      try {
        const pixels = new Uint8ClampedArray(pixmap.getPixels());
        return { width: pixmap.getWidth(), height: pixmap.getHeight(), pixels };
      } finally {
        pixmap.destroy();
      }
    });
  }

  function textLines(page) {
    const text = page.toStructuredText('preserve-whitespace');
    try {
      const lines = [];
      // block groups the lines of one paragraph, so copying can join them.
      JSON.parse(text.asJSON()).blocks.forEach((block, blockIndex) => {
        if (block.type !== 'text') return;
        for (const line of block.lines) {
          const { x, y, w, h } = line.bbox;
          if (line.text.trim()) lines.push({ x, y, w, h, size: line.font.size, text: line.text, block: blockIndex });
        }
      });
      return inReadingOrder(lines);
    } finally {
      text.destroy();
    }
  }

  function getText(id, index) {
    return withPage(id, index, textLines);
  }

  // The characters of every text line on a page, with where each one is drawn.
  function charLines(page) {
    const text = page.toStructuredText('preserve-whitespace');
    const lines = [];
    let current = null;
    try {
      text.walk({
        beginLine() { current = []; },
        onChar(c, _origin, _font, _size, quad) { current.push({ c, quad }); },
        endLine() {
          if (current.length) lines.push(current);
          current = null;
        },
      });
    } finally {
      text.destroy();
    }
    return lines;
  }

  // Every match on one page: the box to highlight and the line it is in.
  // Case, accents and stray accent marks are ignored (see fuzzy-search.js).
  function searchPage(id, index, needle) {
    return withPage(id, index, (page) => {
      const hits = [];
      for (const chars of charLines(page)) {
        const boxes = findInLine(chars, needle);
        if (!boxes.length) continue;
        const snippet = chars.map((char) => char.c).join('').trim().slice(0, MAX_SNIPPET);
        for (const box of boxes) hits.push({ rects: [box], snippet });
      }
      return hits;
    });
  }

  // Links on a page: where they are and where they go.
  function getLinks(id, index) {
    const doc = get(id);
    return withPage(id, index, (page) => page.getLinks().map((link) => {
      const [x0, y0, x1, y1] = link.getBounds();
      const box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      const uri = link.getURI();
      if (link.isExternal()) return { ...box, uri };
      try {
        return { ...box, page: doc.resolveLink(uri) };
      } catch {
        return null;
      }
    }).filter(Boolean));
  }

  function getOutline(id) {
    const doc = get(id);
    const convert = (items) => items.map((item) => {
      let page = item.page;
      if (page === undefined && item.uri) {
        try {
          page = doc.resolveLink(item.uri);
        } catch {
          page = undefined;
        }
      }
      return { title: item.title ?? '', page: page >= 0 ? page : null, children: convert(item.down ?? []) };
    });
    return convert(doc.loadOutline() ?? []);
  }

  // The matrix [a, b, c, d, e, f] from PDF user space (y up, before /Rotate and
  // the crop box) to the page as displayed. See coords.js (rule 21).
  function pageTransform(id, index) {
    return withPage(id, index, (page) => [...page.getTransform()]);
  }

  // Edits change the document in memory only; save() writes them out.

  // Turns a page by a multiple of 90 degrees (positive is clockwise).
  // Returns the page's new [width, height].
  function rotatePage(id, index, degrees) {
    return withPage(id, index, (page) => {
      const obj = page.getObject();
      const current = obj.getInheritable('Rotate').asNumber() || 0;
      obj.put('Rotate', (((current + degrees) % 360) + 360) % 360);
      const [x0, y0, x1, y1] = page.getBounds();
      return [x1 - x0, y1 - y0];
    });
  }

  // Signatures: each call works on one page and returns plain data.
  const signatures = (id) => createSignatures(get(id), (index, task) => withPage(id, index, task));
  const addSignature = (id, index, png, rect) => signatures(id).add(index, png, rect);
  const moveSignature = (id, index, key, rect) => signatures(id).move(index, key, rect);
  const removeSignature = (id, index, key) => signatures(id).remove(index, key);
  const listSignatures = (id, index) => signatures(id).list(index);
  const signaturePicture = (id, index, key) => signatures(id).picture(index, key);

  // Text: each change has a key, so undo and redo can swap it out and back in.
  function texts(id) {
    if (!textEdits.has(id)) textEdits.set(id, createTextEdits(get(id), (index, task) => withPage(id, index, task)));
    return textEdits.get(id);
  }
  const textLineAt = (id, index, point) => texts(id).lineAt(index, point);
  const replaceText = (id, index, edit) => texts(id).replace(index, edit);
  const swapText = (id, key, which) => texts(id).swap(key, which);
  const documentFonts = (id) => texts(id).listFonts();

  // The whole file with every edit. A full rewrite: saving incrementally a
  // second time from the same document produces a broken file. garbage leaves
  // out what no page uses any more, such as the text an edit removed.
  function save(id) {
    // New pictures (signatures) and edited pages are stored raw until compressed here.
    const bytes = toBytes(get(id).saveToBuffer('garbage,compress,compress-images=yes'));
    return textEdits.get(id)?.hasWholeFonts() ? subsetted(bytes) : bytes;
  }

  function toBytes(buffer) {
    try {
      return buffer.asUint8Array().slice();
    } finally {
      buffer.destroy();
    }
  }

  // Installed fonts go into the file whole. Here a copy of the saved file keeps
  // only the letters it uses, so the document being edited still has them all.
  // If that fails, the whole fonts are saved.
  function subsetted(bytes) {
    let copy = null;
    try {
      copy = mupdf.Document.openDocument(bytes, 'application/pdf').asPDF();
      copy.subsetFonts();
      return toBytes(copy.saveToBuffer('garbage,compress'));
    } catch {
      return bytes;
    } finally {
      copy?.destroy();
    }
  }

  return {
    openDocument, authenticate, closeDocument, pageSizes, renderPage, getText, searchPage, getLinks, getOutline,
    pageTransform, rotatePage, addSignature, moveSignature, removeSignature, listSignatures, signaturePicture,
    textLineAt, documentFonts, replaceText, swapText, save,
  };
}
