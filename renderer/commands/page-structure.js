import { moveOrder } from './page-order.js';

// Edits that add, remove or move pages. Besides execute() and undo() they say
// what to show afterwards: view.execute and view.undo are { page, select }, a
// page number (from 1) and the page indexes to leave selected. All of them work
// on pages by position, so they are only ever undone in reverse order.
const range = (from, length) => Array.from({ length }, (_, i) => from + i);

// Takes these pages out; undo puts them back where they were. count is the pages before.
export function deletePages({ engine, docId }, indexes, count) {
  const picked = [...indexes].sort((a, b) => a - b);
  let token = null;
  return {
    view: {
      execute: { page: Math.min(picked[0], count - picked.length - 1) + 1, select: [] },
      undo: { page: picked[0] + 1, select: picked },
    },
    async execute() {
      token = await engine.deletePages(docId, picked);
    },
    undo: () => engine.restorePages(docId, token),
  };
}

// Moves pages to a gap between pages (see moveOrder). Returns null when nothing would move.
export function movePages({ engine, docId }, indexes, gap, count) {
  const { order, restore, first, picked, unchanged } = moveOrder(count, indexes, gap);
  if (unchanged) return null;
  return {
    view: {
      execute: { page: first + 1, select: range(first, picked.length) },
      undo: { page: picked[0] + 1, select: picked },
    },
    execute: () => engine.arrangePages(docId, order),
    undo: () => engine.arrangePages(docId, restore),
  };
}

// A blank page of this [width, height] at a position (0 is before the first page).
export function insertBlankPage({ engine, docId }, at, size) {
  return {
    view: { execute: { page: at + 1, select: [at] }, undo: { page: Math.max(1, at), select: [] } },
    execute: () => engine.addBlankPage(docId, at, size),
    undo: () => engine.deletePages(docId, [at]),
  };
}

// All the pages of other files (each one's bytes), one after the other, at a position.
export function insertPagesFromFiles({ engine, docId }, at, files) {
  let total = 0;
  return {
    view: { execute: { page: at + 1, select: [] }, undo: { page: Math.max(1, at), select: [] } },
    async execute() {
      total = 0;
      try {
        for (const bytes of files) total += await engine.insertPagesFrom(docId, at + total, bytes, []);
      } catch (err) {
        // One bad file leaves nothing behind from the others.
        if (total) await engine.deletePages(docId, range(at, total));
        throw err;
      }
      this.view.execute.select = range(at, total);
    },
    undo: () => engine.deletePages(docId, range(at, total)),
  };
}
