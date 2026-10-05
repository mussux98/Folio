// Rect maths for placing signatures. Rects are { x, y, w, h } in page points
// (rule 21); page is { width, height } in the same points.

export const MIN_WIDTH = 24;
export const DEFAULT_WIDTH = 150;

const clamp = (value, low, high) => Math.min(Math.max(value, low), Math.max(low, high));

// A new signature of the given aspect (width / height), centred on a point and kept on the page.
export function placedAt(point, aspect, page) {
  const w = Math.min(DEFAULT_WIDTH, page.width);
  const h = w / aspect;
  return {
    x: clamp(point.x - w / 2, 0, page.width - w),
    y: clamp(point.y - h / 2, 0, page.height - h),
    w,
    h,
  };
}

export function movedBy(rect, dx, dy, page) {
  return {
    ...rect,
    x: clamp(rect.x + dx, 0, page.width - rect.w),
    y: clamp(rect.y + dy, 0, page.height - rect.h),
  };
}

// Dragging one corner ('nw', 'ne', 'sw', 'se') while the opposite corner stays put.
// The shape keeps its aspect ratio and the rect stays on the page.
export function resizedBy(rect, corner, dx, dy, page) {
  const aspect = rect.w / rect.h;
  const left = corner.includes('w');
  const top = corner.includes('n');
  const anchorX = left ? rect.x + rect.w : rect.x;
  const anchorY = top ? rect.y + rect.h : rect.y;
  const wanted = Math.max(rect.w + (left ? -dx : dx), (rect.h + (top ? -dy : dy)) * aspect);
  const roomX = left ? anchorX : page.width - anchorX;
  const roomY = top ? anchorY : page.height - anchorY;
  const w = clamp(wanted, Math.min(MIN_WIDTH, roomX, roomY * aspect), Math.min(roomX, roomY * aspect));
  const h = w / aspect;
  return { x: left ? anchorX - w : anchorX, y: top ? anchorY - h : anchorY, w, h };
}

// The box scaled down, if needed, to fit on the page, then moved onto it.
function fitted(rect, page) {
  const shrink = Math.min(1, page.width / rect.w, page.height / rect.h);
  const w = rect.w * shrink;
  const h = rect.h * shrink;
  return { x: clamp(rect.x, 0, page.width - w), y: clamp(rect.y, 0, page.height - h), w, h };
}

// The box of a signature turned a quarter turn: same centre, width and height swapped.
export function turnedRect(rect, page) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  return fitted({ x: cx - rect.h / 2, y: cy - rect.w / 2, w: rect.h, h: rect.w }, page);
}

// The box for a different picture (aspect is width / height): same centre and width.
export function replacedRect(rect, aspect, page) {
  const h = rect.w / aspect;
  return fitted({ x: rect.x, y: rect.y + (rect.h - h) / 2, w: rect.w, h }, page);
}
