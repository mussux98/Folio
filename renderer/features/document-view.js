import { activeTab } from '../state/store.js';

// What fills the window under the tabs. Until the reader exists (phase 1b) an
// open document is shown as a small card with its file details.
export function mountDocumentView(container, store, folio) {
  function row(label, value) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    return [dt, dd];
  }

  function renderEmpty() {
    const box = document.createElement('div');
    box.className = 'empty';

    const title = document.createElement('h1');
    title.textContent = 'Folio';
    const hint = document.createElement('p');
    hint.textContent = 'Drop a PDF here, or open one to get started.';
    const button = document.createElement('button');
    button.className = 'primary';
    button.textContent = 'Open a PDF…';
    button.addEventListener('click', () => folio.openDialog());

    box.append(title, hint, button);
    return box;
  }

  function renderTab(tab) {
    const box = document.createElement('div');
    box.className = 'doc-card';

    const title = document.createElement('h2');
    title.textContent = tab.name;
    const details = document.createElement('dl');
    details.append(
      ...row('Location', tab.path),
      ...row('Size', formatSize(tab.size)),
      ...row('Page', String(tab.page)),
      ...row('Zoom', `${Math.round(tab.zoom * 100)}%`),
    );

    box.append(title, details);
    return box;
  }

  function render(state) {
    const tab = activeTab(state);
    container.replaceChildren(tab ? renderTab(tab) : renderEmpty());
  }

  store.subscribe(render);
  render(store.getState());
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
