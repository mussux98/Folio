const ZOOM_CHOICES = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

function button(label, title, onClick, className = '') {
  const el = document.createElement('button');
  el.className = `tool ${className}`.trim();
  el.textContent = label;
  el.title = title;
  el.setAttribute('aria-label', title);
  el.addEventListener('click', onClick);
  return el;
}

function option(value, label) {
  const el = document.createElement('option');
  el.value = value;
  el.textContent = label;
  return el;
}

// The bar above the pages: sidebar, page number, zoom, search, editing, signing and print.
export function createToolbar({ tabId, pageCount, store, viewer, find, print, openSignMenu, toggleTextEditing, annotating, redacting }) {
  const el = document.createElement('div');
  el.className = 'toolbar';

  const sidebarToggle = button('☰', 'Show or hide the sidebar (T)', () => {
    store.setSidebar({ open: !store.getState().sidebar.open });
  });

  // Pages
  const pageInput = document.createElement('input');
  pageInput.className = 'page-input';
  pageInput.type = 'text';
  pageInput.inputMode = 'numeric';
  pageInput.setAttribute('aria-label', 'Page number');
  const pageTotal = document.createElement('span');
  pageTotal.className = 'page-total';
  pageTotal.textContent = `/ ${pageCount}`;
  const goToInput = () => {
    const n = parseInt(pageInput.value, 10);
    if (n >= 1) viewer.goToPage(n);
    pageInput.blur();
  };
  pageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') goToInput();
  });
  pageInput.addEventListener('focus', () => pageInput.select());
  pageInput.addEventListener('blur', () => { pageInput.value = String(currentTab()?.page ?? 1); });

  // Zoom
  const zoomSelect = document.createElement('select');
  zoomSelect.className = 'zoom-select';
  zoomSelect.setAttribute('aria-label', 'Zoom');
  const custom = option('custom', '');
  custom.hidden = true;
  zoomSelect.append(
    option('fit-width', 'Fit width'),
    option('fit-page', 'Fit page'),
    ...ZOOM_CHOICES.map((zoom) => option(String(zoom), `${Math.round(zoom * 100)}%`)),
    custom,
  );
  zoomSelect.addEventListener('change', () => {
    const { value } = zoomSelect;
    if (value.startsWith('fit-')) store.setView(tabId, { fit: value.slice(4) });
    else if (value !== 'custom') store.setView(tabId, { zoom: Number(value), fit: null });
    zoomSelect.blur();
  });

  // Search
  const findInput = document.createElement('input');
  findInput.className = 'find-input';
  findInput.type = 'search';
  findInput.placeholder = 'Find in document';
  findInput.setAttribute('aria-label', 'Find in document');
  const findCount = document.createElement('span');
  findCount.className = 'find-count';
  findInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const query = findInput.value.trim();
    if (query !== find.state.query) {
      store.setSidebar({ open: true, panel: 'results' });
      find.search(query);
    } else if (event.shiftKey) {
      find.previous();
    } else {
      find.next();
    }
  });
  findInput.addEventListener('search', () => {
    // The clear button inside a search field.
    if (!findInput.value && find.state.query) find.search('');
  });

  // Marking acts on the text selected on the page, so these buttons must not take the selection away.
  const markButtons = [
    ['Highlight', 'Highlight the selected text', () => annotating.markSelection('Highlight')],
    ['Underline', 'Underline the selected text', () => annotating.markSelection('Underline')],
    ['Strike', 'Strike out the selected text', () => annotating.markSelection('StrikeOut')],
    ['Note', 'Add a sticky note', () => annotating.startNote(), 'note-button'],
    ['Pen', 'Draw freehand', () => annotating.startPen(), 'pen-button'],
    ['Shapes ▾', 'Draw a rectangle, ellipse, line or arrow', (event) => annotating.openShapes(event.currentTarget), 'shapes-button'],
    ['Stamp ▾', 'Add a stamp such as Approved or Draft', (event) => annotating.openStamps(event.currentTarget), 'stamp-button'],
  ].map(([label, title, onClick, kind = '']) => {
    const mark = button(label, title, onClick, `mark-button ${kind}`.trim());
    mark.addEventListener('mousedown', (event) => event.preventDefault());
    return mark;
  });

  // Redact acts on the selected text when there is some, so it must not take the selection away either.
  const redactButton = button('Redact', 'Remove the selected text, or drag over areas to remove (Ctrl+Shift+X)', redacting.toggle, 'redact-button');
  redactButton.addEventListener('mousedown', (event) => event.preventDefault());

  el.append(
    sidebarToggle,
    separator(),
    button('◀', 'Previous page', () => viewer.goToPage((currentTab()?.page ?? 1) - 1), 'nav'),
    pageInput,
    pageTotal,
    button('▶', 'Next page', () => viewer.goToPage((currentTab()?.page ?? 1) + 1), 'nav'),
    separator(),
    button('−', 'Zoom out (Ctrl+-)', () => store.stepZoom(tabId, -1)),
    zoomSelect,
    button('+', 'Zoom in (Ctrl++)', () => store.stepZoom(tabId, 1)),
    separator(),
    findInput,
    button('▲', 'Previous match (Shift+Enter)', () => find.previous(), 'nav'),
    button('▼', 'Next match (Enter)', () => find.next(), 'nav'),
    findCount,
    spacer(),
    ...markButtons,
    separator(),
    button('Edit Text', 'Change or add text (Ctrl+E)', toggleTextEditing, 'edit-text-button'),
    redactButton,
    redacting.boxOption(),
    button('Sign', 'Add a signature', openSignMenu, 'sign-button'),
    button('Print', 'Print (Ctrl+P)', print),
  );

  function currentTab() {
    return store.getState().tabs.find((tab) => tab.id === tabId);
  }

  function render() {
    const tab = currentTab();
    if (!tab) return;
    if (document.activeElement !== pageInput) pageInput.value = String(tab.page);
    if (tab.fit) {
      zoomSelect.value = `fit-${tab.fit}`;
      return;
    }
    const known = ZOOM_CHOICES.find((zoom) => Math.abs(zoom - tab.zoom) < 0.001);
    custom.textContent = `${Math.round(tab.zoom * 100)}%`;
    zoomSelect.value = known ? String(known) : 'custom';
  }

  function renderFind(state) {
    if (!state.query) findCount.textContent = '';
    else if (state.searching && !state.hits.length) findCount.textContent = 'Searching…';
    else if (!state.hits.length) findCount.textContent = 'No matches';
    else findCount.textContent = `${state.current + 1} of ${state.hits.length}${state.searching || state.truncated ? '+' : ''}`;
  }

  const unsubscribe = store.subscribe(render);
  const unsubscribeFind = find.subscribe(renderFind);
  render();

  return {
    element: el,
    focusFind() {
      findInput.focus();
      findInput.select();
    },
    destroy() {
      unsubscribe();
      unsubscribeFind();
    },
  };
}

function separator() {
  const el = document.createElement('span');
  el.className = 'tool-separator';
  return el;
}

function spacer() {
  const el = document.createElement('span');
  el.className = 'tool-spacer';
  return el;
}
