import { createStore, activeTab } from './state/store.js';
import { mountTabs } from './features/tabs.js';
import { createReader } from './features/reader/reader.js';
import { createEditing } from './features/editing.js';
import { createClosing } from './features/closing.js';
import { mountDropOpen } from './features/drop-open.js';
import { mountSession } from './features/session.js';
import { createSignatures } from './features/signatures/signatures.js';
import { createTextEditing } from './features/text-edit/text-edit.js';
import { createPageTools } from './features/page-tools/page-tools.js';
import { runCommand } from './features/commands.js';

const folio = window.folio;
const store = createStore();

const reader = createReader({ container: document.getElementById('content'), store, folio });
const editing = createEditing({ store, reader, folio });
reader.setSigning(createSignatures({ store, reader, editing, folio }));
const textEditing = createTextEditing({ reader, editing });
reader.setTextEditing(textEditing);
const pageTools = createPageTools({ store, reader, editing, folio });
reader.setPageTools(pageTools);
const closing = createClosing({ store, editing, folio });
mountTabs(document.getElementById('tabs'), { store, folio, closeTab: closing.closeTab });
mountDropOpen(folio);
mountSession(store, folio);

store.subscribe((state) => {
  const tab = activeTab(state);
  document.title = tab ? `${tab.dirty ? '• ' : ''}${tab.name} - Folio` : 'Folio';
});

folio.onFileOpened((file) => store.openTab(file));
folio.onMenuCommand((name) => runCommand({ store, reader, editing, closing, textEditing, pageTools }, name));

// Listeners are in place, so the main process can start sending files.
folio.appReady();
