const test = require('node:test');
const assert = require('node:assert');

const load = async () => {
  const mupdf = await import('../node_modules/mupdf/dist/mupdf.js');
  const { createEngine } = await import('../pdf-engine/engine.js');
  const { makePdf } = await import('./fixtures/make-pdf.mjs');
  const commands = await import('../renderer/commands/signature.js');
  const engine = createEngine();
  const { id: docId } = engine.openDocument(makePdf(['hi']));
  const pixmap = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, 4, 4], true);
  pixmap.getPixels().fill(255);
  const png = pixmap.asPNG();
  // The engine's calls are synchronous; the app's client answers with promises.
  const wrapped = Object.fromEntries(['addSignature', 'moveSignature', 'removeSignature', 'listSignatures', 'signaturePicture']
    .map((name) => [name, async (...args) => engine[name](...args)]));
  const target = { engine: wrapped, docId };
  const placement = { index: 0, png, rect: { x: 10, y: 10, w: 40, h: 20 }, key: null };
  const shown = () => engine.listSignatures(docId, 0).map(({ x, y, w, h }) => ({ x, y, w, h }));
  return { commands, target, placement, shown };
};

test('placing, moving and deleting a signature can each be undone and redone', async () => {
  const { commands, target, placement, shown } = await load();
  const place = commands.placeSignature(target, placement);
  await place.execute();
  assert.deepStrictEqual(shown(), [{ x: 10, y: 10, w: 40, h: 20 }]);

  const to = { x: 100, y: 50, w: 80, h: 40 };
  const move = commands.moveSignature(target, placement, to);
  await move.execute();
  assert.deepStrictEqual(shown(), [to]);
  await move.undo();
  assert.deepStrictEqual(shown(), [{ x: 10, y: 10, w: 40, h: 20 }]);
  await move.execute();

  const remove = commands.removeSignature(target, placement);
  await remove.execute();
  assert.deepStrictEqual(shown(), []);
  await remove.undo();
  assert.deepStrictEqual(shown(), [to], 'comes back where it was, even though its key is new');

  await move.undo();
  await place.undo();
  assert.deepStrictEqual(shown(), []);
  await place.execute();
  assert.strictEqual(shown().length, 1);
});

test('a signature that came from a file can be deleted, changed and restored', async () => {
  const { commands, target, placement, shown } = await load();
  await commands.placeSignature(target, placement).execute();
  // As if the file had been reopened: Folio knows only where it is and what it is called.
  const fromFile = { index: 0, png: null, rect: placement.rect, key: placement.key };

  const remove = commands.removeSignature(target, fromFile);
  await remove.execute();
  assert.deepStrictEqual(shown(), []);
  await remove.undo();
  assert.strictEqual(shown().length, 1);

  const other = { png: placement.png, rect: { x: 50, y: 60, w: 20, h: 40 } };
  const change = commands.changeSignature(target, fromFile, other);
  await change.execute();
  assert.deepStrictEqual(shown(), [other.rect]);
  await change.undo();
  assert.deepStrictEqual(shown(), [{ x: 10, y: 10, w: 40, h: 20 }]);
  await change.execute();
  assert.deepStrictEqual(shown(), [other.rect]);
});
