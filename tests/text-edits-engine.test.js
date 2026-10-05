const test = require('node:test');
const assert = require('node:assert');

const load = async () => {
  const mupdf = await import('../node_modules/mupdf/dist/mupdf.js');
  const { createEngine } = await import('../pdf-engine/engine.js');
  const { makePdf } = await import('./fixtures/make-pdf.mjs');
  return { mupdf, engine: createEngine(), makePdf };
};

const texts = (engine, id, index = 0) => engine.getText(id, index).map((line) => line.text.trim());

// Replaces the line under the point with new text in the same style.
function edit(engine, id, point, text, index = 0) {
  const line = engine.textLineAt(id, index, point);
  return engine.replaceText(id, index, { ...line, text });
}

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

test('a line is found under a point, with its style', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['Hello world\nSecond line']));
  const line = engine.textLineAt(id, 0, { x: 40, y: 45 });
  assert.strictEqual(line.text, 'Hello world');
  assert.strictEqual(line.size, 18);
  assert.deepStrictEqual(line.color, [0, 0, 0]);
  assert.strictEqual(line.font.family, 'sans');
  assert.strictEqual(line.standard, true);
  assert.strictEqual(line.straight, true);
  assert.deepStrictEqual(line.origin, { x: 20, y: 50 });
  assert.strictEqual(engine.textLineAt(id, 0, { x: 250, y: 350 }), null);
});

test('spaces around a line are left out of what the editor gets', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['  6/2/2025  ']));
  const line = engine.textLineAt(id, 0, { x: 60, y: 45 });
  assert.strictEqual(line.text, '6/2/2025');
  assert.ok(line.origin.x > 25);
});

test('editing a line replaces it in place and leaves the next line alone', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['Hello world\nSecond line']));
  const { font } = edit(engine, id, { x: 40, y: 45 }, 'Goodbye world');
  assert.deepStrictEqual(font, { name: 'Helvetica', kind: 'standard' });
  assert.deepStrictEqual(texts(engine, id), ['Goodbye world', 'Second line']);
  const line = engine.textLineAt(id, 0, { x: 40, y: 45 });
  assert.deepStrictEqual(line.origin, { x: 20, y: 50 });
});

test('the removed text is gone from the saved file, not covered', async () => {
  const { mupdf, engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['Secret plan\nSecond line']));
  edit(engine, id, { x: 40, y: 45 }, 'Public plan');
  const saved = engine.save(id);
  const streams = allStreams(mupdf, saved);
  assert.ok(!streams.includes('Secret'));
  assert.ok(streams.includes('Second line'));
  const reopened = engine.openDocument(saved.slice());
  assert.deepStrictEqual(texts(engine, reopened.id), ['Public plan', 'Second line']);
});

test('undo and redo swap the text, and several edits undo in order', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['Hello world\nSecond line']));
  const first = edit(engine, id, { x: 40, y: 45 }, 'One');
  const second = edit(engine, id, { x: 30, y: 45 }, 'Two');
  assert.deepStrictEqual(texts(engine, id), ['Two', 'Second line']);
  engine.swapText(id, second.key, 'before');
  assert.deepStrictEqual(texts(engine, id), ['One', 'Second line']);
  engine.swapText(id, first.key, 'before');
  assert.deepStrictEqual(texts(engine, id), ['Hello world', 'Second line']);
  engine.swapText(id, first.key, 'after');
  engine.swapText(id, second.key, 'after');
  assert.deepStrictEqual(texts(engine, id), ['Two', 'Second line']);
});

test('undoing after a save still works, and the next save has the old text', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['Hello world\nSecond line']));
  const change = edit(engine, id, { x: 40, y: 45 }, 'Changed');
  engine.save(id);
  engine.swapText(id, change.key, 'before');
  const reopened = engine.openDocument(engine.save(id).slice());
  assert.deepStrictEqual(texts(engine, reopened.id), ['Hello world', 'Second line']);
  engine.swapText(id, change.key, 'after');
  edit(engine, id, { x: 30, y: 72 }, 'Again');
  const again = engine.openDocument(engine.save(id).slice());
  assert.deepStrictEqual(texts(engine, again.id), ['Changed', 'Again']);
});

