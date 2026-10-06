const test = require('node:test');
const assert = require('node:assert');

const load = async () => {
  const mupdf = await import('../node_modules/mupdf/dist/mupdf.js');
  const { createEngine } = await import('../pdf-engine/engine.js');
  return { mupdf, engine: createEngine() };
};

function solid(mupdf, doc, [r, g, b], smask) {
  const pixmap = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, 20, 10], false);
  const pixels = pixmap.getPixels();
  for (let i = 0; i < pixels.length; i += 3) pixels.set([r, g, b], i);
  const ref = doc.addImage(new mupdf.Image(pixmap));
  if (smask) {
    const mask = new mupdf.Pixmap(mupdf.ColorSpace.DeviceGray, [0, 0, 20, 10], false);
    mask.clear(128);
    ref.put('SMask', doc.addImage(new mupdf.Image(mask)));
  }
  return ref;
}

// Pages of 300 x 400 points sharing one set of resources:
//   page 1: red at (20, 120) 60 x 30 page space, see-through blue at (150, 120),
//           green inside a form at (20, 310) 80 x 40, a full-page grey scan
//           behind it all, and a line of text over the red one;
//   page 2: the same red one (a logo on every page);
//   page 3: drawn by a form: red, yellow overlapping it, and red again on its own;
//   page 4: red on a page turned 90 degrees;
//   page 5: red once, drawn by a form although the page names it too.
function makeFile(mupdf) {
  const doc = new mupdf.PDFDocument();
  const fonts = doc.newDictionary();
  fonts.put('F1', doc.addSimpleFont(new mupdf.Font('Helvetica')));
  const images = doc.newDictionary();
  images.put('Red', solid(mupdf, doc, [255, 0, 0]));
  images.put('Blue', solid(mupdf, doc, [0, 0, 255], true));
  images.put('Scan', solid(mupdf, doc, [200, 200, 200]));
  const inner = doc.newDictionary();
  const innerImages = doc.newDictionary();
  innerImages.put('Green', solid(mupdf, doc, [0, 255, 0]));
  innerImages.put('Yellow', solid(mupdf, doc, [255, 255, 0]));
  innerImages.put('Red', images.get('Red'));
  inner.put('XObject', innerImages);
  images.put('F1', doc.addStream('q 80 0 0 40 20 50 cm /Green Do Q', { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, 300, 400], Resources: inner }));
  images.put('F2', doc.addStream('q 60 0 0 30 20 250 cm /Red Do Q q 60 0 0 30 50 260 cm /Yellow Do Q q 60 0 0 30 200 50 cm /Red Do Q',
    { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, 300, 400], Resources: inner }));
  images.put('F3', doc.addStream('q 60 0 0 30 20 250 cm /Red Do Q', { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, 300, 400], Resources: inner }));
  const resources = doc.newDictionary();
  resources.put('Font', fonts);
  resources.put('XObject', images);
  const red = 'q 60 0 0 30 20 250 cm /Red Do Q';
  doc.insertPage(-1, doc.addPage([0, 0, 300, 400], 0, resources,
    `q 300 0 0 400 0 0 cm /Scan Do Q ${red} q 60 0 0 30 150 250 cm /Blue Do Q /F1 Do BT /F1 12 Tf 22 265 Td (Over red) Tj ET`));
  doc.insertPage(-1, doc.addPage([0, 0, 300, 400], 0, resources, red));
  doc.insertPage(-1, doc.addPage([0, 0, 300, 400], 0, resources, '/F2 Do'));
  doc.insertPage(-1, doc.addPage([0, 0, 300, 400], 90, resources, red));
  doc.insertPage(-1, doc.addPage([0, 0, 300, 400], 0, resources, '/F3 Do'));
  return doc.saveToBuffer('').asUint8Array();
}

const round = ({ x, y, w, h }) => [x, y, w, h].map(Math.round);
const boxes = (engine, id, index = 0) => engine.listPageImages(id, index).map(round);

function colorAt(engine, id, index, x, y) {
  const { width, pixels } = engine.renderPage(id, index, 1);
  const at = (y * width + x) * 4;
  return [...pixels.slice(at, at + 3)];
}

const RED = [255, 0, 0];

test('the pictures of a page are listed, a full-page scan left out', async () => {
  const { mupdf, engine } = await load();
  const { id } = engine.openDocument(makeFile(mupdf));
  assert.deepStrictEqual(boxes(engine, id), [[20, 120, 60, 30], [150, 120, 60, 30], [20, 310, 80, 40]]);
  assert.deepStrictEqual(engine.listPageImages(id, 0).map((p) => p.id), [1, 2, 3]);
});

