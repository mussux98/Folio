// The text the user has selected, as one rect per line in page points (rule 21),
// grouped by page: [{ index, rects }]. Empty when nothing is selected.
// The selection is the browser's own, made over the invisible text layer.

function linesIn(range) {
  const ancestor = range.commonAncestorContainer;
  const root = ancestor.nodeType === Node.ELEMENT_NODE ? ancestor : ancestor.parentElement;
  const own = root.closest('.text-line');
  return own ? [own] : [...root.querySelectorAll('.text-line')];
}

export function selectedRects() {
  const selection = window.getSelection();
  if (!selection?.rangeCount || selection.isCollapsed) return [];
  const range = selection.getRangeAt(0);
  const pages = new Map(); // page element -> rects

  for (const line of linesIn(range)) {
    const text = line.firstChild;
    if (text?.nodeType !== Node.TEXT_NODE || !range.intersectsNode(line)) continue;
    const part = document.createRange();
    part.setStart(text, text === range.startContainer ? range.startOffset : 0);
    part.setEnd(text, text === range.endContainer ? range.endOffset : text.length);
    if (part.collapsed) continue;

    const page = line.closest('.page');
    const points = parseFloat(page.querySelector('.text-layer').style.width);
    const frame = page.getBoundingClientRect();
    const scale = frame.width / points; // pixels per point
    const box = part.getBoundingClientRect();
    if (!pages.has(page)) pages.set(page, []);
    pages.get(page).push({
      x: (box.left - frame.left) / scale,
      y: (box.top - frame.top) / scale,
      w: box.width / scale,
      h: box.height / scale,
    });
  }
  return [...pages].map(([page, rects]) => ({ index: Number(page.dataset.page) - 1, rects }));
}
