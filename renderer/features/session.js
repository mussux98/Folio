// Tells the main process what is open and where each file was, so Folio can
// reopen in the same place. Only real changes are sent.
export function mountSession(store, folio) {
  let lastSession = '';
  const lastViews = new Map();

  store.subscribe(({ tabs, activeId }) => {
    const session = {
      paths: tabs.map((tab) => tab.path),
      active: tabs.find((tab) => tab.id === activeId)?.path ?? null,
    };
    const json = JSON.stringify(session);
    if (json !== lastSession) {
      lastSession = json;
      folio.saveSession(session);
    }

    for (const tab of tabs) {
      const key = `${tab.page}/${tab.zoom}/${tab.fit}`;
      if (lastViews.get(tab.path) === key) continue;
      // The first time a tab is seen, its view came from the saved one.
      if (lastViews.has(tab.path)) folio.saveView({ path: tab.path, page: tab.page, zoom: tab.zoom, fit: tab.fit });
      lastViews.set(tab.path, key);
    }
  });
}