test('deleting a picture leaves the text over it, and undo puts it back', async () => {
  const { mupdf, engine } = await load();
  const { id } = engine.openDocument(makeFile(mupdf));
  const key = engine.deletePageImage(id, 0, 1);
  assert.deepStrictEqual(boxes(engine, id), [[150, 120, 60, 30], [20, 310, 80, 40]]);
  assert.deepStrictEqual(engine.getText(id, 0).map((l) => l.text.trim()), ['Over red']);
  assert.notDeepStrictEqual(colorAt(engine, id, 0, 70, 140), RED);
  engine.swapRedaction(id, key, 'before');
  assert.deepStrictEqual(colorAt(engine, id, 0, 70, 140), RED);
  engine.swapRedaction(id, key, 'after');
  assert.strictEqual(engine.listPageImages(id, 0).length, 2);
});

test('a second picture can be deleted after the first', async () => {
  const { mupdf, engine } = await load();
  const { id } = engine.openDocument(makeFile(mupdf));
  engine.deletePageImage(id, 0, 1);
  engine.liftPageImage(id, 0, 1);
  assert.deepStrictEqual(boxes(engine, id), [[20, 310, 80, 40]]);
});

test('a logo deleted on one page stays on the others', async () => {
  const { mupdf, engine } = await load();
  const { id } = engine.openDocument(makeFile(mupdf));
  engine.deletePageImage(id, 0, 1);
  assert.deepStrictEqual(boxes(engine, id, 1), [[20, 120, 60, 30]]);
  assert.deepStrictEqual(colorAt(engine, id, 1, 50, 135), RED);
});

test('a picture inside a form is deleted and the scan behind it stays', async () => {
  const { mupdf, engine } = await load();
  const { id } = engine.openDocument(makeFile(mupdf));
  engine.deletePageImage(id, 0, 3);
  assert.deepStrictEqual(boxes(engine, id), [[20, 120, 60, 30], [150, 120, 60, 30]]);
  assert.deepStrictEqual(colorAt(engine, id, 0, 60, 330), [200, 200, 200]);
});

test('a picture drawn twice is cut out where it is, unless that takes another with it', async () => {
  const { mupdf, engine } = await load();
  const { id } = engine.openDocument(makeFile(mupdf));
  assert.throws(() => engine.deletePageImage(id, 2, 0), /overlaps another/);
  assert.strictEqual(engine.listPageImages(id, 2).length, 3);
  engine.deletePageImage(id, 2, 2);
  assert.deepStrictEqual(boxes(engine, id, 2), [[20, 120, 60, 30], [50, 110, 60, 30]]);
});

test('a picture the page names itself but draws through a form is deleted', async () => {
  const { mupdf, engine } = await load();
  const { id } = engine.openDocument(makeFile(mupdf));
  engine.deletePageImage(id, 4, 0);
  assert.deepStrictEqual(boxes(engine, id, 4), []);
  assert.strictEqual(engine.listPageImages(id, 2).length, 3);
  assert.strictEqual(engine.listPageImages(id, 1).length, 1);
});

test('lifting a picture gives its look and box, and takes it off the page', async () => {
  const { mupdf, engine } = await load();
  const { id } = engine.openDocument(makeFile(mupdf));
  const { key, png, rect } = engine.liftPageImage(id, 0, 2);
  assert.deepStrictEqual(round(rect), [150, 120, 60, 30]);
  const look = new mupdf.Image(png).toPixmap();
  assert.ok(look.getAlpha());
  // MuPDF reads it back with the colour multiplied by the transparency.
  const [r, g, b, a] = look.getPixels().slice(0, 4);
  assert.deepStrictEqual([r, g], [0, 0]);
  assert.ok(Math.abs(a - 128) <= 1 && Math.abs(b - a) <= 2, `blue ${b}, alpha ${a}`);
  assert.strictEqual(engine.listPageImages(id, 0).length, 2);
  engine.swapRedaction(id, key, 'before');
  assert.strictEqual(engine.listPageImages(id, 0).length, 3);
});

test('a lifted picture becomes a stamp that looks the same on a turned page', async () => {
  const { mupdf, engine } = await load();
  const { id } = engine.openDocument(makeFile(mupdf));
  assert.deepStrictEqual(boxes(engine, id, 3), [[250, 20, 30, 60]]);
  const { png, rect } = engine.liftPageImage(id, 3, 0);
  assert.notDeepStrictEqual(colorAt(engine, id, 3, 265, 50), RED);
  engine.addSignature(id, 3, png, rect);
  assert.deepStrictEqual(colorAt(engine, id, 3, 265, 50), RED);
  assert.strictEqual(engine.listSignatures(id, 3).length, 1);
});

test('a deleted picture is gone from the saved file', async () => {
  const { mupdf, engine } = await load();
  const { id } = engine.openDocument(makeFile(mupdf));
  engine.deletePageImage(id, 0, 1);
  const saved = engine.openDocument(engine.save(id)).id;
  assert.deepStrictEqual(boxes(engine, saved), [[150, 120, 60, 30], [20, 310, 80, 40]]);
  assert.deepStrictEqual(boxes(engine, saved, 1), [[20, 120, 60, 30]]);
});

test('an unknown picture is refused', async () => {
  const { mupdf, engine } = await load();
  const { id } = engine.openDocument(makeFile(mupdf));
  assert.throws(() => engine.deletePageImage(id, 0, 9), /no longer on the page/);
});
