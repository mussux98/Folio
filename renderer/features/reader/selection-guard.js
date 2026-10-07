// Stops a drag-selection from running on when the pointer is over empty space.
// Without this the browser ends the selection at the nearest end of the page's
// text, taking in everything after the pointer. While a drag is on, the marker
// at the end of each text layer covers the layer's empty space, and it is kept
// right after the end of the selection, so empty space ends the selection where
// it already is.
export function mountSelectionGuard(viewer) {
  let dragging = false;
  let marker = null; // the end-of-content marker that was moved

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

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    viewer.classList.remove('selecting');
    reset();
  }

  const onSelectionChange = () => {
    if (dragging) follow();
  };

  viewer.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  document.addEventListener('selectionchange', onSelectionChange);
  return () => {
    viewer.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    document.removeEventListener('selectionchange', onSelectionChange);
  };
}
