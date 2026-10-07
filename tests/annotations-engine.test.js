const test = require('node:test');
const assert = require('node:assert');

const load = async () => {
  const { createEngine } = await import('../pdf-engine/engine.js');
  const { makePdf } = await import('./fixtures/make-pdf.mjs');
  return { engine: createEngine(), makePdf };
};

const pixelAt = (page, x, y) => [...page.pixels.slice((y * page.width + x) * 4, (y * page.width + x) * 4 + 4)];
const near = (a, b) => Math.abs(a - b) <= 2;
const spec = { type: 'Highlight', rects: [{ x: 100, y: 50, w: 100, h: 20 }], color: [1, 0.75, 0] };

test('a highlight is drawn where it was placed and listed back in page space', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['hi']));
  const key = engine.addAnnotation(id, 0, spec);
  const page = engine.renderPage(id, 0, 1);
  const [r, g, b, a] = pixelAt(page, 150, 60);
  assert.ok(near(r, 255) && near(g, 191) && near(b, 0) && a === 255);
  assert.strictEqual(pixelAt(page, 150, 100)[3], 0, 'nothing is drawn outside it');
  assert.strictEqual(pixelAt(page, 98, 60)[3], 0, 'the ends are square, not rounded past the text');
  assert.strictEqual(pixelAt(page, 100, 60)[3], 255);
  assert.deepStrictEqual(engine.listAnnotations(id, 0), [{ key, type: 'Highlight', rects: spec.rects, color: spec.color, contents: '' }]);
});

test('markup lands in the same place on a rotated page', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['hi']));
  engine.rotatePage(id, 0, 90);
  const key = engine.addAnnotation(id, 0, spec);
  assert.strictEqual(pixelAt(engine.renderPage(id, 0, 1), 150, 60)[3], 255);
  assert.deepStrictEqual(engine.listAnnotations(id, 0)[0].rects, spec.rects);
  engine.removeAnnotation(id, 0, key);
  assert.strictEqual(pixelAt(engine.renderPage(id, 0, 1), 150, 60)[3], 0);
});

test('underline and strikethrough are drawn over their line', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['hi']));
  for (const type of ['Underline', 'StrikeOut']) {
    const rects = [{ x: 100, y: type === 'Underline' ? 50 : 150, w: 100, h: 20 }];
    engine.addAnnotation(id, 0, { type, rects, color: [1, 0, 0] });
  }
  assert.deepStrictEqual(engine.listAnnotations(id, 0).map((a) => a.type), ['Underline', 'StrikeOut']);
  const page = engine.renderPage(id, 0, 1);
  const inked = (x0, y0, x1, y1) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (pixelAt(page, x, y)[3]) return true;
    return false;
  };
  assert.ok(inked(100, 50, 200, 72), 'underline');
  assert.ok(inked(100, 150, 200, 172), 'strikethrough');
});

test('a note keeps its text and colour, can be changed, and survives saving', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['hi']));
  const key = engine.addAnnotation(id, 0, { type: 'Text', rects: [{ x: 30, y: 40, w: 20, h: 20 }], color: [1, 0.9, 0.3], contents: 'check this' });
  assert.strictEqual(engine.listAnnotations(id, 0)[0].contents, 'check this');
  assert.strictEqual(pixelAt(engine.renderPage(id, 0, 1), 40, 50)[3], 255, 'the note icon is drawn');
  engine.changeAnnotation(id, 0, key, { contents: 'done', rects: [{ x: 60, y: 80, w: 20, h: 20 }] });
  const again = engine.openDocument(engine.save(id)).id;
  const [note] = engine.listAnnotations(again, 0);
  assert.strictEqual(note.contents, 'done');
  assert.deepStrictEqual(note.rects, [{ x: 60, y: 80, w: 20, h: 20 }]);
});

test('changing a highlight colour redraws it, and a missing annotation is reported', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['hi']));
  const key = engine.addAnnotation(id, 0, spec);
  engine.changeAnnotation(id, 0, key, { color: [0, 1, 0] });
  const [r, g] = pixelAt(engine.renderPage(id, 0, 1), 150, 60);
  assert.ok(near(r, 0) && near(g, 255));
  engine.removeAnnotation(id, 0, key);
  assert.throws(() => engine.removeAnnotation(id, 0, key), /no longer/);
  assert.throws(() => engine.addAnnotation(id, 0, { ...spec, type: 'Polygon' }), /not supported/);
});

test('summarizeAnnotations lists a range of pages with the words under markup', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['Alpha beta gamma', 'second page', 'third page']));
  const [box] = engine.getText(id, 0);
  const rects = [{ x: box.x, y: box.y, w: box.w, h: box.h }];
  engine.addAnnotation(id, 0, { type: 'Highlight', rects, color: [1, 0.75, 0] });
  engine.addAnnotation(id, 2, { type: 'Text', rects: [{ x: 50, y: 60, w: 20, h: 20 }], color: [1, 0.8, 0], contents: 'remember' });
  const all = engine.summarizeAnnotations(id, 0, 99);
  assert.deepStrictEqual(all.map((a) => [a.index, a.type, a.text, a.contents]), [[0, 'Highlight', 'Alpha beta gamma', ''], [2, 'Text', '', 'remember']]);
  assert.deepStrictEqual(engine.summarizeAnnotations(id, 1, 2), []);
});
