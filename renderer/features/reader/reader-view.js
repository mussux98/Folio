import { createViewer } from './viewer.js';
import { createFind } from './find.js';
import { createThumbnails } from './thumbnails.js';
import { createOutline } from './outline.js';
import { createResults } from './results.js';
import { createAnnotationList } from '../annotations/annotation-list.js';
import { createSidebar } from './sidebar.js';
import { createToolbar } from './toolbar.js';
import { createToolStrip } from './tool-strip.js';
import { printDocument } from './print.js';
import { mountKeys } from './keys.js';

// Everything shown for one ready document: toolbar, sidebar, tool strip and the pages.
// start is where the tab was last time ({ top, zoom }), if it was open before.
// signing is { signLayer(args), openMenu() } from the signatures feature, and
// textEditing is { editLayer(args), toggle() } from the text editing feature, and
// annotating is { annotationLayer(args), markSelection(type), startNote(), startPen(), openShapes(anchor), openStamps(anchor), reveal(tabId, index, key) } from the annotations feature, and
// forms is { formLayer(args) } from the forms feature, and
// redacting is { toggle(), boxOption() } from the redaction feature, and
// imaging is { imageLayer(args), toggle() } from the page images feature, and
// pageTools is { move, remove, copy, cut, paste } from the page tools.
export function createReaderView({ tab, entry, engine, store, folio, start, signing, textEditing, annotating, forms, redacting, imaging, pageTools }) {
  const tabId = tab.id;
  const pageCount = entry.sizes.length / 2;

  const viewer = createViewer({
    tabId, entry, engine, store, folio, start,
    signLayer: signing.signLayer, editLayer: textEditing.editLayer, annotationLayer: annotating.annotationLayer, formLayer: forms.formLayer,
    imageLayer: imaging.imageLayer,
  });
  const find = createFind({ engine, docId: entry.docId, pageCount, viewer });

  const currentPage = () => store.getState().tabs.find((t) => t.id === tabId)?.page ?? 1;
  const print = () => printDocument({ engine, entry, folio, currentPage });
  const toolbar = createToolbar({
    tabId, pageCount, store, viewer, find, print, redacting,
  });
  const toolStrip = createToolStrip({
    annotating, redacting, toggleTextEditing: textEditing.toggle, toggleImages: imaging.toggle, openSignMenu: signing.openMenu,
  });
  const annotationList = createAnnotationList({
    engine, docId: entry.docId, pageCount,
    onPick(item) {
      viewer.goToPage(item.index + 1);
      annotating.reveal(tabId, item.index, item.key);
    },
  });
  const thumbnails = createThumbnails({ entry, engine, store, tabId, viewer, pageTools });
  const sidebar = createSidebar({
    store,
    panels: {
      thumbs: thumbnails,
      outline: createOutline(entry.outline, viewer),
      results: createResults(find),
      annotations: annotationList,
    },
  });

  const element = document.createElement('div');
  element.className = 'reader';
  const body = document.createElement('div');
  body.className = 'reader-body';
  body.append(sidebar.element, toolStrip.element, viewer.element);
  element.append(toolbar.element, body);

  const pageNow = () => store.getState().tabs.find((t) => t.id === tabId)?.page ?? 1;
  const toggleSidebar = () => store.setSidebar({ open: !store.getState().sidebar.open });
  const unmountKeys = mountKeys({
    page: pageNow, goToPage: viewer.goToPage, pageCount, store, tabId, toggleSidebar, focusFind: toolbar.focusFind,
  });

  const commands = {
    find: toolbar.focusFind,
    print,
    sign: signing.openMenu,
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
    thumbsHaveFocus: thumbnails.hasFocus,
    focusThumbs: thumbnails.focusCurrent,
    // entry.sizes is already up to date.
    pagesChanged(pages) {
      viewer.pagesChanged(pages);
      thumbnails.pagesChanged(pages);
      annotationList.pagesChanged(pages);
      find.refresh();
    },
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
