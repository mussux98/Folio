const test = require('node:test');
const assert = require('node:assert');

// The renderer is ES modules; the tests are CommonJS.
const load = () => import('../renderer/state/store.js');

const file = (name, extra = {}) => ({
  path: `C:\\docs\\${name}`, name, size: 100, view: { page: 1, zoom: 1 }, ...extra,
});

async function storeWith(...names) {
  const { createStore } = await load();
  const store = createStore();
  const ids = names.map((name) => store.openTab(file(name)));
  return { store, ids };
}

const names = (store) => store.getState().tabs.map((tab) => tab.name);

test('opening a file adds a tab and makes it active', async () => {
  const { store, ids } = await storeWith('a.pdf', 'b.pdf');
  assert.deepStrictEqual(names(store), ['a.pdf', 'b.pdf']);
  assert.strictEqual(store.getState().activeId, ids[1]);
});

test('a tab starts with the saved page and zoom', async () => {
  const { createStore } = await load();
  const store = createStore();
  store.openTab(file('a.pdf', { view: { page: 12, zoom: 2 } }));
  const [tab] = store.getState().tabs;
  assert.deepStrictEqual([tab.page, tab.zoom, tab.dirty], [12, 2, false]);
});

test('opening a file that is already open activates it instead', async () => {
  const { store, ids } = await storeWith('a.pdf', 'b.pdf');
  const again = store.openTab(file('a.pdf'));
  assert.strictEqual(again, ids[0]);
  assert.strictEqual(store.getState().tabs.length, 2);
  assert.strictEqual(store.getState().activeId, ids[0]);
});

test('activate: false keeps the current tab (used when restoring)', async () => {
  const { store, ids } = await storeWith('a.pdf');
  store.openTab(file('b.pdf', { activate: false }));
  assert.strictEqual(store.getState().activeId, ids[0]);
});

test('the first restored tab becomes active even with activate: false', async () => {
  const { createStore } = await load();
  const store = createStore();
  const id = store.openTab(file('a.pdf', { activate: false }));
  assert.strictEqual(store.getState().activeId, id);
});

test('closing the active tab activates its right neighbour', async () => {
  const { store, ids } = await storeWith('a.pdf', 'b.pdf', 'c.pdf');
  store.activateTab(ids[1]);
  store.closeTab(ids[1]);
  assert.strictEqual(store.getState().activeId, ids[2]);
});

test('closing the last tab activates the one on its left', async () => {
  const { store, ids } = await storeWith('a.pdf', 'b.pdf');
  store.closeTab(ids[1]);
  assert.strictEqual(store.getState().activeId, ids[0]);
});

test('closing a background tab keeps the active one', async () => {
  const { store, ids } = await storeWith('a.pdf', 'b.pdf', 'c.pdf');
  store.closeTab(ids[0]);
  assert.strictEqual(store.getState().activeId, ids[2]);
});

test('closing the only tab leaves nothing active', async () => {
  const { store, ids } = await storeWith('a.pdf');
  store.closeTab(ids[0]);
  assert.deepStrictEqual(store.getState(), { tabs: [], activeId: null });
});

test('moveTab reorders by gap, before and after the tab', async () => {
  const { store, ids } = await storeWith('a.pdf', 'b.pdf', 'c.pdf', 'd.pdf');
  store.moveTab(ids[0], 3); // a into the gap before d
  assert.deepStrictEqual(names(store), ['b.pdf', 'c.pdf', 'a.pdf', 'd.pdf']);
  store.moveTab(ids[3], 0); // d to the front
  assert.deepStrictEqual(names(store), ['d.pdf', 'b.pdf', 'c.pdf', 'a.pdf']);
  store.moveTab(ids[1], 4); // b to the end
  assert.deepStrictEqual(names(store), ['d.pdf', 'c.pdf', 'a.pdf', 'b.pdf']);
});

test('moveTab into its own place changes nothing and notifies nobody', async () => {
  const { store, ids } = await storeWith('a.pdf', 'b.pdf', 'c.pdf');
  let calls = 0;
  store.subscribe(() => calls++);
  store.moveTab(ids[1], 1);
  store.moveTab(ids[1], 2);
  assert.strictEqual(calls, 0);
  assert.deepStrictEqual(names(store), ['a.pdf', 'b.pdf', 'c.pdf']);
});

test('reordering keeps the active tab', async () => {
  const { store, ids } = await storeWith('a.pdf', 'b.pdf', 'c.pdf');
  store.activateTab(ids[0]);
  store.moveTab(ids[0], 3);
  assert.strictEqual(store.getState().activeId, ids[0]);
});

test('cycleTab wraps around in both directions', async () => {
  const { store, ids } = await storeWith('a.pdf', 'b.pdf', 'c.pdf');
  store.cycleTab(1);
  assert.strictEqual(store.getState().activeId, ids[0]);
  store.cycleTab(-1);
  assert.strictEqual(store.getState().activeId, ids[2]);
});

test('every tab keeps its own page and zoom', async () => {
  const { store, ids } = await storeWith('a.pdf', 'b.pdf');
  store.setView(ids[0], { page: 5, zoom: 2 });
  store.setView(ids[1], { zoom: 0.5 });
  const [a, b] = store.getState().tabs;
  assert.deepStrictEqual([a.page, a.zoom], [5, 2]);
  assert.deepStrictEqual([b.page, b.zoom], [1, 0.5]);
});

test('stepZoom walks the zoom steps and stops at the ends', async () => {
  const { ZOOM_STEPS } = await load();
  const { store, ids } = await storeWith('a.pdf');
  const zoom = () => store.getState().tabs[0].zoom;
  store.stepZoom(ids[0], 1);
  assert.strictEqual(zoom(), 1.25);
  store.stepZoom(ids[0], -1);
  store.stepZoom(ids[0], -1);
  assert.strictEqual(zoom(), 0.75);
  for (let i = 0; i < 20; i++) store.stepZoom(ids[0], -1);
  assert.strictEqual(zoom(), ZOOM_STEPS[0]);
  for (let i = 0; i < 20; i++) store.stepZoom(ids[0], 1);
  assert.strictEqual(zoom(), ZOOM_STEPS.at(-1));
});

test('stepZoom from an in-between zoom lands on the next step', async () => {
  const { createStore } = await load();
  const store = createStore();
  const id = store.openTab(file('a.pdf', { view: { page: 1, zoom: 1.1 } }));
  store.stepZoom(id, 1);
  assert.strictEqual(store.getState().tabs[0].zoom, 1.25);
  store.setView(id, { zoom: 1.1 });
  store.stepZoom(id, -1);
  assert.strictEqual(store.getState().tabs[0].zoom, 1);
});

test('subscribers hear about changes and can unsubscribe', async () => {
  const { store, ids } = await storeWith('a.pdf');
  let calls = 0;
  const stop = store.subscribe(() => calls++);
  store.setView(ids[0], { page: 2 });
  stop();
  store.setView(ids[0], { page: 3 });
  assert.strictEqual(calls, 1);
});
