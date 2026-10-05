const test = require('node:test');
const assert = require('node:assert');

const load = async (pages) => {
  const { createEngine } = await import('../pdf-engine/engine.js');
  const { makePdf } = await import('./fixtures/make-pdf.mjs');
  const commands = await import('../renderer/commands/page-structure.js');
  const rotate = await import('../renderer/commands/rotate-page.js');
  const engine = createEngine();
  const { id: docId } = engine.openDocument(makePdf(pages));
  // The engine's calls are synchronous; the app's client answers with promises.
  const wrapped = new Proxy({}, { get: (_, name) => async (...args) => engine[name](...args) });
  const text = () => Array.from({ length: engine.pageSizes(docId).length / 2 }, (_, i) => (
    engine.getText(docId, i).map((line) => line.text).join('')
  ));
  return { commands, rotate, makePdf, target: { engine: wrapped, docId }, text, engine };
};

test('deleting pages is undone and redone in place, and says where to look', async () => {
  const { commands, target, text } = await load(['a', 'b', 'c', 'd']);
  const remove = commands.deletePages(target, [2, 1], 4);
  await remove.execute();
  assert.deepStrictEqual(text(), ['a', 'd']);
  assert.deepStrictEqual(remove.view.execute, { page: 2, select: [] });
  await remove.undo();
  assert.deepStrictEqual(text(), ['a', 'b', 'c', 'd']);
  assert.deepStrictEqual(remove.view.undo, { page: 2, select: [1, 2] });
  await remove.execute();
  assert.deepStrictEqual(text(), ['a', 'd']);
});

test('deleting the last pages lands on the new last page', async () => {
  const { commands, target } = await load(['a', 'b', 'c']);
  assert.strictEqual(commands.deletePages(target, [2], 3).view.execute.page, 2);
});

test('moving pages can be undone, and a move that changes nothing is not a command', async () => {
  const { commands, target, text } = await load(['a', 'b', 'c', 'd']);
  assert.strictEqual(commands.movePages(target, [1], 2, 4), null);
  const move = commands.movePages(target, [0, 1], 4, 4);
  await move.execute();
  assert.deepStrictEqual(text(), ['c', 'd', 'a', 'b']);
  assert.deepStrictEqual(move.view.execute, { page: 3, select: [2, 3] });
  await move.undo();
  assert.deepStrictEqual(text(), ['a', 'b', 'c', 'd']);
});

test('a blank page is added and removed again', async () => {
  const { commands, target, text } = await load(['a', 'b']);
  const blank = commands.insertBlankPage(target, 1, [200, 300]);
  await blank.execute();
  assert.deepStrictEqual(text(), ['a', '', 'b']);
  await blank.undo();
  assert.deepStrictEqual(text(), ['a', 'b']);
  await blank.execute();
  assert.deepStrictEqual(text(), ['a', '', 'b']);
});

test('pages of several files go in together and come out together', async () => {
  const { commands, target, text, makePdf } = await load(['a', 'b']);
  const insert = commands.insertPagesFromFiles(target, 1, [makePdf(['x', 'y']), makePdf(['z'])]);
  await insert.execute();
  assert.deepStrictEqual(text(), ['a', 'x', 'y', 'z', 'b']);
  assert.deepStrictEqual(insert.view.execute.select, [1, 2, 3]);
  await insert.undo();
  assert.deepStrictEqual(text(), ['a', 'b']);
  await insert.execute();
  assert.deepStrictEqual(text(), ['a', 'x', 'y', 'z', 'b']);
});

test('a bad file among the others leaves the document as it was', async () => {
  const { commands, target, text, makePdf } = await load(['a']);
  const insert = commands.insertPagesFromFiles(target, 1, [makePdf(['x']), new Uint8Array([1, 2, 3, 4, 5])]);
  await assert.rejects(insert.execute(), /not a valid PDF/);
  assert.deepStrictEqual(text(), ['a']);
});

test('several pages turn together and turn back', async () => {
  const { rotate, target, engine } = await load(['a', 'b', 'c']);
  const turn = rotate.rotatePages(target, [0, 2], 90);
  await turn.execute();
  assert.deepStrictEqual([...engine.pageSizes(target.docId)], [400, 300, 300, 400, 400, 300]);
  await turn.undo();
  assert.deepStrictEqual([...engine.pageSizes(target.docId)], [300, 400, 300, 400, 300, 400]);
});
