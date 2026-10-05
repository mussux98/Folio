import { createEngineClient } from '../../../pdf-engine/client.js';
import { activeTab } from '../../state/store.js';
import { buildEmptyView } from '../empty-view.js';
import { createReaderView } from './reader-view.js';
import { buildLoadingView, buildErrorView, buildPasswordView } from './status-views.js';

// Owns the open documents, one per tab, and decides what the window shows:
// the empty screen, a loading or error card, a password prompt, or the reader.
// Entries: { status: 'loading' | 'locked' | 'error' | 'ready', ... }
export function createReader({ container, store, folio }) {
  let engine = null;
  let signing = null; // set once the signatures feature exists; it needs the reader itself
  let textEditing = null; // the same for text editing
  let pageTools = null; // and for the page tools
  let annotations = null; // and for text markup and notes
  const entries = new Map(); // tab id -> entry
  const lastSpot = new Map(); // tab id -> { top, zoom } of a tab that is not showing

  let mounted = null; // { tabId, key, view? }

  const getEngine = () => (engine ??= createEngineClient());

  // A tab that closed while its file was still loading must not leave a document behind.
  const isCurrent = (tab, entry) => entries.get(tab.id) === entry;

  async function loadSizes(tab, entry, docId) {
    const eng = getEngine();
    const [sizes, outline] = await Promise.all([eng.pageSizes(docId), eng.getOutline(docId).catch(() => [])]);
    if (!isCurrent(tab, entry)) return;
    Object.assign(entry, { status: 'ready', docId, sizes, outline });
  }

  async function load(tab) {
    const entry = { status: 'loading' };
    entries.set(tab.id, entry);
    try {
      const read = await folio.readFile(tab.path);
      if (!isCurrent(tab, entry)) return;
      if (read.error) throw new Error(read.error);
      const opened = await getEngine().openDocument(read.bytes);
      if (!isCurrent(tab, entry)) {
        getEngine().closeDocument(opened.id);
        return;
      }
      if (opened.locked) Object.assign(entry, { status: 'locked', docId: opened.id });
      else await loadSizes(tab, entry, opened.id);
    } catch (err) {
      if (isCurrent(tab, entry)) Object.assign(entry, { status: 'error', message: err.message });
    }
    if (isCurrent(tab, entry)) render(store.getState());
  }

  async function unlock(tab, entry, password) {
    const result = await getEngine().authenticate(entry.docId, password);
    if (result.locked) return false;
    try {
      await loadSizes(tab, entry, entry.docId);
    } catch (err) {
      Object.assign(entry, { status: 'error', message: err.message });
    }
    if (isCurrent(tab, entry)) render(store.getState());
    return true;
  }

  function forget(tabId) {
    const entry = entries.get(tabId);
    entries.delete(tabId);
    lastSpot.delete(tabId);
    if (entry?.docId !== undefined) engine?.closeDocument(entry.docId);
  }

  function unmount() {
    if (!mounted) return;
    const spot = mounted.view?.destroy();
    if (spot && entries.has(mounted.tabId)) lastSpot.set(mounted.tabId, spot);
    mounted = null;
  }

  function statusView(tab, entry) {
    if (entry.status === 'locked') return buildPasswordView(tab.name, (password) => unlock(tab, entry, password));
    if (entry.status === 'error') {
      return buildErrorView(tab.name, entry.message, [
        { label: 'Try again', primary: true, onClick: () => { forget(tab.id); render(store.getState()); } },
        { label: 'Close tab', onClick: () => store.closeTab(tab.id) },
      ]);
    }
    return buildLoadingView(tab.name);
  }

  function render(state) {
    for (const id of [...entries.keys()]) {
      if (!state.tabs.some((tab) => tab.id === id)) forget(id);
    }
    for (const tab of state.tabs) {
      if (!entries.has(tab.id)) load(tab);
    }

    const tab = activeTab(state);
    const entry = tab && entries.get(tab.id);
    const key = tab ? `${tab.id}/${entry?.status}` : 'empty';
    if (mounted?.key === key) return;

    unmount();
    mounted = { tabId: tab?.id, key };
    if (!tab) {
      container.replaceChildren(buildEmptyView(folio));
    } else if (entry.status === 'ready') {
      const view = createReaderView({
        tab, entry, engine: getEngine(), store, folio, start: lastSpot.get(tab.id),
        signing: { signLayer: (args) => signing.layerFor(args), openMenu: () => signing.openMenu() },
        textEditing: { editLayer: (args) => textEditing.layerFor(args), toggle: () => textEditing.toggle() },
        annotating: {
          annotationLayer: (args) => annotations.layerFor(args),
          markSelection: (type) => annotations.markSelection(type),
          startNote: () => annotations.startNote(),
          startPen: () => annotations.startPen(),
          openShapes: (anchor) => annotations.openShapes(anchor),
          openStamps: (anchor) => annotations.openStamps(anchor),
        },
        pageTools: Object.fromEntries(['move', 'remove', 'copy', 'cut', 'paste'].map((name) => [name, (...args) => pageTools[name](...args)])),
      });
      mounted.view = view;
      container.replaceChildren(view.element);
      view.begin();
    } else {
      container.replaceChildren(statusView(tab, entry));
    }
  }

  store.subscribe(render);
  render(store.getState());

  // An edit changed these pages: their size may be new, and they are drawn again.
  async function pagesChanged(tabId, pages) {
    const entry = entries.get(tabId);
    if (entry?.status !== 'ready') return;
    const sizes = await getEngine().pageSizes(entry.docId);
    if (entries.get(tabId) !== entry) return;
    entry.sizes = sizes;
    if (mounted?.tabId === tabId) mounted.view?.pagesChanged(pages);
  }

  // Pages were added, removed or moved: every page's place changed, so the view
  // is built again and lands on this page (from 1).
  async function pagesRestructured(tabId, page) {
    const entry = entries.get(tabId);
    if (entry?.status !== 'ready') return;
    const [sizes, outline] = await Promise.all([
      getEngine().pageSizes(entry.docId),
      getEngine().getOutline(entry.docId).catch(() => []),
    ]);
    if (entries.get(tabId) !== entry) return;
    Object.assign(entry, { sizes, outline });
    store.setView(tabId, { page: Math.min(page, sizes.length / 2) });
    if (mounted?.tabId === tabId) {
      unmount();
      lastSpot.delete(tabId);
    }
    render(store.getState());
  }

  return {
    setSigning(feature) {
      signing = feature;
    },
    setTextEditing(feature) {
      textEditing = feature;
    },
    setAnnotations(feature) {
      annotations = feature;
    },
    setPageTools(feature) {
      pageTools = feature;
    },
    command: (name) => mounted?.view?.command(name),
    // { engine, docId, pageCount, pageSize(i) } for a tab whose document is open, else null.
    documentOf(tabId) {
      const entry = entries.get(tabId);
      if (entry?.status !== 'ready') return null;
      return {
        engine: getEngine(),
        docId: entry.docId,
        pageCount: entry.sizes.length / 2,
        pageSize: (i) => [entry.sizes[i * 2], entry.sizes[i * 2 + 1]],
      };
    },
    pagesChanged,
    pagesRestructured,
  };
}
