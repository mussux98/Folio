import { activeTab, targetPages } from '../../state/store.js';
import { rotatePages } from '../../commands/rotate-page.js';
import { deletePages, movePages, insertBlankPage, insertPagesFromFiles } from '../../commands/page-structure.js';
import { createNotice } from '../notice.js';
import { askPartSize } from './split-dialog.js';

const range = (from, length) => Array.from({ length }, (_, i) => from + i);
const withoutExtension = (path) => path.replace(/\.pdf$/i, '');

// The page tools: rotate, delete, move, insert, merge, extract and split. They
// work on the pages picked in the thumbnails, or the page in view. The edits
// are commands and can be undone; extract and split write new files and leave
// the document alone.
export function createPageTools({ store, reader, editing, folio }) {
  const notice = createNotice();

  // The active tab with its open document, or null when there is nothing to work on.
  function target() {
    const tab = activeTab(store.getState());
    const doc = tab && reader.documentOf(tab.id);
    return doc ? { tab, doc, pages: targetPages(tab) } : null;
  }

  const run = (tab, command) => editing.run(tab.id, command).catch((err) => notice.show(err.message));

  function rotate(degrees) {
    const here = target();
    if (here) run(here.tab, rotatePages(here.doc, here.pages, degrees));
  }

  function remove() {
    const here = target();
    if (!here) return;
    if (here.pages.length >= here.doc.pageCount) return notice.show('A document needs at least one page.');
    run(here.tab, deletePages(here.doc, here.pages, here.doc.pageCount));
  }

  // gap is the place between pages (0 is before the first) the pages are dropped on.
  function move(indexes, gap) {
    const here = target();
    const command = here && movePages(here.doc, indexes, gap, here.doc.pageCount);
    if (command) run(here.tab, command);
  }

  function insertBlank() {
    const here = target();
    if (!here) return;
    const at = here.pages.at(-1) + 1;
    run(here.tab, insertBlankPage(here.doc, at, here.doc.pageSize(at - 1)));
  }

  // where: 'after' puts the pages after the picked ones, 'end' at the end of the document.
  async function insertFiles(where) {
    const here = target();
    if (!here) return;
    const paths = await folio.pickPdfs();
    if (!paths.length) return;
    const files = [];
    for (const path of paths) {
      const read = await folio.readFile(path);
      if (read.error) return notice.show(`${path.split(/[\/]/).pop()}: ${read.error}`);
      files.push(read.bytes);
    }
    const at = where === 'end' ? here.doc.pageCount : here.pages.at(-1) + 1;
    run(here.tab, insertPagesFromFiles(here.doc, at, files));
  }

  async function writeAll(items) {
    for (const { path, bytes } of items) {
      if (!(await folio.writeFile(path, bytes))) return false;
    }
    return true;
  }

  async function extract() {
    const here = target();
    if (!here) return;
    const path = await folio.chooseSavePath(`${withoutExtension(here.tab.path)} (extract).pdf`);
    if (!path) return;
    try {
      const bytes = await here.doc.engine.extractPages(here.doc.docId, here.pages);
      if (await writeAll([{ path, bytes }])) notice.show(`Saved ${here.pages.length === 1 ? '1 page' : `${here.pages.length} pages`} to ${path.split(/[\/]/).pop()}.`);
    } catch (err) {
      notice.show(err.message);
    }
  }

  async function split() {
    const here = target();
    if (!here) return;
    const { pageCount } = here.doc;
    if (pageCount < 2) return notice.show('A one-page document cannot be split.');
    const size = await askPartSize(pageCount);
    if (!size) return;
    const parts = Math.ceil(pageCount / size);
    const paths = await folio.choosePartPaths(here.tab.path, parts);
    if (!paths) return;
    try {
      const items = [];
      for (let i = 0; i < parts; i++) {
        const indexes = range(i * size, Math.min(size, pageCount - i * size));
        items.push({ path: paths[i], bytes: await here.doc.engine.extractPages(here.doc.docId, indexes) });
      }
      if (await writeAll(items)) notice.show(`Saved ${parts} files.`);
    } catch (err) {
      notice.show(err.message);
    }
  }

  return { rotate, remove, move, insertBlank, insertFiles, extract, split };
}
