const test = require('node:test');
const assert = require('node:assert');

const load = async () => {
  const mupdf = await import('../node_modules/mupdf/dist/mupdf.js');
  const { createEngine } = await import('../pdf-engine/engine.js');
  const { makePdf } = await import('./fixtures/make-pdf.mjs');
  return { mupdf, engine: createEngine(), makePdf };
};

// A line's middle band, across its thin side: whole line boxes overlap the lines next to them.
const band = ({ x, y, w, h }) => (w < h ? { x: x + w / 4, y, w: w / 2, h } : { x, y: y + h / 4, w, h: h / 2 });

const texts = (engine, id, index = 0) => engine.getText(id, index).map((line) => line.text.trim());

// Every stream in a saved file, uncompressed, so removed text can be looked for.
function allStreams(mupdf, bytes) {
  const doc = mupdf.Document.openDocument(bytes, 'application/pdf');
  let out = '';
  for (let num = 1; num < doc.countObjects(); num++) {
    const obj = doc.newIndirect(num);
    if (obj.isStream()) out += obj.readStream().asString();
  }
  return out;
}

// A page filled with one grey picture, 300 x 400 points.
function makeImagePdf(mupdf) {
  const doc = new mupdf.PDFDocument();
  const pixmap = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, 30, 40], false);
  pixmap.clear(128);
  const resources = doc.newDictionary();
  const images = doc.newDictionary();
  images.put('Im1', doc.addImage(new mupdf.Image(pixmap)));
  resources.put('XObject', images);
  doc.insertPage(-1, doc.addPage([0, 0, 300, 400], 0, resources, 'q 300 0 0 400 0 0 cm /Im1 Do Q'));
  return doc.saveToBuffer('').asUint8Array();
}

// The rendered page at a point, as [r, g, b, a]. Where nothing is drawn it is see-through.
function pixelAt(engine, id, x, y) {
  const { width, pixels } = engine.renderPage(id, 0, 1);
  const at = (y * width + x) * 4;
  return [...pixels.slice(at, at + 4)];
}
const colorAt = (engine, id, x, y) => pixelAt(engine, id, x, y).slice(0, 3);

test('a redaction removes the text under it and keeps the rest', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['Secret line\nKept line']));
  engine.redact(id, 0, { rects: [{ x: 15, y: 30, w: 200, h: 22 }], box: true });
  assert.deepStrictEqual(texts(engine, id), ['Kept line']);
  assert.strictEqual(engine.listAnnotations(id, 0).length, 0);
});

test('undo brings the text back and redo removes it again', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['Secret line\nKept line']));
  const key = engine.redact(id, 0, { rects: [{ x: 15, y: 30, w: 200, h: 22 }], box: false });
  engine.swapRedaction(id, key, 'before');
  assert.deepStrictEqual(texts(engine, id), ['Secret line', 'Kept line']);
  engine.swapRedaction(id, key, 'after');
  assert.deepStrictEqual(texts(engine, id), ['Kept line']);
});

test('several areas are one redaction', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['One\nTwo\nThree']));
  const [one, , three] = engine.getText(id, 0);
  const key = engine.redact(id, 0, { rects: [one, three].map(band), box: true });
  assert.deepStrictEqual(texts(engine, id), ['Two']);
  engine.swapRedaction(id, key, 'before');
  assert.deepStrictEqual(texts(engine, id), ['One', 'Two', 'Three']);
});

test('the black box is drawn only when asked for', async () => {
  const { engine, makePdf } = await load();
  const rects = [{ x: 15, y: 30, w: 200, h: 22 }];
  const plain = engine.openDocument(makePdf(['Secret line'])).id;
  engine.redact(plain, 0, { rects, box: false });
  assert.strictEqual(pixelAt(engine, plain, 100, 40)[3], 0);
  const boxed = engine.openDocument(makePdf(['Secret line'])).id;
  engine.redact(boxed, 0, { rects, box: true });
  assert.deepStrictEqual(pixelAt(engine, boxed, 100, 40), [0, 0, 0, 255]);
});

test('the saved file no longer holds the removed text', async () => {
  const { mupdf, engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['Secret line\nKept line']));
  engine.redact(id, 0, { rects: [{ x: 15, y: 30, w: 200, h: 22 }], box: true });
  const saved = allStreams(mupdf, engine.save(id));
  assert.ok(!saved.includes('Secret'));
  assert.ok(saved.includes('Kept'));
});

test('a picture loses only the covered pixels, and undo restores them', async () => {
  const { mupdf, engine } = await load();
  const { id } = engine.openDocument(makeImagePdf(mupdf));
  const key = engine.redact(id, 0, { rects: [{ x: 100, y: 100, w: 100, h: 100 }], box: false });
  assert.notDeepStrictEqual(colorAt(engine, id, 150, 150), [128, 128, 128]);
  assert.deepStrictEqual(colorAt(engine, id, 20, 20), [128, 128, 128]);
  engine.swapRedaction(id, key, 'before');
  assert.deepStrictEqual(colorAt(engine, id, 150, 150), [128, 128, 128]);
});

test('redaction works on a turned page, in the page as displayed', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf([{ text: 'Secret line\nKept line', rotate: 90 }]));
  const [first] = engine.getText(id, 0);
  engine.redact(id, 0, { rects: [band(first)], box: true });
  assert.deepStrictEqual(texts(engine, id), ['Kept line']);
});
