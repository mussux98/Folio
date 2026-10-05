// The only file that talks to MuPDF.js (rule 9). It runs inside the worker,
// and the tests load it directly in Node. Positions are in PDF points,
// measured from the top-left corner of the page as it is displayed.
import * as mupdf from '../node_modules/mupdf/dist/mupdf.js';

const MAX_SNIPPET = 120;

export function createEngine() {
  let nextId = 1;
  const documents = new Map();

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
      for (const block of JSON.parse(text.asJSON()).blocks) {
        if (block.type !== 'text') continue;
        for (const line of block.lines) {
          const { x, y, w, h } = line.bbox;
          if (line.text.trim()) lines.push({ x, y, w, h, size: line.font.size, text: line.text });
        }
      }
      return lines;
    } finally {
      text.destroy();
    }
  }

  function getText(id, index) {
    return withPage(id, index, textLines);
  }

  const boxOf = (quad) => {
    const xs = [quad[0], quad[2], quad[4], quad[6]];
    const ys = [quad[1], quad[3], quad[5], quad[7]];
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  };

  const snippetFor = (box, lines) => {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const line = lines.find((l) => cx >= l.x && cx <= l.x + l.w && cy >= l.y && cy <= l.y + l.h);
    return (line?.text ?? '').trim().slice(0, MAX_SNIPPET);
  };

  // Every match on one page: the boxes to highlight and a line of context.
  function searchPage(id, index, needle) {
    return withPage(id, index, (page) => {
      const hits = page.search(needle, {});
      if (!hits.length) return [];
      const lines = textLines(page);
      return hits.map((quads) => {
        const rects = quads.map(boxOf);
        return { rects, snippet: snippetFor(rects[0], lines) };
      });
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

  return { openDocument, authenticate, closeDocument, pageSizes, renderPage, getText, searchPage, getLinks, getOutline };
}
