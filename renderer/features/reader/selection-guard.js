// Keeps a drag-selection on the text the pointer is near. The browser does two things
// wrong over a page's invisible text layer:
//  - A drag that ENDS over empty space runs on to the end of the page's text. While a drag
//    is on, the marker at the end of each text layer covers the layer's empty space, and it
//    is kept right after the end of the selection, so empty space ends the selection where
//    it already is.
//  - A press that STARTS over empty space puts the start at the end of the page's text.
//    That drag is run here instead: the start, and every move, snaps to the nearest line.
const TOOL_MODES = ['annotating', 'editing-text', 'editing-images', 'redacting', 'signing'];
const SCROLL_EDGE = 32; // px from the top or bottom of the view where a drag scrolls it
const SCROLL_STEP = 24;

// The nearest line of a text layer to a point, and the point moved onto it.
function snapToLine(layer, x, y) {
  let best = null;
  for (const line of layer.querySelectorAll('.text-line')) {
    const box = line.getBoundingClientRect();
    if (!box.width || !box.height) continue;
    const dx = Math.max(box.left - x, 0, x - box.right);
    const dy = Math.max(box.top - y, 0, y - box.bottom);
    const distance = Math.hypot(dx, dy * 2); // lines run sideways, so across them counts double
    if (!best || distance < best.distance) best = { box, distance };
  }
  if (!best) return null;
  const { box } = best;
  return {
    x: Math.min(Math.max(x, box.left + 1), box.right - 1),
    y: y >= box.top && y <= box.bottom ? y : box.top + box.height / 2,
  };
}

// The text position (node, offset) for a point: where the point is if it is over text,
// else the nearest text. Null when the point is not over a page.
function caretAt(x, y) {
  const target = document.elementFromPoint(x, y);
  const layer = target?.closest('.text-layer');
  if (!layer) return null;
  const over = target.closest('.text-line') ? { x, y } : snapToLine(layer, x, y);
  if (!over) return null;
  const position = document.caretPositionFromPoint(over.x, over.y);
  return position ? { node: position.offsetNode, offset: position.offset } : null;
}

export function mountSelectionGuard(viewer) {
  let dragging = false;
  let marker = null; // the end-of-content marker that was moved
  let own = null; // a drag started over empty space: { node, offset } of its start

  const markerOf = (layer) => layer.querySelector(':scope > .end-of-content');
  const reset = () => {
    if (marker) marker.parentElement.append(marker);
    marker = null;
  };

  function follow() {
    const selection = document.getSelection();
    const { focusNode, anchorNode } = selection;
    const line = (focusNode?.nodeType === 1 ? focusNode : focusNode?.parentElement)?.closest('.text-line');
    if (!line) return;
    const reversed = anchorNode === focusNode
      ? selection.focusOffset < selection.anchorOffset
      : Boolean(focusNode.compareDocumentPosition(anchorNode) & Node.DOCUMENT_POSITION_FOLLOWING);
    const end = markerOf(line.parentElement);
    if (!end) return;
    if (marker && marker !== end) reset();
    line.parentElement.insertBefore(end, reversed ? line : line.nextSibling);
    marker = end;
  }

  function onPointerDown(event) {
    if (event.button !== 0 || !event.target.closest?.('.text-line')) return;
    dragging = true;
    viewer.classList.add('selecting');
  }

  // A press on the layer itself, not on a line: start the selection at the nearest text.
  function onMouseDown(event) {
    if (event.button !== 0 || event.shiftKey || event.detail > 1 || !event.target.matches?.('.text-layer')) return;
    if (TOOL_MODES.some((mode) => document.body.classList.contains(mode))) return;
    const start = caretAt(event.clientX, event.clientY);
    if (!start) return;
    event.preventDefault();
    viewer.focus({ preventScroll: true });
    own = start;
    document.getSelection().setBaseAndExtent(start.node, start.offset, start.node, start.offset);
  }

  function onMouseMove(event) {
    if (!own) return;
    if (!(event.buttons & 1)) {
      own = null;
      return;
    }
    const box = viewer.getBoundingClientRect();
    if (event.clientY < box.top + SCROLL_EDGE) viewer.scrollTop -= SCROLL_STEP;
    else if (event.clientY > box.bottom - SCROLL_EDGE) viewer.scrollTop += SCROLL_STEP;
    const at = caretAt(event.clientX, event.clientY);
    if (at) document.getSelection().setBaseAndExtent(own.node, own.offset, at.node, at.offset);
  }

  function onPointerUp() {
    own = null;
    if (!dragging) return;
    dragging = false;
    viewer.classList.remove('selecting');
    reset();
  }

  const onSelectionChange = () => {
    if (dragging) follow();
  };

  viewer.addEventListener('pointerdown', onPointerDown);
  viewer.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  document.addEventListener('selectionchange', onSelectionChange);
  return () => {
    viewer.removeEventListener('pointerdown', onPointerDown);
    viewer.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    document.removeEventListener('selectionchange', onSelectionChange);
  };
}
