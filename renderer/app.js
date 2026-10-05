import { createStore, activeTab } from './state/store.js';
import { mountTabs } from './features/tabs.js';
import { createReader } from './features/reader/reader.js';
import { mountDropOpen } from './features/drop-open.js';
import { mountSession } from './features/session.js';
import { runCommand } from './features/commands.js';

const folio = window.folio;
const store = createStore();

mountTabs(document.getElementById('tabs'), store, folio);
const reader = createReader({ container: document.getElementById('content'), store, folio });
mountDropOpen(folio);
mountSession(store, folio);

store.subscribe((state) => {
  const tab = activeTab(state);
  document.title = tab ? `${tab.name} - Folio` : 'Folio';
});

folio.onFileOpened((file) => store.openTab(file));
folio.onMenuCommand((name) => runCommand(store, reader, name));

// Listeners are in place, so the main process can start sending files.
folio.appReady();
