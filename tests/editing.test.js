const test = require('node:test');
const assert = require('node:assert');

const load = async () => {
  const { createStore } = await import('../renderer/state/store.js');
  const { createEditing } = await import('../renderer/features/editing.js');
  return { createStore, createEditing };
};

// A document that is just a number, a slow engine, and a fake disk.
async function setup({ writeOk = true, savePath = 'C:\\docs\\copy.pdf' } = {}) {
  const { createStore, createEditing } = await load();
  const store = createStore();
  const tabId = store.openTab({ path: 'C:\\docs\\a.pdf', name: 'a.pdf', size: 1, view: { page: 1, zoom: 1 } });
  const doc = { value: 0 };
  const later = () => new Promise((resolve) => setTimeout(resolve, 1));
  const engine = { save: async () => { await later(); return `saved ${doc.value}`; } };
  const disk = new Map();
  const changed = [];
  const reader = { documentOf: () => ({ engine, docId: 1 }), pagesChanged: (_id, pages) => changed.push(...pages) };
  const folio = {
    chooseSavePath: async () => savePath,
    writeFile: async (path, bytes) => {
      if (writeOk) disk.set(path, bytes);
      return writeOk;
    },
  };
  const add = (n) => ({
    pages: [n],
    execute: async () => { await later(); doc.value += n; },
    undo: async () => { await later(); doc.value -= n; },
  });
  const tab = () => store.getState().tabs[0];
  return { store, tabId, doc, disk, changed, add, tab, editing: createEditing({ store, reader, folio }) };
}

test('edits, undo and redo run one after another, even when asked for at once', async () => {
  const { editing, tabId, doc, changed, add } = await setup();
  await Promise.all([
    editing.run(tabId, add(1)),
    editing.run(tabId, add(2)),
    editing.undo(tabId),
    editing.undo(tabId),
    editing.redo(tabId),
  ]);
  assert.strictEqual(doc.value, 1);
  assert.deepStrictEqual(changed, [1, 2, 2, 1, 1]);
});

test('undo with nothing to undo does nothing', async () => {
  const { editing, tabId, doc, tab } = await setup();
  await editing.undo(tabId);
  await editing.redo(tabId);
  assert.strictEqual(doc.value, 0);
  assert.strictEqual(tab().dirty, false);
});

test('save waits for the edit before it and writes the result', async () => {
  const { editing, tabId, disk, add, tab } = await setup();
  editing.run(tabId, add(5));
  assert.strictEqual(await editing.save(tabId), true);
  assert.strictEqual(disk.get('C:\\docs\\a.pdf'), 'saved 5');
  assert.strictEqual(tab().dirty, false);
});

test('a clean tab is not written again', async () => {
  const { editing, tabId, disk } = await setup();
  assert.strictEqual(await editing.save(tabId), true);
  assert.strictEqual(disk.size, 0);
});

test('a failed write leaves the tab dirty', async () => {
  const { editing, tabId, add, tab } = await setup({ writeOk: false });
  await editing.run(tabId, add(1));
  assert.strictEqual(await editing.save(tabId), false);
  assert.strictEqual(tab().dirty, true);
});

test('Save As writes the new file and the tab moves to it', async () => {
  const { editing, tabId, disk, add, tab } = await setup();
  await editing.run(tabId, add(3));
  assert.strictEqual(await editing.save(tabId, { as: true }), true);
  assert.strictEqual(disk.get('C:\\docs\\copy.pdf'), 'saved 3');
  assert.deepStrictEqual([tab().name, tab().dirty], ['copy.pdf', false]);
});

test('cancelling Save As changes nothing', async () => {
  const { editing, tabId, disk, add, tab } = await setup({ savePath: null });
  await editing.run(tabId, add(3));
  assert.strictEqual(await editing.save(tabId, { as: true }), false);
  assert.strictEqual(disk.size, 0);
  assert.deepStrictEqual([tab().name, tab().dirty], ['a.pdf', true]);
});
