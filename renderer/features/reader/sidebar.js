const PANELS = [
  { id: 'thumbs', label: 'Pages' },
  { id: 'outline', label: 'Outline' },
  { id: 'results', label: 'Results' },
];

// The left panel: page thumbnails, the outline and the search results.
// Which panel is showing, and whether the sidebar is open, lives in the store.
// panels: { thumbs, outline, results }, each with an element (thumbs may refresh()).
export function createSidebar({ store, panels }) {
  const el = document.createElement('aside');
  el.className = 'sidebar';

  const tabs = document.createElement('div');
  tabs.className = 'sidebar-tabs';
  tabs.setAttribute('role', 'tablist');
  const body = document.createElement('div');
  body.className = 'sidebar-body';

  const buttons = PANELS.map(({ id, label }) => {
    const button = document.createElement('button');
    button.className = 'sidebar-tab';
    button.textContent = label;
    button.setAttribute('role', 'tab');
    button.addEventListener('click', () => store.setSidebar({ panel: id }));
    return button;
  });
  tabs.append(...buttons);
  panels.results.element.hidden = true;
  body.append(...PANELS.map(({ id }) => panels[id].element));
  el.append(tabs, body);

  let shown = '';

  function render({ sidebar }) {
    el.hidden = !sidebar.open;
    PANELS.forEach(({ id }, i) => {
      const active = id === sidebar.panel;
      buttons[i].classList.toggle('active', active);
      buttons[i].setAttribute('aria-selected', String(active));
      panels[id].element.hidden = !active;
    });
    // Thumbnails jump to the current page only when they are brought into view.
    const now = `${sidebar.open}/${sidebar.panel}`;
    if (now !== shown && sidebar.open && sidebar.panel === 'thumbs') panels.thumbs.refresh();
    shown = now;
  }

  const unsubscribe = store.subscribe(render);
  render(store.getState());

  return { element: el, destroy: unsubscribe };
}
