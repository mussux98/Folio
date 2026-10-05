// The document outline (table of contents) as a tree you can fold.
// items: [{ title, page (0-based or null), children }]
export function createOutline(items, viewer) {
  const root = document.createElement('div');
  root.className = 'outline';

  if (!items.length) {
    const none = document.createElement('p');
    none.className = 'panel-note';
    none.textContent = 'This document has no outline.';
    root.append(none);
    return { element: root };
  }

  function build(list, depth) {
    const group = document.createElement('div');
    for (const item of list) {
      const row = document.createElement('div');
      row.className = 'outline-row';
      row.style.paddingLeft = `${depth * 14 + 6}px`;

      const fold = document.createElement('button');
      fold.className = 'outline-fold';
      fold.setAttribute('aria-label', 'Show or hide sub-items');

      const title = document.createElement('button');
      title.className = 'outline-title';
      title.textContent = item.title || 'Untitled';
      title.disabled = item.page === null;
      title.addEventListener('click', () => viewer.goToPage(item.page + 1));

      row.append(fold, title);
      group.append(row);

      if (item.children.length) {
        const children = build(item.children, depth + 1);
        children.hidden = true;
        fold.textContent = '▸';
        fold.addEventListener('click', () => {
          children.hidden = !children.hidden;
          fold.textContent = children.hidden ? '▸' : '▾';
        });
        group.append(children);
      } else {
        fold.disabled = true;
      }
    }
    return group;
  }

  root.append(build(items, 0));
  return { element: root };
}
