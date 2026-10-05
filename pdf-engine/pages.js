// Page structure: delete, reorder, insert and copy pages out. Every call works
// on the document in memory; saving writes it out. Indexes count from 0.
import * as mupdf from '../node_modules/mupdf/dist/mupdf.js';

export function createPages(doc) {
  const removed = new Map(); // token -> [{ at, page }] for undoing a deletion
  let nextToken = 1;

  function checkIndexes(indexes) {
    const count = doc.countPages();
    const ok = indexes.length && indexes.every((i) => Number.isInteger(i) && i >= 0 && i < count);
    if (!ok || new Set(indexes).size !== indexes.length) throw new Error('Those pages are not in this document.');
  }

  // Takes the pages out. A document keeps at least one page. Returns a token for restore().
  function remove(indexes) {
    checkIndexes(indexes);
    if (indexes.length >= doc.countPages()) throw new Error('A document needs at least one page.');
    const ascending = [...indexes].sort((a, b) => a - b);
    const taken = ascending.map((at) => ({ at, page: doc.findPage(at) }));
    for (const at of [...ascending].reverse()) doc.deletePage(at);
    const token = nextToken++;
    removed.set(token, taken);
    return token;
  }

  // Puts pages taken out by remove() back where they were.
  function restore(token) {
    const taken = removed.get(token);
    if (!taken) throw new Error('Those pages can no longer be restored.');
    for (const { at, page } of taken) doc.insertPage(at, page);
    removed.delete(token);
  }

  // order lists every page once, as old indexes in their new places.
  function arrange(order) {
    const count = doc.countPages();
    const ok = order.length === count && new Set(order).size === count && order.every((i) => Number.isInteger(i) && i >= 0 && i < count);
    if (!ok) throw new Error('That page order is not valid.');
    doc.rearrangePages(order);
  }

  function addBlank(at, [width, height]) {
    if (!(at >= 0 && at <= doc.countPages())) throw new Error('That position is not in this document.');
    const page = doc.addPage([0, 0, width, height], 0, {}, '');
    doc.insertPage(at, page);
  }

  // Copies pages (all of them when indexes is empty) of another PDF in at a position.
  // Returns how many were added.
  function insertFrom(at, bytes, indexes = []) {
    if (!(at >= 0 && at <= doc.countPages())) throw new Error('That position is not in this document.');
    let source;
    try {
      source = mupdf.Document.openDocument(bytes, 'application/pdf').asPDF();
    } catch {
      source = null;
    }
    if (!source) throw new Error('That file is damaged or is not a valid PDF.');
    try {
      if (source.needsPassword()) throw new Error('That file is password protected.');
      const picked = indexes.length ? indexes : Array.from({ length: source.countPages() }, (_, i) => i);
      picked.forEach((from, n) => doc.graftPage(at + n, source, from));
      return picked.length;
    } finally {
      source.destroy();
    }
  }

  // A new PDF with only these pages, as bytes.
  function extract(indexes) {
    checkIndexes(indexes);
    const copy = new mupdf.PDFDocument();
    try {
      indexes.forEach((from, n) => copy.graftPage(n, doc, from));
      const buffer = copy.saveToBuffer('garbage,compress');
      try {
        return buffer.asUint8Array().slice();
      } finally {
        buffer.destroy();
      }
    } finally {
      copy.destroy();
    }
  }

  return { remove, restore, arrange, addBlank, insertFrom, extract };
}
