const test = require('node:test');
const assert = require('node:assert');

const load = async () => {
  const mupdf = await import('../node_modules/mupdf/dist/mupdf.js');
  const { createEngine } = await import('../pdf-engine/engine.js');
  const { makePdf } = await import('./fixtures/make-pdf.mjs');
  return { mupdf, engine: createEngine(), makePdf };
};

// A 40x20 PNG: opaque red on the left half, fully transparent on the right.
function samplePng(mupdf) {
  const pixmap = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, 40, 20], true);
  const pixels = pixmap.getPixels();
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 40; x++) pixels.set(x < 20 ? [255, 0, 0, 255] : [0, 0, 0, 0], (y * 40 + x) * 4);
  }
  return pixmap.asPNG();
}

const alphaAt = (page, x, y) => page.pixels[(y * page.width + x) * 4 + 3];
const redAt = (page, x, y) => page.pixels[(y * page.width + x) * 4];

test('a signature is drawn where it was placed, and transparent parts stay clear', async () => {
  const { mupdf, engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['hi']));
  engine.addSignature(id, 0, samplePng(mupdf), { x: 100, y: 200, w: 80, h: 40 });
  const page = engine.renderPage(id, 0, 1);
  assert.strictEqual(redAt(page, 110, 220), 255);
  assert.strictEqual(alphaAt(page, 110, 220), 255);
  assert.strictEqual(alphaAt(page, 170, 220), 0, 'transparent half shows the page');
  assert.strictEqual(alphaAt(page, 50, 220), 0);
});

test('signatures can be listed, moved and removed', async () => {
  const { mupdf, engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['hi']));
  const key = engine.addSignature(id, 0, samplePng(mupdf), { x: 100, y: 200, w: 80, h: 40 });
  assert.deepStrictEqual(engine.listSignatures(id, 0), [{ key, x: 100, y: 200, w: 80, h: 40 }]);
  engine.moveSignature(id, 0, key, { x: 10, y: 20, w: 40, h: 20 });
  assert.deepStrictEqual(engine.listSignatures(id, 0), [{ key, x: 10, y: 20, w: 40, h: 20 }]);
  engine.removeSignature(id, 0, key);
  assert.deepStrictEqual(engine.listSignatures(id, 0), []);
  assert.throws(() => engine.removeSignature(id, 0, key), /no longer on the page/);
});

// The red half must stay on the left of the box however the page is turned,
// also after the signature has been moved.
for (const rotate of [0, 90, 180, 270]) {
  test(`the signature stays upright on a page turned ${rotate} degrees`, async () => {
    const { mupdf, engine, makePdf } = await load();
    const { id } = engine.openDocument(makePdf([{ text: 'hi', size: [300, 400], rotate }]));
    const rect = { x: 50, y: 30, w: 80, h: 40 };
    const key = engine.addSignature(id, 0, samplePng(mupdf), rect);
    engine.moveSignature(id, 0, key, rect);
    assert.deepStrictEqual(engine.listSignatures(id, 0), [{ key, ...rect }]);
    const page = engine.renderPage(id, 0, 1);
    assert.strictEqual(alphaAt(page, 60, 50), 255, 'left half is drawn');
    assert.strictEqual(alphaAt(page, 120, 50), 0, 'right half is clear');
  });
}

test('a signature survives saving and reopening', async () => {
  const { mupdf, engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['hi', 'two']));
  engine.addSignature(id, 1, samplePng(mupdf), { x: 100, y: 200, w: 80, h: 40 });
  const bytes = engine.save(id);
  const again = engine.openDocument(bytes).id;
  assert.strictEqual(engine.listSignatures(again, 1).length, 1);
  assert.strictEqual(engine.listSignatures(again, 0).length, 0);
  assert.strictEqual(redAt(engine.renderPage(again, 1, 1), 110, 220), 255);
  // A second save after more edits still produces a readable file.
  engine.addSignature(id, 0, samplePng(mupdf), { x: 10, y: 10, w: 40, h: 20 });
  assert.strictEqual(engine.openDocument(engine.save(id)).pageCount, 2);
});

test('a large signature picture is stored compressed', async () => {
  const { mupdf, engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['hi']));
  const pixmap = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, 800, 300], true);
  pixmap.getPixels().fill(0);
  engine.addSignature(id, 0, pixmap.asPNG(), { x: 10, y: 10, w: 160, h: 60 });
  assert.ok(engine.save(id).length < 50000, 'not stored as raw pixels');
});

test('a stamp from an earlier session can be listed and its picture read back', async () => {
  const { mupdf, engine, makePdf } = await load();
  const first = engine.openDocument(makePdf(['hi'])).id;
  engine.addSignature(first, 0, samplePng(mupdf), { x: 100, y: 200, w: 80, h: 40 });
  const { id } = engine.openDocument(engine.save(first));
  const [stamp] = engine.listSignatures(id, 0);
  assert.deepStrictEqual([stamp.x, stamp.y, stamp.w, stamp.h], [100, 200, 80, 40]);
  const back = new mupdf.Image(engine.signaturePicture(id, 0, stamp.key));
  const pixels = back.toPixmap().getPixels();
  assert.deepStrictEqual([back.getWidth(), back.getHeight()], [40, 20]);
  assert.strictEqual(pixels.length, 40 * 20 * 4, 'keeps the transparency');
  assert.strictEqual(pixels[3], 255);
  assert.strictEqual(pixels[39 * 4 + 3], 0);
  // It can be moved and deleted like one placed a moment ago.
  engine.moveSignature(id, 0, stamp.key, { x: 5, y: 5, w: 40, h: 20 });
  engine.removeSignature(id, 0, stamp.key);
  assert.deepStrictEqual(engine.listSignatures(id, 0), []);
});

test('annotations that are not pictures are left alone', async () => {
  const { mupdf, engine, makePdf } = await load();
  const doc = mupdf.Document.openDocument(makePdf(['hi']), 'application/pdf');
  const page = doc.loadPage(0);
  page.createAnnotation('Square').setRect([10, 10, 50, 50]);
  page.createAnnotation('Stamp').setRect([60, 60, 100, 100]);
  const { id } = engine.openDocument(doc.saveToBuffer('').asUint8Array());
  assert.deepStrictEqual(engine.listSignatures(id, 0), []);
});

test('a signature carries no note, colour or name that a reader could show as a comment', async () => {
  const { mupdf, engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['hi']));
  const key = engine.addSignature(id, 0, samplePng(mupdf), { x: 10, y: 10, w: 40, h: 20 });
  engine.moveSignature(id, 0, key, { x: 20, y: 20, w: 40, h: 20 });
  const doc = mupdf.Document.openDocument(engine.save(id), 'application/pdf');
  const [annot] = doc.loadPage(0).getAnnotations();
  const dict = annot.getObject();
  for (const name of ['Contents', 'C', 'Name']) assert.ok(dict.get(name).isNull(), name);
});
