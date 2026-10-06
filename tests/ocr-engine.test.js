const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const LANGUAGES = path.join(__dirname, '..', 'pdf-engine', 'ocr-languages');

const load = async () => {
  const { createEngine } = await import('../pdf-engine/engine.js');
  const { makePdf, makeScannedPdf } = await import('./fixtures/make-pdf.mjs');
  return { engine: createEngine(), makePdf, makeScannedPdf };
};

const texts = (engine, id, index = 0) => engine.getText(id, index).map((line) => line.text.trim());

// Two words on one baseline, as OCR would give them.
const WORDS = [
  { text: 'Hello', x: 20, y: 60, w: 50, size: 16 },
  { text: 'señor', x: 80, y: 60, w: 50, size: 16 },
];

// Tesseract in Node, the same way the app runs it in the window.
async function recognise(png, scale, languages = 'eng') {
  const Tesseract = require('tesseract.js');
  const { wordsFrom } = await import('../pdf-engine/ocr-words.js');
  const worker = await Tesseract.createWorker(languages, Tesseract.OEM.LSTM_ONLY, { langPath: LANGUAGES, cacheMethod: 'none' });
  try {
    const { data } = await worker.recognize(Buffer.from(png), {}, { text: false, blocks: true });
    return wordsFrom(data.blocks, scale);
  } finally {
    await worker.terminate();
  }
}

test('only pages without text are taken for scanned', async () => {
  const { engine, makePdf, makeScannedPdf } = await load();
  const scanned = engine.openDocument(makeScannedPdf('Scanned'));
  assert.deepStrictEqual(engine.pagesWithoutText(scanned.id, [0]), [0]);
  const typed = engine.openDocument(makePdf(['Typed', 'Also typed']));
  assert.deepStrictEqual(engine.pagesWithoutText(typed.id, [0, 1]), []);
  const mixed = engine.openDocument(makeScannedPdf('Scanned', { text: 'A caption' }));
  assert.deepStrictEqual(engine.pagesWithoutText(mixed.id, [0]), []);
});

test('the page picture is a PNG at the asked dpi', async () => {
  const { engine, makeScannedPdf } = await load();
  const { id } = engine.openDocument(makeScannedPdf('Scanned'));
  const { png, scale } = engine.ocrPicture(id, 0, 144);
  assert.deepStrictEqual([...png.slice(1, 4)], [...Buffer.from('PNG')]);
  assert.strictEqual(scale, 2);
});

test('words go on the page as text that can be found, and come off on undo', async () => {
  const { engine, makeScannedPdf } = await load();
  const { id } = engine.openDocument(makeScannedPdf('Scanned'));
  const before = engine.renderPage(id, 0, 1).pixels;
  const key = engine.addOcrText(id, 0, WORDS);

  assert.deepStrictEqual(texts(engine, id), ['Hello señor']);
  const [hit] = engine.searchPage(id, 0, 'hello');
  assert.ok(Math.abs(hit.rects[0].x - 20) < 1, `starts at ${hit.rects[0].x}`);
  assert.ok(Math.abs(hit.rects[0].w - 50) < 1, `is ${hit.rects[0].w} wide`);
  // Invisible: the page looks exactly as it did.
  assert.deepStrictEqual(engine.renderPage(id, 0, 1).pixels, before);

  engine.swapOcrText(id, key, 'before');
  assert.deepStrictEqual(texts(engine, id), []);
  engine.swapOcrText(id, key, 'after');
  assert.deepStrictEqual(texts(engine, id), ['Hello señor']);
});

test('the text is kept in the saved file', async () => {
  const { engine, makeScannedPdf } = await load();
  const { id } = engine.openDocument(makeScannedPdf('Scanned'));
  engine.addOcrText(id, 0, WORDS);
  const reopened = engine.openDocument(engine.save(id));
  assert.deepStrictEqual(texts(engine, reopened.id), ['Hello señor']);
  assert.strictEqual(engine.searchPage(reopened.id, 0, 'senor').length, 1);
});

test('on a turned page the words land where they show', async () => {
  const { engine, makeScannedPdf } = await load();
  const { id } = engine.openDocument(makeScannedPdf('Scanned', { rotate: 90 }));
  engine.addOcrText(id, 0, WORDS);
  const [line] = engine.getText(id, 0);
  assert.strictEqual(line.text.trim(), 'Hello señor');
  assert.ok(line.w > line.h, 'reads across the page as shown');
  assert.ok(Math.abs(line.x - 20) < 1 && Math.abs(line.y + line.h - 60) < 8, `at ${line.x}, ${line.y}`);
});

test('letters the font lacks are left out, and a page with none to write is not changed', async () => {
  const { engine, makeScannedPdf } = await load();
  const { id } = engine.openDocument(makeScannedPdf('Scanned'));
  assert.strictEqual(engine.addOcrText(id, 0, [{ text: '日本', x: 20, y: 60, w: 30, size: 12 }]), null);
  assert.deepStrictEqual(texts(engine, id), []);
  engine.addOcrText(id, 0, [{ text: 'a→b', x: 20, y: 60, w: 30, size: 12 }]);
  assert.deepStrictEqual(texts(engine, id), ['ab']);
});

test('Tesseract reads a scanned page in Spanish and English, accents kept, and the words line up', async () => {
  const { engine, makeScannedPdf } = await load();
  const { id } = engine.openDocument(makeScannedPdf('Hello scanned world\nSeñor niño está aquí'));
  const { png, scale } = engine.ocrPicture(id, 0, 300);
  const words = await recognise(png, scale, 'spa+eng');
  engine.addOcrText(id, 0, words);

  const lines = texts(engine, id);
  assert.strictEqual(lines[0], 'Hello scanned world');
  assert.match(lines[1], /^Señor niño está aqu/);
  assert.ok(engine.searchPage(id, 0, 'niño').length);
  // The source text starts 20 points in, its baseline 50 points down.
  const [hit] = engine.searchPage(id, 0, 'hello');
  assert.ok(Math.abs(hit.rects[0].x - 20) < 3, `starts at ${hit.rects[0].x}`);
  assert.ok(Math.abs(words[0].y - 50) < 2, `baseline at ${words[0].y}`);
});
