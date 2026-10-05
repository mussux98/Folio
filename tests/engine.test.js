const test = require('node:test');
const assert = require('node:assert');

const load = async () => {
  const { createEngine } = await import('../pdf-engine/engine.js');
  const { makePdf } = await import('./fixtures/make-pdf.mjs');
  return { engine: createEngine(), makePdf };
};

test('opens a PDF and reports its page count', async () => {
  const { engine, makePdf } = await load();
  const doc = engine.openDocument(makePdf(['one', 'two', 'three']));
  assert.deepStrictEqual([doc.locked, doc.pageCount], [false, 3]);
});

test('a file that is not a PDF fails with a clear message', async () => {
  const { engine } = await load();
  assert.throws(() => engine.openDocument(new Uint8Array([1, 2, 3, 4])), /damaged or is not a valid PDF/);
});

test('page sizes follow the page rotation', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf([
    { text: 'a', size: [300, 400] },
    { text: 'b', size: [300, 400], rotate: 90 },
  ]));
  assert.deepStrictEqual([...engine.pageSizes(id)], [300, 400, 400, 300]);
});

test('renders a page at the requested scale', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['hello']));
  const page = engine.renderPage(id, 0, 2);
  assert.deepStrictEqual([page.width, page.height], [600, 800]);
  assert.strictEqual(page.pixels.length, 600 * 800 * 4);
  assert.ok(page.pixels.some((value, i) => i % 4 === 3 && value > 0), 'something was drawn');
});

test('extracts the text lines of a page', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['Hello world']));
  const [line] = engine.getText(id, 0);
  assert.strictEqual(line.text, 'Hello world');
  assert.ok(line.w > 0 && line.h > 0);
});

test('search finds every match with a boxed position and context', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['foo and foo again', 'nothing here']));
  const hits = engine.searchPage(id, 0, 'foo');
  assert.strictEqual(hits.length, 2);
  assert.strictEqual(hits[0].snippet, 'foo and foo again');
  assert.ok(hits[0].rects[0].x < hits[1].rects[0].x);
  assert.deepStrictEqual(engine.searchPage(id, 1, 'foo'), []);
});

test('a password-protected file stays locked until the right password', async () => {
  const { engine, makePdf } = await load();
  const opened = engine.openDocument(makePdf(['secret'], { password: 'hunter2' }));
  assert.strictEqual(opened.locked, true);
  assert.strictEqual(engine.authenticate(opened.id, 'wrong').locked, true);
  const unlocked = engine.authenticate(opened.id, 'hunter2');
  assert.deepStrictEqual([unlocked.locked, unlocked.pageCount], [false, 1]);
});

test('the outline lists titles with their pages', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['a', 'b'], {
    outline: [{ title: 'First', page: 1 }, { title: 'Second', page: 2 }],
  }));
  const outline = engine.getOutline(id);
  assert.deepStrictEqual(outline.map((item) => [item.title, item.page]), [['First', 0], ['Second', 1]]);
});

test('links say where they go', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['a', 'b'], {
    links: [
      { page: 0, rect: [10, 10, 60, 30], uri: 'https://example.com' },
      { page: 0, rect: [10, 40, 60, 60], uri: '#page=2' },
    ],
  }));
  const links = engine.getLinks(id, 0);
  assert.strictEqual(links.length, 2);
  assert.strictEqual(links.find((l) => l.uri).uri, 'https://example.com');
  assert.strictEqual(links.find((l) => l.page !== undefined).page, 1);
  assert.deepStrictEqual(engine.getLinks(id, 1), []);
});

test('a closed document can no longer be used', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['a']));
  engine.closeDocument(id);
  assert.throws(() => engine.pageSizes(id), /no longer open/);
});