test('an edit on a cropped page lands where the old line was', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf([{ text: 'Cropped page', crop: [10, 20, 290, 380] }]));
  const [old] = engine.getText(id, 0);
  edit(engine, id, { x: old.x + 5, y: old.y + old.h / 2 }, 'Edited');
  const [now] = engine.getText(id, 0);
  assert.strictEqual(now.text.trim(), 'Edited');
  assert.ok(Math.abs(now.x - old.x) < 0.5 && Math.abs(now.y - old.y) < 1);
});

test('text added to a turned page reads level on screen', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf([{ text: 'Turned page', rotate: 90 }]));
  const style = { size: 12, font: { family: 'sans' }, color: [0, 0, 0] };
  engine.replaceText(id, 0, { ...style, area: null, text: 'Level', origin: { x: 100, y: 150 } });
  const line = engine.textLineAt(id, 0, { x: 105, y: 146 });
  assert.strictEqual(line.text, 'Level');
  assert.strictEqual(line.straight, true);
  assert.ok(Math.abs(line.origin.x - 100) < 0.01 && Math.abs(line.origin.y - 150) < 0.01);
  // A line that runs down the screen is not one the editor can take.
  assert.strictEqual(engine.textLineAt(id, 0, engine.getText(id, 0)[0]).straight, false);
});

test('text outside WinAnsi embeds the font; characters no standard font has are refused', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['Hello world']));
  edit(engine, id, { x: 40, y: 45 }, 'Ωmega Ćao');
  assert.deepStrictEqual(texts(engine, id), ['Ωmega Ćao']);
  assert.throws(() => edit(engine, id, { x: 40, y: 45 }, 'Tick ✓'), /can't show these characters: ✓/);
  assert.deepStrictEqual(texts(engine, id), ['Ωmega Ćao']);
});

test('new text can be added anywhere, on several lines, in a chosen style', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['Hello world']));
  const { font } = engine.replaceText(id, 0, {
    area: null, text: 'First\nSecond', origin: { x: 50, y: 200 }, size: 10,
    font: { family: 'serif', bold: true, italic: false }, color: [1, 0, 0],
  });
  assert.deepStrictEqual(font, { name: 'Times-Bold', kind: 'standard' });
  assert.deepStrictEqual(texts(engine, id), ['Hello world', 'First', 'Second']);
  const added = engine.textLineAt(id, 0, { x: 55, y: 196 });
  assert.deepStrictEqual(added.color, [1, 0, 0]);
  assert.strictEqual(added.font.family, 'serif');
  assert.strictEqual(added.font.bold, true);
});

test('emptying a line deletes it', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['Hello world\nSecond line']));
  const { font } = edit(engine, id, { x: 40, y: 45 }, '  ');
  assert.strictEqual(font, null);
  assert.deepStrictEqual(texts(engine, id), ['Second line']);
});

test('signatures on the page survive a text edit', async () => {
  const { mupdf, engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['Hello world']));
  const png = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, 4, 4], true).asPNG();
  engine.addSignature(id, 0, png, { x: 20, y: 30, w: 100, h: 30 });
  edit(engine, id, { x: 40, y: 45 }, 'Signed');
  assert.strictEqual(engine.listSignatures(id, 0).length, 1);
});

// The fonts a saved file holds, by the names they have in it.
function fontNames(mupdf, bytes) {
  const doc = mupdf.Document.openDocument(bytes, 'application/pdf');
  const names = [];
  for (let num = 1; num < doc.countObjects(); num++) {
    const obj = doc.newIndirect(num);
    if (obj.isDictionary() && obj.get('Type').asName() === 'Font' && obj.get('Subtype').asName() !== 'CIDFontType0' && obj.get('Subtype').asName() !== 'CIDFontType2') {
      names.push(obj.get('BaseFont').asName());
    }
  }
  return names;
}

