// The tab bar: click to switch, x or middle-click to close, drag to reorder.
// closeTab(id) asks about unsaved changes first.

const TAB_DRAG_TYPE = 'application/x-folio-tab';

export function mountTabs(container, { store, folio, closeTab }) {
  const list = document.createElement('div');
  list.className = 'tab-list';
  list.setAttribute('role', 'tablist');

  const addButton = document.createElement('button');
  addButton.className = 'tab-add';
  addButton.textContent = '+';
  addButton.title = 'Open a PDF (Ctrl+O)';
  addButton.setAttribute('aria-label', 'Open a PDF');
  addButton.addEventListener('click', () => folio.openDialog());

  container.append(list, addButton);

  function render({ tabs, activeId }) {
    list.replaceChildren(...tabs.map((tab) => buildTab(tab, tab.id === activeId)));
    list.querySelector('.tab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function buildTab(tab, active) {
    const el = document.createElement('div');
    el.className = `tab${active ? ' active' : ''}${tab.dirty ? ' dirty' : ''}`;
    el.dataset.id = tab.id;
    el.draggable = true;
    el.title = tab.dirty ? `${tab.path} (not saved)` : tab.path;
    el.setAttribute('role', 'tab');
    el.setAttribute('aria-selected', String(active));

    const name = document.createElement('span');
    name.className = 'tab-name';
    name.textContent = tab.name;

    const close = document.createElement('button');
    close.className = 'tab-close';
    close.textContent = '×';
    close.title = 'Close tab';
    close.setAttribute('aria-label', `Close ${tab.name}`);

    el.append(name, close);
    return el;
  }

  const tabIdFrom = (event) => Number(event.target.closest('.tab')?.dataset.id) || null;

  list.addEventListener('click', (event) => {
    const id = tabIdFrom(event);
    if (!id) return;
    if (event.target.closest('.tab-close')) closeTab(id);
    else store.activateTab(id);
  });

  // Middle-click closes. The default would start scrolling the page.
  list.addEventListener('mousedown', (event) => {
    if (event.button === 1) event.preventDefault();
  });
  list.addEventListener('auxclick', (event) => {
    const id = tabIdFrom(event);
    if (event.button === 1 && id) closeTab(id);
  });

  // Reordering
  let dragId = null;

  // The gap under the pointer: 0 is before the first tab, tabs.length is after the last.
  function gapAt(clientX) {
    const tabs = [...list.querySelectorAll('.tab')];
    const index = tabs.findIndex((tab) => {
      const box = tab.getBoundingClientRect();
      return clientX < box.left + box.width / 2;
    });
    return index === -1 ? tabs.length : index;
  }

  function showGap(gap) {
    const tabs = [...list.querySelectorAll('.tab')];
    tabs.forEach((tab, i) => {
      tab.classList.toggle('gap-before', i === gap);
      tab.classList.toggle('gap-after', gap === tabs.length && i === tabs.length - 1);
    });
  }

  list.addEventListener('dragstart', (event) => {
    dragId = tabIdFrom(event);
    if (!dragId) return;
    event.dataTransfer.setData(TAB_DRAG_TYPE, String(dragId));
    event.dataTransfer.effectAllowed = 'move';
  });

  list.addEventListener('dragover', (event) => {
    if (!dragId) return;
    event.preventDefault();
    showGap(gapAt(event.clientX));
  });

  list.addEventListener('drop', (event) => {
    if (!dragId) return;
    event.preventDefault();
    store.moveTab(dragId, gapAt(event.clientX));
  });

  list.addEventListener('dragend', () => {
    dragId = null;
    showGap(-1);
  });

  store.subscribe(render);
  render(store.getState());
}
