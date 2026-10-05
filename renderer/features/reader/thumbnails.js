import { isCancelled } from '../../../pdf-engine/client.js';
import { computeLayout, visibleRange } from './layout.js';

const THUMB_WIDTH = 132;
const LABEL_HEIGHT = 22;
const MARGIN = 1; // screens kept ready on each side
const KEEP = 3;

// The page thumbnails in the sidebar. Like the main scroll, only the ones near
// the view are drawn; the rest are empty boxes of the right size.
export function createThumbnails({ entry, engine, store, tabId, viewer }) {
  const { docId, sizes } = entry;
  const count = sizes.length / 2;

  // Each thumbnail is THUMB_WIDTH wide, with room for its number underneath.
  const boxes = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    boxes[i * 2] = THUMB_WIDTH;
    boxes[i * 2 + 1] = (sizes[i * 2 + 1] * THUMB_WIDTH) / sizes[i * 2] + LABEL_HEIGHT;
  }
  const layout = computeLayout(boxes, 1);

  const scroller = document.createElement('div');
  scroller.className = 'thumbs';
  const surface = document.createElement('div');
  surface.className = 'thumbs-surface';
  surface.style.height = `${layout.total}px`;
  scroller.append(surface);

  const items = Array.from({ length: count }, (_, i) => {
    const el = document.createElement('button');
    el.className = 'thumb';
    el.style.top = `${layout.tops[i]}px`;
    el.style.height = `${layout.heights[i]}px`;
    el.setAttribute('aria-label', `Page ${i + 1}`);
    const label = document.createElement('span');
    label.className = 'thumb-label';
    label.textContent = String(i + 1);
    el.append(label);
    el.addEventListener('click', () => viewer.goToPage(i + 1));
    return { el, canvas: null, request: null };
  });
  surface.append(...items.map((item) => item.el));

  async function draw(item, i) {
    const scale = (THUMB_WIDTH / sizes[i * 2]) * (window.devicePixelRatio || 1);
    const request = engine.renderPage(docId, i, scale, 100 + i);
    item.request = request;
    try {
      const { width, height, pixels } = await request.promise;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').putImageData(new ImageData(pixels, width, height), 0, 0);
      item.canvas = canvas;
      item.el.prepend(canvas);
    } catch (err) {
      // A page that failed stays blank instead of being retried on every scroll.
      if (!isCancelled(err)) item.canvas = false;
    } finally {
      item.request = null;
    }
  }

  function free(item) {
    item.request?.cancel();
    item.canvas?.remove?.();
    if (item.canvas !== false) item.canvas = null;
  }

  let frame = 0;
  function update() {
    frame = 0;
    const { scrollTop, clientHeight } = scroller;
    if (!clientHeight) return; // hidden: nothing to draw yet
    const near = visibleRange(layout, scrollTop - clientHeight * MARGIN, clientHeight * (1 + 2 * MARGIN));
    const keep = visibleRange(layout, scrollTop - clientHeight * KEEP, clientHeight * (1 + 2 * KEEP));
    items.forEach((item, i) => {
      if (i < keep.first || i > keep.last) free(item);
      else if (i >= near.first && i <= near.last) {
        if (item.canvas === null && !item.request) draw(item, i);
      } else item.request?.cancel();
    });
  }

  const scheduleUpdate = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  scroller.addEventListener('scroll', scheduleUpdate, { passive: true });
  const resizes = new ResizeObserver(scheduleUpdate);
  resizes.observe(scroller);

  // Mark the current page, and keep it in view.
  let shownPage = 0;
  function showCurrent({ scrollTo }) {
    const page = store.getState().tabs.find((tab) => tab.id === tabId)?.page;
    if (!page || (page === shownPage && !scrollTo)) return;
    items[shownPage - 1]?.el.classList.remove('current');
    shownPage = page;
    items[page - 1]?.el.classList.add('current');
    const top = layout.tops[page - 1];
    const height = layout.heights[page - 1];
    if (scrollTo || top < scroller.scrollTop || top + height > scroller.scrollTop + scroller.clientHeight) {
      scroller.scrollTop = top - Math.max(0, (scroller.clientHeight - height) / 2);
    }
  }

  const unsubscribe = store.subscribe(() => showCurrent({ scrollTo: false }));

  return {
    element: scroller,
    // Called when the panel becomes visible, once it has a size.
    refresh() {
      showCurrent({ scrollTo: true });
      scheduleUpdate();
    },
    destroy() {
      unsubscribe();
      resizes.disconnect();
      cancelAnimationFrame(frame);
      items.forEach(free);
    },
  };
}
