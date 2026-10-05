import { activeTab } from '../state/store.js';

// Menu items arrive here by name. Tab and zoom commands change the store;
// the rest belong to the document on screen and go to the reader.
export function runCommand(store, reader, name) {
  const tab = activeTab(store.getState());
  switch (name) {
    case 'close-tab':
      if (tab) store.closeTab(tab.id);
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
      reader.command(name);
      break;
    case 'toggle-sidebar':
      store.setSidebar({ open: !store.getState().sidebar.open });
      break;
  }
}
