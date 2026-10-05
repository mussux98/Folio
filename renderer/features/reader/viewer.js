import { createPageView } from './page-view.js';
import {
  DESK_PAD, PAGE_GAP, clampZoom, computeLayout, currentPage, fitZoom, pageAtOffset, visibleRange,
} from './layout.js';

const RENDER_MARGIN = 1; // screens of pages made ready above and below the view
const KEEP_MARGIN = 3; // pages farther than this many screens are freed (rule 19)
const MAX_PIXELS = 16e6; // upper bound for one page picture
const ZOOM_SETTLE_MS = 150; // wait for the zoom to stop before drawing again
const WHEEL_ZOOM_SPEED = 0.0015;

// The scrolling column of pages for one open document. Zoom lives in the store
// (tab.zoom / tab.fit); this follows it and writes back the zoom a fit mode produced.
export function createViewer({ tabId, entry, engine, store, folio, start, signLayer }) {
  const { docId } = entry;
  let sizes = entry.sizes;
  const count = sizes.length / 2;

  const scroller = document.createElement('div');
  scroller.className = 'viewer';
  scroller.tabIndex = 0;
  const surface = document.createElement('div');
  surface.className = 'pages';
  scroller.append(surface);

  const actions = {
    goToPage: (n) => goToPage(n),
    openLink: (url) => folio.openLink(url),
    signLayer: (args) => signLayer({ tabId, ...args }),
  };
  const pageViews = Array.from({ length: count }, (_, i) => createPageView({
    index: i, width: sizes[i * 2], height: sizes[i * 2 + 1], engine, docId, actions,
  }));
  surface.append(...pageViews.map((view) => view.el));

  const tabNow = () => store.getState().tabs.find((tab) => tab.id === tabId);
  const pageNumber = () => Math.min(count, Math.max(1, tabNow()?.page ?? 1));

  let zoom = clampZoom(tabNow()?.zoom ?? 1);
  let layout = computeLayout(sizes, zoom);
  let appliedFit = null;
  let zoomAnchor = null; // where the pointer was, for Ctrl+wheel
  let highlighted = new Set();
  let timer = 0;
  let frame = 0;
  let settleUntil = 0;
  let reported = 0;

  const dpr = () => window.devicePixelRatio || 1;

  function scaleFor(i) {
    const area = sizes[i * 2] * sizes[i * 2 + 1];
    return Math.min(zoom * dpr(), Math.sqrt(MAX_PIXELS / area));
  }

  function placePages() {
    const contentWidth = Math.max(layout.maxWidth + DESK_PAD * 2, scroller.clientWidth);
    surface.style.width = `${contentWidth}px`;
    surface.style.height = `${layout.total}px`;
    surface.style.setProperty('--z', String(zoom));
    pageViews.forEach((view, i) => {
      view.place((contentWidth - layout.widths[i]) / 2, layout.tops[i], layout.widths[i], layout.heights[i]);
    });
  }

  function update() {
    frame = 0;
    timer = 0;
    const top = scroller.scrollTop;
    const height = scroller.clientHeight;
    const shown = currentPage(layout, top, height);
    if (shown + 1 !== reported) {
      reported = shown + 1;
      store.setView(tabId, { page: reported });
    }
    const seen = visibleRange(layout, top, height);
    const near = visibleRange(layout, top - height * RENDER_MARGIN, height * (1 + 2 * RENDER_MARGIN));
    const keep = visibleRange(layout, top - height * KEEP_MARGIN, height * (1 + 2 * KEEP_MARGIN));
    pageViews.forEach((view, i) => {
      if (i < keep.first || i > keep.last) view.release();
      else if (i < near.first || i > near.last) view.cancelPending();
      else view.show(scaleFor(i), i >= seen.first && i <= seen.last ? 0 : 10 + Math.abs(i - shown));
    });
  }

  function scheduleUpdate() {
    if (frame || timer) return;
    const wait = settleUntil - performance.now();
    if (wait > 0) timer = setTimeout(update, wait);
    else frame = requestAnimationFrame(update);
  }

  // Changes the zoom and keeps the spot under the anchor (view coordinates) in place.
  function applyZoom(next, anchor) {
    next = clampZoom(next);
    if (next === zoom) return;
    const at = anchor ?? { x: scroller.clientWidth / 2, y: scroller.clientHeight / 2 };
    const y = scroller.scrollTop + at.y;
    const page = pageAtOffset(layout, y);
    const inPage = (y - layout.tops[page]) / layout.heights[page];
    const across = (scroller.scrollLeft + at.x) / (scroller.scrollWidth || 1);

    zoom = next;
    layout = computeLayout(sizes, zoom);
    placePages();
    scroller.scrollTop = layout.tops[page] + inPage * layout.heights[page] - at.y;
    scroller.scrollLeft = across * scroller.scrollWidth - at.x;

    pageViews.forEach((view) => view.cancelPending());
    settleUntil = performance.now() + ZOOM_SETTLE_MS;
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    timer = 0;
    frame = 0;
    scheduleUpdate();
  }

  // The zoom a fit mode asks for, measured on the page the user is looking at.
  function fitFor(mode) {
    const i = pageNumber() - 1;
    return fitZoom(mode, sizes[i * 2], sizes[i * 2 + 1], scroller.clientWidth, scroller.clientHeight);
  }

  function followStore() {
    const tab = tabNow();
    if (!tab) return;
    if (tab.fit) {
      if (tab.fit !== appliedFit) applyZoom(fitFor(tab.fit));
    } else if (tab.zoom !== zoom) {
      applyZoom(tab.zoom, zoomAnchor);
    }
    appliedFit = tab.fit;
    zoomAnchor = null;
    if (tab.fit && tab.zoom !== zoom) store.setView(tabId, { zoom });
  }

  function goToPage(n) {
    const i = Math.min(count, Math.max(1, n)) - 1;
    scroller.scrollTop = layout.tops[i] - PAGE_GAP;
  }

  // Scrolls just enough to bring a box on a page (in points) into view.
  function reveal(pageIndex, rect) {
    const top = layout.tops[pageIndex] + rect.y * zoom;
    const bottom = top + rect.h * zoom;
    const height = scroller.clientHeight;
    if (top < scroller.scrollTop || bottom > scroller.scrollTop + height) {
      scroller.scrollTop = top - height / 3;
    }
    const left = (parseFloat(pageViews[pageIndex].el.style.left) || 0) + rect.x * zoom;
    const right = left + rect.w * zoom;
    if (left < scroller.scrollLeft || right > scroller.scrollLeft + scroller.clientWidth) {
      scroller.scrollLeft = left - scroller.clientWidth / 3;
    }
  }

  // An edit changed these pages; entry.sizes has their new sizes. The view
  // keeps its place while they are drawn again.
  function pagesChanged(pages) {
    const y = scroller.scrollTop;
    const page = pageAtOffset(layout, y);
    const inPage = (y - layout.tops[page]) / layout.heights[page];
    sizes = entry.sizes;
    for (const i of pages) pageViews[i].redraw(sizes[i * 2], sizes[i * 2 + 1]);
    layout = computeLayout(sizes, zoom);
    placePages();
    scroller.scrollTop = layout.tops[page] + inPage * layout.heights[page];
    const tab = tabNow();
    if (tab?.fit) applyZoom(fitFor(tab.fit));
    scheduleUpdate();
  }

  // byPage: Map of page index -> [{ rects, current }]
  function setHighlights(byPage) {
    for (const i of highlighted) if (!byPage.has(i)) pageViews[i].setHighlights(null);
    for (const [i, marks] of byPage) pageViews[i].setHighlights(marks);
    highlighted = new Set(byPage.keys());
  }

  // Ctrl+wheel zooms toward the pointer. Wheel events are combined into one step per frame.
  let wheelFactor = 1;
  let wheelFrame = 0;
  let wheelAt = null;
  scroller.addEventListener('wheel', (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const box = scroller.getBoundingClientRect();
    wheelAt = { x: event.clientX - box.left, y: event.clientY - box.top };
    wheelFactor *= Math.exp(-event.deltaY * WHEEL_ZOOM_SPEED);
    if (wheelFrame) return;
    wheelFrame = requestAnimationFrame(() => {
      wheelFrame = 0;
      zoomAnchor = wheelAt;
      store.setView(tabId, { zoom: clampZoom(zoom * wheelFactor), fit: null });
      wheelFactor = 1;
    });
  }, { passive: false });

  // Copy plain text only. The default also copies the page's HTML, which Word and
  // similar programs turn into one paragraph per line.
  scroller.addEventListener('copy', (event) => {
    const text = getSelection().toString();
    if (!text) return;
    event.clipboardData.setData('text/plain', text);
    event.preventDefault();
  });

  scroller.addEventListener('scroll', scheduleUpdate, { passive: true });

  const resizes = new ResizeObserver(() => {
    placePages();
    const tab = tabNow();
    if (tab?.fit) applyZoom(fitFor(tab.fit));
    scheduleUpdate();
  });
  resizes.observe(scroller);

  const unsubscribe = store.subscribe(followStore);

  // Start where the tab was: the exact spot if the zoom is unchanged, else the page.
  function begin() {
    const tab = tabNow();
    if (tab?.fit) {
      appliedFit = tab.fit;
      zoom = fitFor(tab.fit);
      layout = computeLayout(sizes, zoom);
      if (tab.zoom !== zoom) store.setView(tabId, { zoom });
    }
    placePages();
    if (start && Math.abs(start.zoom - zoom) < 1e-6) scroller.scrollTop = start.top;
    else goToPage(pageNumber());
    reported = pageNumber();
    scheduleUpdate();
  }

  return {
    element: scroller,
    begin,
    goToPage,
    reveal,
    setHighlights,
    pagesChanged,
    focus: () => scroller.focus({ preventScroll: true }),

    // Returns where the user was, for coming back to this tab later.
    destroy() {
      unsubscribe();
      resizes.disconnect();
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(wheelFrame);
      pageViews.forEach((view) => view.release());
      return { top: scroller.scrollTop, zoom };
    },
  };
}
