import { createViewer } from './viewer.js';
import { createFind } from './find.js';
import { createThumbnails } from './thumbnails.js';
import { createOutline } from './outline.js';
import { createResults } from './results.js';
import { createSidebar } from './sidebar.js';
import { createToolbar } from './toolbar.js';
import { printDocument } from './print.js';
import { mountKeys } from './keys.js';

// Everything shown for one ready document: toolbar, sidebar and the pages.
// start is where the tab was last time ({ top, zoom }), if it was open before.
export function createReaderView({ tab, entry, engine, store, folio, start }) {
  const tabId = tab.id;
  const pageCount = entry.sizes.length / 2;

  const viewer = createViewer({ tabId, entry, engine, store, folio, start });
  const find = createFind({ engine, docId: entry.docId, pageCount, viewer });

  const print = () => printDocument({ engine, entry, folio });
  const toolbar = createToolbar({ tabId, pageCount, store, viewer, find, print });
  const thumbnails = createThumbnails({ entry, engine, store, tabId, viewer });
  const sidebar = createSidebar({
    store,
    panels: {
      thumbs: thumbnails,
      outline: createOutline(entry.outline, viewer),
      results: createResults(find),
    },
  });

  const element = document.createElement('div');
  element.className = 'reader';
  const body = document.createElement('div');
  body.className = 'reader-body';
  body.append(sidebar.element, viewer.element);
  element.append(toolbar.element, body);

  const pageNow = () => store.getState().tabs.find((t) => t.id === tabId)?.page ?? 1;
  const toggleSidebar = () => store.setSidebar({ open: !store.getState().sidebar.open });
  const unmountKeys = mountKeys({
    page: pageNow, goToPage: viewer.goToPage, pageCount, store, tabId, toggleSidebar, focusFind: toolbar.focusFind,
  });

  const commands = {
    find: toolbar.focusFind,
    print,
    'find-next': find.next,
    'find-previous': find.previous,
  };

  return {
    element,
    // Called once the element is in the page, so sizes can be measured.
    begin() {
      viewer.begin();
      viewer.focus();
    },
    command: (name) => commands[name]?.(),
    destroy() {
      unmountKeys();
      find.destroy();
      toolbar.destroy();
      sidebar.destroy();
      thumbnails.destroy();
      return viewer.destroy();
    },
  };
}
