const EDGE = 40; // px from the top or bottom of the list where dragging scrolls it
const SCROLL_STEP = 16;

// Dragging thumbnails to reorder pages. Dragging a picked page takes all the
// picked pages along; dragging any other page takes just that one. The gap
// under the pointer shows as a line, and dropping calls move(indexes, gap).
// getLayout() is { tops, heights } of the thumbnails, in the surface's own pixels.
export function mountDrag({ scroller, surface, items, getLayout, store, tabId, selection, move }) {
  const line = document.createElement('div');
  line.className = 'thumb-drop';
  line.hidden = true;
  surface.append(line);
  let dragged = null; // the page indexes being dragged

  function gapAt(clientY) {
    const { tops, heights } = getLayout();
    const y = clientY - surface.getBoundingClientRect().top;
    const found = tops.findIndex((top, i) => y < top + heights[i] / 2);
    return found === -1 ? tops.length : found;
  }

  function showLine(gap) {
    const { tops, heights } = getLayout();
    const last = tops.length - 1;
    line.style.top = `${gap > last ? tops[last] + heights[last] : tops[gap]}px`;
    line.hidden = false;
  }

  const hide = () => { line.hidden = true; };

  items.forEach(({ el }, i) => {
    el.draggable = true;
    el.addEventListener('dragstart', (event) => {
      if (!selection.picked().includes(i)) store.setSelection(tabId, [i]);
      dragged = selection.picked();
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', dragged.map((n) => n + 1).join(','));
    });
    el.addEventListener('dragend', () => {
      dragged = null;
      hide();
    });
  });

  scroller.addEventListener('dragover', (event) => {
    if (!dragged) return; // a file from Explorer is handled by the window
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    showLine(gapAt(event.clientY));
    const box = scroller.getBoundingClientRect();
    if (event.clientY < box.top + EDGE) scroller.scrollTop -= SCROLL_STEP;
    else if (event.clientY > box.bottom - EDGE) scroller.scrollTop += SCROLL_STEP;
  });

  scroller.addEventListener('dragleave', (event) => {
    if (!scroller.contains(event.relatedTarget)) hide();
  });

  scroller.addEventListener('drop', (event) => {
    if (!dragged) return;
    event.preventDefault();
    const indexes = dragged;
    dragged = null;
    hide();
    move(indexes, gapAt(event.clientY));
  });
}
