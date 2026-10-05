const test = require('node:test');
const assert = require('node:assert');

const load = async () => {
  const { createEngine } = await import('../pdf-engine/engine.js');
  const { makePdf } = await import('./fixtures/make-pdf.mjs');
  return { engine: createEngine(), makePdf };
};

const texts = (engine, id) => {
  const count = engine.pageSizes(id).length / 2;
  return Array.from({ length: count }, (_, i) => engine.getText(id, i).map((line) => line.text).join(' '));
};

test('deleting pages and restoring them puts them back in place', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['a', 'b', 'c', 'd']));
  const token = engine.deletePages(id, [1, 3]);
  assert.deepStrictEqual(texts(engine, id), ['a', 'c']);
  engine.restorePages(id, token);
  assert.deepStrictEqual(texts(engine, id), ['a', 'b', 'c', 'd']);
});

test('the last page cannot be deleted', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['a', 'b']));
  assert.throws(() => engine.deletePages(id, [0, 1]), /at least one page/);
});

test('pages are reordered by a list of old positions', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['a', 'b', 'c']));
  engine.arrangePages(id, [2, 0, 1]);
  assert.deepStrictEqual(texts(engine, id), ['c', 'a', 'b']);
  assert.throws(() => engine.arrangePages(id, [0, 0, 1]), /not valid/);
});

test('a blank page is added at a position', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['a', 'b']));
  engine.addBlankPage(id, 1, [300, 400]);
  assert.deepStrictEqual(texts(engine, id), ['a', '', 'b']);
  assert.deepStrictEqual([...engine.pageSizes(id)].slice(2, 4), [300, 400]);
});

test('pages of another file are copied in, and survive a save', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['a', 'b']));
  const added = engine.insertPagesFrom(id, 1, makePdf(['x', 'y', 'z']), [2, 0]);
  assert.strictEqual(added, 2);
  assert.deepStrictEqual(texts(engine, id), ['a', 'z', 'x', 'b']);
  const saved = engine.openDocument(engine.save(id));
  assert.deepStrictEqual(texts(engine, saved.id), ['a', 'z', 'x', 'b']);
});

test('a whole file can be inserted, and a bad one is refused', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['a']));
  assert.strictEqual(engine.insertPagesFrom(id, 1, makePdf(['x', 'y'])), 2);
  assert.throws(() => engine.insertPagesFrom(id, 0, new Uint8Array([1, 2, 3, 4, 5])), /not a valid PDF/);
});

test('extracting makes a new file with just those pages', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['a', 'b', 'c']));
  const bytes = engine.extractPages(id, [2, 0]);
  const copy = engine.openDocument(bytes);
  assert.deepStrictEqual(texts(engine, copy.id), ['c', 'a']);
  assert.deepStrictEqual(texts(engine, id), ['a', 'b', 'c']);
});
