// The one owner of app state (rule 11). Features read it and subscribe to
// changes; they never keep their own copy of the tabs.
// One tab is one document state (rule 12): file, view, undo history, dirty flag.

export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

// done and undone hold the edit commands (rule 16); undone[0] is redone first.
// saved is how many were done when the file was last saved, or -1 once that
// state can't be reached again. The tab is dirty whenever it isn't there.
const EMPTY_HISTORY = Object.freeze({ done: [], undone: [], saved: 0 });

function withHistory(tab, history) {
  return { ...tab, history, dirty: history.done.length !== history.saved };
}

export function createStore() {
  let nextId = 1;
  let state = { tabs: [], activeId: null, sidebar: { open: true, panel: 'thumbs' } };
  const listeners = new Set();

  function set(next) {
    state = next;
    for (const listener of listeners) listener(state);
  }

  const indexOf = (id) => state.tabs.findIndex((tab) => tab.id === id);

  function updateTab(id, change) {
    const index = indexOf(id);
    if (index === -1) return;
    const next = change(state.tabs[index]);
    if (next !== state.tabs[index]) set({ ...state, tabs: state.tabs.map((tab) => (tab.id === id ? next : tab)) });
  }

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
      const tab = withHistory({ id: nextId++, path, name, size, page: view.page, zoom: view.zoom, fit: view.fit ?? null }, EMPTY_HISTORY);
      set({
        ...state,
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
      set({ ...state, tabs, activeId });
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

    // fit is 'width', 'page' or null (a fixed zoom); leave it out to keep it as it is.
    setView(id, { page, zoom, fit }) {
      let changed = false;
      const tabs = state.tabs.map((tab) => {
        if (tab.id !== id) return tab;
        const next = {
          ...tab,
          page: page ?? tab.page,
          zoom: zoom ?? tab.zoom,
          fit: fit === undefined ? tab.fit : fit,
        };
        changed = next.page !== tab.page || next.zoom !== tab.zoom || next.fit !== tab.fit;
        return changed ? next : tab;
      });
      if (changed) set({ ...state, tabs });
    },

    // An edit that has just been carried out. It clears what could be redone.
    recordEdit(id, command) {
      updateTab(id, (tab) => {
        const { done, saved } = tab.history;
        return withHistory(tab, { done: [...done, command], undone: [], saved: saved > done.length ? -1 : saved });
      });
    },

    // step: -1 after an undo, +1 after a redo. The command itself has already run.
    stepHistory(id, step) {
      updateTab(id, (tab) => {
        const { done, undone, saved } = tab.history;
        if (step < 0 && done.length) {
          return withHistory(tab, { done: done.slice(0, -1), undone: [done.at(-1), ...undone], saved });
        }
        if (step > 0 && undone.length) {
          return withHistory(tab, { done: [...done, undone[0]], undone: undone.slice(1), saved });
        }
        return tab;
      });
    },

    markSaved(id) {
      updateTab(id, (tab) => withHistory(tab, { ...tab.history, saved: tab.history.done.length }));
    },

    // After Save As the tab shows the new file.
    renameTab(id, path) {
      updateTab(id, (tab) => ({ ...tab, path, name: path.split(/[\\/]/).pop() }));
    },

    // panel is 'thumbs', 'outline' or 'results'.
    setSidebar(patch) {
      set({ ...state, sidebar: { ...state.sidebar, ...patch } });
    },

    // direction: +1 zooms in, -1 zooms out, along ZOOM_STEPS.
    stepZoom(id, direction) {
      const tab = state.tabs[indexOf(id)];
      if (!tab) return;
      const zoom = direction > 0
        ? ZOOM_STEPS.find((step) => step > tab.zoom + 1e-9)
        : [...ZOOM_STEPS].reverse().find((step) => step < tab.zoom - 1e-9);
      if (zoom) store.setView(id, { zoom, fit: null });
    },
  };

  return store;
}

export function activeTab(state) {
  return state.tabs.find((tab) => tab.id === state.activeId) ?? null;
}
