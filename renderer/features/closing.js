// Closing a tab or the window never drops unsaved changes without asking
// (rule 15). The question itself is a native dialog from the main process.
export function createClosing({ store, editing, folio }) {
  const asking = new Set(); // tabs whose question is on screen

  async function closeTab(tabId) {
    const tab = store.getState().tabs.find((t) => t.id === tabId);
    if (!tab || asking.has(tabId)) return;
    if (tab.dirty) {
      asking.add(tabId);
      const choice = await folio.askToSave([tab.name]).finally(() => asking.delete(tabId));
      if (choice === 'cancel') return;
      if (choice === 'save' && !(await editing.save(tabId))) return;
    }
    store.closeTab(tabId);
  }

  // The main process asked while the window was closing, and the user chose
  // to save. If a save fails or is cancelled, the window stays open.
  async function saveAllAndClose() {
    for (const tab of store.getState().tabs.filter((t) => t.dirty)) {
      if (!(await editing.save(tab.id))) return;
    }
    folio.closeWindow();
  }

  // The main process needs the names of the unsaved tabs for that question.
  let reported = '[]';
  store.subscribe(({ tabs }) => {
    const names = tabs.filter((tab) => tab.dirty).map((tab) => tab.name);
    const json = JSON.stringify(names);
    if (json === reported) return;
    reported = json;
    folio.setDirty(names);
  });

  return { closeTab, saveAllAndClose };
}
