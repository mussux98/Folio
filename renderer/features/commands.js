import { activeTab } from '../state/store.js';
import { rotatePage } from '../commands/rotate-page.js';

const isTextField = (el) => el?.matches?.('input, textarea');

// Menu items arrive here by name. Tab and zoom commands change the store,
// edits and saving go through editing, and the rest belong to the document on
// screen and go to the reader. app is { store, reader, editing, closing, textEditing }.
export function runCommand({ store, reader, editing, closing, textEditing }, name) {
  const tab = activeTab(store.getState());
  const report = (promise) => promise.catch((err) => console.error(`${name} failed:`, err));
  switch (name) {
    case 'undo':
    case 'redo':
      // In the find box, Ctrl+Z undoes typing as usual.
      if (isTextField(document.activeElement)) document.execCommand(name);
      else if (tab) report(name === 'undo' ? editing.undo(tab.id) : editing.redo(tab.id));
      break;
    case 'save':
    case 'save-as':
      if (tab) report(editing.save(tab.id, { as: name === 'save-as' }));
      break;
    case 'save-all-and-close':
      report(closing.saveAllAndClose());
      break;
    case 'rotate-right':
    case 'rotate-left': {
      const doc = tab && reader.documentOf(tab.id);
      const degrees = name === 'rotate-right' ? 90 : -90;
      if (doc) report(editing.run(tab.id, rotatePage({ ...doc, index: tab.page - 1, degrees })));
      break;
    }
    case 'edit-text':
      if (tab) textEditing.toggle();
      break;
    case 'close-tab':
      if (tab) closing.closeTab(tab.id);
      break;
    case 'next-tab':
      store.cycleTab(1);
      break;
    case 'prev-tab':
      store.cycleTab(-1);
      break;
    case 'zoom-in':
      if (tab) store.stepZoom(tab.id, 1);
      break;
    case 'zoom-out':
      if (tab) store.stepZoom(tab.id, -1);
      break;
    case 'zoom-reset':
      if (tab) store.setView(tab.id, { zoom: 1, fit: null });
      break;
    case 'fit-width':
    case 'fit-page':
      if (tab) store.setView(tab.id, { fit: name.slice(4) });
      break;
    case 'find':
    case 'find-next':
    case 'find-previous':
    case 'print':
    case 'sign':
      reader.command(name);
      break;
    case 'toggle-sidebar':
      store.setSidebar({ open: !store.getState().sidebar.open });
      break;
  }
}
