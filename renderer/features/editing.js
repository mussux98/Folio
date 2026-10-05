// Runs edits, undo, redo and saving. Each tab's work happens one step at a
// time, so a save never catches an edit half done and quick Ctrl+Z presses
// undo one edit each. A command is { pages, execute(), undo() } (rule 16).
// reader.documentOf(tabId) gives { engine, docId }; reader.pagesChanged()
// redraws the pages an edit touched.
export function createEditing({ store, reader, folio }) {
  const queues = new Map(); // tab id -> the last step queued

  function inTurn(tabId, task) {
    const run = (queues.get(tabId) ?? Promise.resolve()).then(task);
    queues.set(tabId, run.catch(() => {}));
    return run;
  }

  const tabOf = (id) => store.getState().tabs.find((tab) => tab.id === id);

  function run(tabId, command) {
    return inTurn(tabId, async () => {
      await command.execute();
      store.recordEdit(tabId, command);
      reader.pagesChanged(tabId, command.pages);
    });
  }

  function undo(tabId) {
    return inTurn(tabId, async () => {
      const command = tabOf(tabId)?.history.done.at(-1);
      if (!command) return;
      await command.undo();
      store.stepHistory(tabId, -1);
      reader.pagesChanged(tabId, command.pages);
    });
  }

  function redo(tabId) {
    return inTurn(tabId, async () => {
      const command = tabOf(tabId)?.history.undone[0];
      if (!command) return;
      await command.execute();
      store.stepHistory(tabId, 1);
      reader.pagesChanged(tabId, command.pages);
    });
  }

  // Resolves to true once the file on disk matches the tab. Save As asks for
  // a new name first, and the tab moves to that file.
  function save(tabId, { as = false } = {}) {
    return inTurn(tabId, async () => {
      const tab = tabOf(tabId);
      const doc = reader.documentOf(tabId);
      if (!tab || !doc) return false;
      if (!as && !tab.dirty) return true;
      const target = as ? await folio.chooseSavePath(tab.path) : tab.path;
      if (!target) return false;
      const bytes = await doc.engine.save(doc.docId);
      if (!(await folio.writeFile(target, bytes))) return false;
      store.markSaved(tabId);
      if (target !== tab.path) store.renameTab(tabId, target);
      return true;
    });
  }

  return { run, undo, redo, save };
}
