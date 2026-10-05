import { activeTab } from '../state/store.js';

// Menu items that act on tabs arrive here by name.
export function runCommand(store, name) {
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
      if (tab) store.setView(tab.id, { zoom: 1 });
      break;
  }
}