const fixtures = () => import('./fixtures/make-pdf.mjs');

test('an edit that uses only letters the file has keeps its own font', async () => {
  const { mupdf, engine } = await load();
  const { makeSubsetPdf } = await fixtures();
  const { id } = engine.openDocument(makeSubsetPdf('Dear Mr Brown,'));
  const line = engine.textLineAt(id, 0, { x: 40, y: 45 });
  assert.match(line.font.id, /^[A-Z]{6}\+/);
  const { font } = engine.replaceText(id, 0, { ...line, text: 'Dear Mr Bown,', reuse: [line.font.id] });
  assert.strictEqual(font.kind, 'file');
  assert.deepStrictEqual(texts(engine, id), ['Dear Mr Bown,']);
  assert.deepStrictEqual(fontNames(mupdf, engine.save(id)), [line.font.id]);
});

test('a space the subset lacks becomes a gap, and still reads as a space', async () => {
  const { engine } = await load();
  const { makeSubsetPdf } = await fixtures();
  const { id } = engine.openDocument(makeSubsetPdf('Total'));
  const line = engine.textLineAt(id, 0, { x: 30, y: 45 });
  const { font } = engine.replaceText(id, 0, { ...line, text: 'To lo', reuse: [line.font.id] });
  assert.strictEqual(font.kind, 'file');
  assert.deepStrictEqual(texts(engine, id), ['To lo']);
});

test('a letter the subset lacks uses the installed font, cut down on Save', async () => {
  const { mupdf, engine } = await load();
  const { makeSubsetPdf, fontFile } = await fixtures();
  const { id } = engine.openDocument(makeSubsetPdf('Dear Mr Brown,'));
  const line = engine.textLineAt(id, 0, { x: 40, y: 45 });
  const bytes = fontFile('Times-Roman');
  const installed = { key: 'times', family: 'Times', bytes, index: 0 };
  const { font } = engine.replaceText(id, 0, { ...line, text: 'Dear Ms Green,', reuse: [line.font.id], installed });
  assert.strictEqual(font.kind, 'installed');
  assert.deepStrictEqual(texts(engine, id), ['Dear Ms Green,']);
  const saved = engine.save(id);
  assert.ok(saved.length < bytes.length / 2, `saved ${saved.length} bytes, font is ${bytes.length}`);
  const again = engine.openDocument(saved).id;
  assert.deepStrictEqual(texts(engine, again), ['Dear Ms Green,']);
});

test('with neither font usable the closest standard font is used', async () => {
  const { engine } = await load();
  const { makeSubsetPdf } = await fixtures();
  const { id } = engine.openDocument(makeSubsetPdf('Dear Mr Brown,'));
  const line = engine.textLineAt(id, 0, { x: 40, y: 45 });
  const { font } = engine.replaceText(id, 0, { ...line, text: 'Dear Ms Green,', reuse: [line.font.id] });
  assert.deepStrictEqual(font, { name: 'Times-Roman', kind: 'standard' });
  assert.deepStrictEqual(texts(engine, id), ['Dear Ms Green,']);
});

test('the fonts a document uses are listed, without the standard ones', async () => {
  const { engine, makePdf } = await load();
  const { makeSubsetPdf } = await fixtures();
  const { id } = engine.openDocument(makeSubsetPdf('Dear Mr Brown,'));
  const fonts = engine.documentFonts(id);
  assert.strictEqual(fonts.length, 1);
  assert.match(fonts[0].id, /^[A-Z]{6}\+/);
  assert.strictEqual(fonts[0].family, 'serif');
  assert.deepStrictEqual(engine.documentFonts(engine.openDocument(makePdf(['Hi'])).id), []);
});
