// The one owner of app state (rule 11). Features read it and subscribe to
// changes; they never keep their own copy of the tabs.
// One tab is one document state (rule 12). The undo stack joins it in phase 1c.

export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

export function createStore() {
  let nextId = 1;
  let state = { tabs: [], activeId: null };
  const listeners = new Set();

  function set(next) {
    state = next;
    for (const listener of listeners) listener(state);
  }

  const indexOf = (id) => state.tabs.findIndex((tab) => tab.id === id);

  const store = {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    // A file that is already open just becomes the active tab.
    openTab({ path, name, size, view, activate = true }) {
      const existing = state.tabs.find((tab) => tab.path === path);
      if (existing) {
        if (activate) set({ ...state, activeId: existing.id });
        return existing.id;
      }
      const tab = { id: nextId++, path, name, size, page: view.page, zoom: view.zoom, dirty: false };
      set({
        tabs: [...state.tabs, tab],
        activeId: activate || state.activeId === null ? tab.id : state.activeId,
      });
      return tab.id;
    },

    // The tab on the right takes over, or the one on the left if it was last.
    closeTab(id) {
      const index = indexOf(id);
      if (index === -1) return;
      const tabs = state.tabs.filter((tab) => tab.id !== id);
      const activeId = state.activeId === id ? (tabs[index] ?? tabs[index - 1])?.id ?? null : state.activeId;
      set({ tabs, activeId });
    },

    activateTab(id) {
      if (indexOf(id) !== -1 && state.activeId !== id) set({ ...state, activeId: id });
    },

    // toIndex is a gap between tabs, counted before the tab is lifted out.
    moveTab(id, toIndex) {
      const from = indexOf(id);
      if (from === -1) return;
      const to = toIndex > from ? toIndex - 1 : toIndex;
      if (to === from) return;
      const tabs = [...state.tabs];
      const [tab] = tabs.splice(from, 1);
      tabs.splice(to, 0, tab);
      set({ ...state, tabs });
    },

    // step: +1 for the next tab, -1 for the previous one; wraps around.
    cycleTab(step) {
      const count = state.tabs.length;
      if (count < 2) return;
      const next = (indexOf(state.activeId) + step + count) % count;
      set({ ...state, activeId: state.tabs[next].id });
    },

    setView(id, { page, zoom }) {
      const tabs = state.tabs.map((tab) => (tab.id === id
        ? { ...tab, page: page ?? tab.page, zoom: zoom ?? tab.zoom }
        : tab));
      set({ ...state, tabs });
    },

    // direction: +1 zooms in, -1 zooms out, along ZOOM_STEPS.
    stepZoom(id, direction) {
      const tab = state.tabs[indexOf(id)];
      if (!tab) return;
      const zoom = direction > 0
        ? ZOOM_STEPS.find((step) => step > tab.zoom + 1e-9)
        : [...ZOOM_STEPS].reverse().find((step) => step < tab.zoom - 1e-9);
      if (zoom) store.setView(id, { zoom });
    },
  };

  return store;
}

export function activeTab(state) {
  return state.tabs.find((tab) => tab.id === state.activeId) ?? null;
}
