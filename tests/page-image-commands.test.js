const test = require('node:test');
const assert = require('node:assert');

// A page of 300 x 400 points with one red picture at (20, 120) page space, 60 x 30.
function makeFile(mupdf) {
  const doc = new mupdf.PDFDocument();
  const pixmap = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, 20, 10], false);
  const pixels = pixmap.getPixels();
  for (let i = 0; i < pixels.length; i += 3) pixels.set([255, 0, 0], i);
  const images = doc.newDictionary();
  images.put('Red', doc.addImage(new mupdf.Image(pixmap)));
  const resources = doc.newDictionary();
  resources.put('XObject', images);
  doc.insertPage(-1, doc.addPage([0, 0, 300, 400], 0, resources, 'q 60 0 0 30 20 250 cm /Red Do Q'));
  return doc.saveToBuffer('').asUint8Array();
}

const load = async () => {
  const mupdf = await import('../node_modules/mupdf/dist/mupdf.js');
  const { createEngine } = await import('../pdf-engine/engine.js');
  const commands = await import('../renderer/commands/page-image.js');
  const engine = createEngine();
  const { id: docId } = engine.openDocument(makeFile(mupdf));
  // The engine's calls are synchronous; the app's client answers with promises.
  const wrapped = Object.fromEntries(['deletePageImage', 'liftPageImage', 'swapRedaction', 'addSignature']
    .map((name) => [name, async (...args) => engine[name](...args)]));
  const pictures = () => engine.listPageImages(docId, 0).length;
  const stamps = () => engine.listSignatures(docId, 0).map(({ x, y, w, h }) => [x, y, w, h].map(Math.round));
  return { commands, target: { engine: wrapped, docId }, pictures, stamps };
};

test('deleting a picture can be undone and redone', async () => {
  const { commands, target, pictures } = await load();
  const command = commands.deletePageImage(target, 0, 0);
  await command.execute();
  assert.strictEqual(pictures(), 0);
  await command.undo();
  assert.strictEqual(pictures(), 1);
  await command.execute();
  assert.strictEqual(pictures(), 0);
});

test('a lifted picture becomes a stamp where it was dropped, and undo puts it back in the page', async () => {
  const { commands, target, pictures, stamps } = await load();
  const command = commands.liftPageImage(target, 0, 0, { x: 100, y: 200, w: 120, h: 60 });
  await command.execute();
  assert.strictEqual(pictures(), 0);
  assert.deepStrictEqual(stamps(), [[100, 200, 120, 60]]);
  await command.undo();
  assert.strictEqual(pictures(), 1);
  assert.deepStrictEqual(stamps(), []);
  await command.execute();
  assert.strictEqual(pictures(), 0);
  assert.deepStrictEqual(stamps(), [[100, 200, 120, 60]]);
  await command.undo();
  await command.execute();
  assert.deepStrictEqual(stamps(), [[100, 200, 120, 60]]);
});
