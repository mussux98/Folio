import { shapeSvg } from './shape-svg.js';
import { boxFrom, snapped, onPage } from './shapes.js';

const MIN_STEP = 0.75; // points between two recorded points of a stroke
const MIN_SHAPE = 2; // points: anything smaller was a click, not a drag

// The spec for what has been drawn so far with a tool ('Ink', 'Square', 'Circle',
// 'Line' or 'Arrow'), or null if it is too small to keep.
function specFor(tool, points, shift, look) {
  const start = points[0];
  const end = points[points.length - 1];
  if (tool === 'Ink') {
    // A click leaves a dot.
    return { type: 'Ink', paths: [points.length > 1 ? points : [start, { x: start.x + 0.1, y: start.y }]], ...look };
  }
  if (tool === 'Square' || tool === 'Circle') {
    const box = boxFrom(start, end, shift);
    return box.w < MIN_SHAPE || box.h < MIN_SHAPE ? null : { type: tool, rects: [box], ...look };
  }
  const to = shift ? snapped(start, end) : end;
  if (Math.hypot(to.x - start.x, to.y - start.y) < MIN_SHAPE) return null;
  return { type: 'Line', points: [start, to], arrow: tool === 'Arrow', ...look };
}

// Draws one shape on a page's annotation layer, from a press on it until the
// button is let go. Esc gives up. The drawing is left on the layer when done, so
// nothing flickers until the page shows the real one and the layer is rebuilt.
// look is { color, width }; onDone(spec) gets the finished shape in page points.
export function drawShape({ layer, page, tool, event, look, onDone }) {
  // Measured once: the page may be redrawn, and the layer replaced, during the stroke.
  const box = layer.getBoundingClientRect();
  const scale = page.width / box.width;
  const pointOf = (e) => onPage({ x: (e.clientX - box.left) * scale, y: (e.clientY - box.top) * scale }, page);
  const points = [pointOf(event)];
  let shift = event.shiftKey;
  let preview = null;

  function show() {
    const spec = specFor(tool, points, shift, look);
    preview?.remove();
    preview = spec && shapeSvg(spec, page.width, page.height);
    if (preview) layer.append(preview);
    return spec;
  }

  function move(e) {
    const point = pointOf(e);
    const last = points[points.length - 1];
    shift = e.shiftKey;
    if (tool === 'Ink' && Math.hypot(point.x - last.x, point.y - last.y) < MIN_STEP) return;
    if (tool === 'Ink') points.push(point);
    else points[1] = point;
    show();
  }

  function stop() {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('keydown', onKey, true);
  }

  function finish(e) {
    if (e.button !== 0) return;
    stop();
    move(e);
    const spec = show();
    if (spec) onDone(spec);
  }

  function cancel() {
    stop();
    preview?.remove();
  }

  function onKey(e) {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    cancel();
  }

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', cancel);
  window.addEventListener('keydown', onKey, true);
  show();
}
