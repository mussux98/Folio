// Page geometry for the continuous scroll. Pure functions, no DOM.
// sizes is a flat [w, h, w, h, ...] list in PDF points; zoom turns points into CSS pixels.

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;
export const PAGE_GAP = 12;
export const DESK_PAD = 16;

export const clampZoom = (zoom) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

export function computeLayout(sizes, zoom) {
  const count = sizes.length / 2;
  const tops = new Float64Array(count);
  const widths = new Float64Array(count);
  const heights = new Float64Array(count);
  let y = DESK_PAD;
  let maxWidth = 0;
  for (let i = 0; i < count; i++) {
    widths[i] = sizes[i * 2] * zoom;
    heights[i] = sizes[i * 2 + 1] * zoom;
    tops[i] = y;
    y += heights[i] + PAGE_GAP;
    maxWidth = Math.max(maxWidth, widths[i]);
  }
  const total = count ? y - PAGE_GAP + DESK_PAD : 0;
  return { count, tops, widths, heights, total, maxWidth };
}

// The last page that starts at or above y (the first page if y is above them all).
export function pageAtOffset({ count, tops }, y) {
  let low = 0;
  let high = count - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (tops[mid] <= y) low = mid;
    else high = mid - 1;
  }
  return low;
}

// The pages that touch the band from top to top + height.
export function visibleRange(layout, top, height) {
  if (!layout.count) return { first: 0, last: -1 };
  const first = pageAtOffset(layout, top);
  let last = first;
  while (last + 1 < layout.count && layout.tops[last + 1] < top + height) last++;
  return { first, last };
}

// The page with the most of it on screen; the earlier page wins a tie.
export function currentPage(layout, scrollTop, viewHeight) {
  const { first, last } = visibleRange(layout, scrollTop, viewHeight);
  let best = first;
  let bestShown = -1;
  for (let i = first; i <= last; i++) {
    const shown = Math.min(layout.tops[i] + layout.heights[i], scrollTop + viewHeight) - Math.max(layout.tops[i], scrollTop);
    if (shown > bestShown) {
      best = i;
      bestShown = shown;
    }
  }
  return best;
}

// Zoom that makes a page of pageW x pageH points fit the visible area.
export function fitZoom(mode, pageW, pageH, viewW, viewH) {
  const byWidth = (viewW - DESK_PAD * 2) / pageW;
  const zoom = mode === 'page' ? Math.min(byWidth, (viewH - DESK_PAD * 2) / pageH) : byWidth;
  return clampZoom(zoom);
}
