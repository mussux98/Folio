const test = require('node:test');
const assert = require('node:assert');

const load = async () => {
  const { createEngine } = await import('../pdf-engine/engine.js');
  const { makePdf, makeImagePdf } = await import('./fixtures/make-pdf.mjs');
  const mupdf = await import('../node_modules/mupdf/dist/mupdf.js');
  return { engine: createEngine(), makePdf, makeImagePdf, mupdf };
};

const texts = (engine, id) => engine.getText(id, 0).map((line) => line.text.trim());

// The picture on the first page of saved bytes, as the file stores it.
function picture(mupdf, bytes, password) {
  const doc = mupdf.Document.openDocument(bytes, 'application/pdf').asPDF();
  if (password) doc.authenticatePassword(password);
  const ref = doc.findPage(0).get('Resources').get('XObject').get('Im0');
  return {
    filter: ref.get('Filter').toString(),
    width: ref.get('Width').asNumber(),
    height: ref.get('Height').asNumber(),
    bits: ref.get('BitsPerComponent').asNumber(),
    space: ref.get('ColorSpace').toString(),
    softMask: ref.get('SMask').isStream(),
  };
}

test('a large picture is scaled to the quality and stored as JPEG', async () => {
  const { engine, makeImagePdf, mupdf } = await load();
  // 1200 × 1500 pixels shown at 4 × 5 inches: 300 dpi.
  const { id } = engine.openDocument(makeImagePdf(1200, 1500, [288, 360], { text: 'Caption' }));
  const { before, bytes } = engine.saveSmaller(id, 'medium');
  assert.strictEqual(before, engine.save(id).length);
  assert.ok(bytes.length < before / 4, `${bytes.length} of ${before}`);
  assert.deepStrictEqual(picture(mupdf, bytes), {
    filter: '/DCTDecode', width: 600, height: 750, bits: 8, space: '/DeviceRGB', softMask: false,
  });
  const again = engine.openDocument(bytes);
  assert.deepStrictEqual(texts(engine, again.id), ['Caption']);
  const page = engine.renderPage(again.id, 0, 0.5);
  assert.ok(page.width > 0 && page.pixels.length > 0);
});

test('lower quality gives a smaller file', async () => {
  const { engine, makeImagePdf } = await load();
  const { id } = engine.openDocument(makeImagePdf(1200, 1500, [288, 360]));
  const [high, medium, low] = ['high', 'medium', 'low'].map((q) => engine.saveSmaller(id, q).bytes.length);
  assert.ok(high > medium && medium > low, `${high} ${medium} ${low}`);
});

test('a picture already small enough keeps its size, and grey stays grey', async () => {
  const { engine, makeImagePdf, mupdf } = await load();
  // 400 × 500 pixels at 4 × 5 inches is 100 dpi, under the 150 asked for.
  const { id } = engine.openDocument(makeImagePdf(400, 500, [288, 360], { gray: true }));
  const shown = picture(mupdf, engine.saveSmaller(id, 'medium').bytes);
  assert.deepStrictEqual([shown.width, shown.height, shown.space], [400, 500, '/DeviceGray']);
});

test('a soft mask is kept and black-and-white pictures are left alone', async () => {
  const { engine, makeImagePdf, mupdf } = await load();
  const masked = engine.openDocument(makeImagePdf(1200, 1500, [288, 360], { softMask: true }));
  const withMask = picture(mupdf, engine.saveSmaller(masked.id, 'medium').bytes);
  assert.strictEqual(withMask.filter, '/DCTDecode');
  assert.strictEqual(withMask.softMask, true);

  const bilevel = engine.openDocument(makeImagePdf(1200, 1500, [288, 360], { bits: 1 }));
  const kept = picture(mupdf, engine.saveSmaller(bilevel.id, 'low').bytes);
  assert.deepStrictEqual([kept.width, kept.bits], [1200, 1]);
  assert.notStrictEqual(kept.filter, '/DCTDecode');
});

test('a protected file keeps its password', async () => {
  const { engine, makeImagePdf, mupdf } = await load();
  const { id } = engine.openDocument(makeImagePdf(1200, 1500, [288, 360], { password: 'pw', text: 'Secret' }));
  engine.authenticate(id, 'pw');
  const { bytes } = engine.saveSmaller(id, 'medium');
  assert.strictEqual(engine.openDocument(bytes).locked, true);
  const again = engine.authenticate(engine.openDocument(bytes).id, 'pw');
  assert.strictEqual(again.locked, false);
  assert.deepStrictEqual(texts(engine, again.id), ['Secret']);
  assert.strictEqual(picture(mupdf, bytes, 'pw').filter, '/DCTDecode');
});

test('the open document is not changed', async () => {
  const { engine, makeImagePdf, mupdf } = await load();
  const { id } = engine.openDocument(makeImagePdf(1200, 1500, [288, 360]));
  const before = engine.save(id);
  engine.saveSmaller(id, 'low');
  const after = engine.save(id);
  assert.strictEqual(after.length, before.length);
  assert.strictEqual(picture(mupdf, after).width, 1200);
});

test('a file with only text still saves, and a made-up quality is refused', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['One', 'Two']));
  const { bytes } = engine.saveSmaller(id, 'high');
  assert.deepStrictEqual(texts(engine, engine.openDocument(bytes).id), ['One']);
  assert.throws(() => engine.saveSmaller(id, 'tiny'), /Unknown quality/);
});
