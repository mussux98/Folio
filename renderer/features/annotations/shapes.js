// Geometry for the drawn annotations (ink, rectangles, ellipses, lines, stamps),
// all in page points (rule 21). Points are { x, y }, boxes { x, y, w, h }, and
// page is { width, height }. A spec holds the fields described in pdf-engine/drawings.js.

export const DRAWN = ['Ink', 'Square', 'Circle', 'Line', 'Stamp'];
export const BOXED = ['Square', 'Circle', 'Stamp'];

const HIT_SLACK = 4; // points a click may miss a stroke by
const MIN_SIZE = 4; // points: the smallest box a shape is resized to

const clamp = (value, low, high) => Math.min(Math.max(value, low), Math.max(low, high));

function boundsOf(points, pad = 0) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
}

const pointsOf = (spec) => (spec.type === 'Ink' ? spec.paths.flat() : spec.points);

// The box a shape covers, its stroke included.
export function boxOf(spec) {
  if (BOXED.includes(spec.type)) return spec.rects[0];
  return boundsOf(pointsOf(spec), (spec.width ?? 1) / 2);
}

function distanceToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / length, 0, 1) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// Whether a click at the point picks the shape: on a stroke, or anywhere inside a box.
export function hits(spec, point) {
  if (BOXED.includes(spec.type)) {
    const { x, y, w, h } = spec.rects[0];
    return point.x >= x - HIT_SLACK && point.x <= x + w + HIT_SLACK && point.y >= y - HIT_SLACK && point.y <= y + h + HIT_SLACK;
  }
  const reach = (spec.width ?? 1) / 2 + HIT_SLACK;
  const paths = spec.type === 'Ink' ? spec.paths : [spec.points];
  return paths.some((path) => path.some((a, i) => distanceToSegment(point, a, path[Math.min(i + 1, path.length - 1)]) <= reach));
}

// The changes that move a shape by (dx, dy), kept on the page.
export function movedBy(spec, dx, dy, page) {
  const box = boxOf(spec);
  const mx = clamp(dx, -box.x, page.width - box.x - box.w);
  const my = clamp(dy, -box.y, page.height - box.y - box.h);
  const shift = ({ x, y }) => ({ x: x + mx, y: y + my });
  if (spec.type === 'Ink') return { paths: spec.paths.map((path) => path.map(shift)) };
  if (spec.type === 'Line') return { points: spec.points.map(shift) };
  return { rects: [{ ...box, ...shift(box) }] };
}

// Dragging one corner ('nw', 'ne', 'sw', 'se') of a box while the opposite one stays.
// With keepAspect the box keeps its shape, as a stamp's words do.
export function resizedBy(rect, corner, dx, dy, page, keepAspect) {
  const left = corner.includes('w');
  const top = corner.includes('n');
  const anchorX = left ? rect.x + rect.w : rect.x;
  const anchorY = top ? rect.y + rect.h : rect.y;
  const roomX = left ? anchorX : page.width - anchorX;
  const roomY = top ? anchorY : page.height - anchorY;
  let w = clamp(rect.w + (left ? -dx : dx), MIN_SIZE, roomX);
  let h = clamp(rect.h + (top ? -dy : dy), MIN_SIZE, roomY);
  if (keepAspect) {
    const aspect = rect.w / rect.h;
    w = clamp(Math.max(w, h * aspect), MIN_SIZE * aspect, Math.min(roomX, roomY * aspect));
    h = w / aspect;
  }
  return { x: left ? anchorX - w : anchorX, y: top ? anchorY - h : anchorY, w, h };
}

// The end of a line with Shift held: the nearest 45° direction from the start.
export function snapped(start, end) {
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(end.y - start.y, end.x - start.x) / step) * step;
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  return { x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length };
}

// The box dragged out from start to end. With square set it is as tall as it is wide.
export function boxFrom(start, end, square) {
  let w = end.x - start.x;
  let h = end.y - start.y;
  if (square) {
    const side = Math.min(Math.abs(w), Math.abs(h));
    w = Math.sign(w || 1) * side;
    h = Math.sign(h || 1) * side;
  }
  return { x: Math.min(start.x, start.x + w), y: Math.min(start.y, start.y + h), w: Math.abs(w), h: Math.abs(h) };
}

// A box of the given size centred on a point and kept on the page.
export function centredAt(point, w, h, page) {
  return { x: clamp(point.x - w / 2, 0, page.width - w), y: clamp(point.y - h / 2, 0, page.height - h), w, h };
}

export const onPage = ({ x, y }, page) => ({ x: clamp(x, 0, page.width), y: clamp(y, 0, page.height) });
