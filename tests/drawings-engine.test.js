const test = require('node:test');
const assert = require('node:assert');

const load = async () => {
  const { createEngine } = await import('../pdf-engine/engine.js');
  const { makePdf } = await import('./fixtures/make-pdf.mjs');
  return { engine: createEngine(), makePdf };
};

const pixelAt = (page, x, y) => [...page.pixels.slice((y * page.width + x) * 4, (y * page.width + x) * 4 + 4)];
const inked = (page, x0, y0, x1, y1) => {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (pixelAt(page, x, y)[3]) return true;
  return false;
};
const close = (a, b) => Math.abs(a - b) < 0.01;

const ink = { type: 'Ink', paths: [[{ x: 20, y: 20 }, { x: 60, y: 60 }, { x: 100, y: 20 }]], color: [0, 0, 1], width: 3 };
const square = { type: 'Square', rects: [{ x: 100, y: 100, w: 80, h: 40 }], color: [1, 0, 0], width: 2 };
const arrow = { type: 'Line', points: [{ x: 20, y: 200 }, { x: 150, y: 250 }], arrow: true, color: [0, 0, 0], width: 2 };

test('ink, shapes and lines are drawn and listed back as they were placed', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['hi']));
  const circle = { ...square, type: 'Circle', rects: [{ x: 200, y: 20, w: 60, h: 60 }] };
  const keys = [ink, square, circle, arrow].map((spec) => engine.addAnnotation(id, 0, spec));
  const listed = engine.listAnnotations(id, 0);
  assert.deepStrictEqual(listed.map((a) => a.key), keys);
  assert.deepStrictEqual(listed[0].paths, ink.paths);
  assert.strictEqual(listed[0].width, 3);
  assert.deepStrictEqual(listed[1].rects, square.rects);
  assert.deepStrictEqual(listed[3].points, arrow.points);
  assert.strictEqual(listed[3].arrow, true);
  const page = engine.renderPage(id, 0, 1);
  assert.ok(inked(page, 58, 56, 62, 62), 'the stroke');
  assert.ok(inked(page, 99, 115, 102, 125), 'the left side of the rectangle');
  assert.ok(!inked(page, 130, 110, 150, 130), 'the rectangle is only an outline');
  assert.ok(inked(page, 228, 18, 232, 23), 'the top of the ellipse');
  assert.ok(inked(page, 80, 220, 90, 230), 'the line');
});

test('moving, recolouring and thickening a shape is kept after saving', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['hi']));
  const inkKey = engine.addAnnotation(id, 0, ink);
  const lineKey = engine.addAnnotation(id, 0, arrow);
  const moved = [ink.paths[0].map(({ x, y }) => ({ x: x + 100, y: y + 100 }))];
  engine.changeAnnotation(id, 0, inkKey, { paths: moved, color: [1, 0, 0], width: 5 });
  engine.changeAnnotation(id, 0, lineKey, { points: [{ x: 10, y: 10 }, { x: 50, y: 10 }] });
  const again = engine.openDocument(engine.save(id)).id;
  const [inked2, line] = engine.listAnnotations(again, 0);
  assert.deepStrictEqual(inked2.paths, moved);
  assert.deepStrictEqual(inked2.color, [1, 0, 0]);
  assert.strictEqual(inked2.width, 5);
  assert.deepStrictEqual(line.points, [{ x: 10, y: 10 }, { x: 50, y: 10 }]);
  assert.strictEqual(line.arrow, true);
});

test('a stamp fits its words, stays upright on turned pages and keeps its place when recoloured', async () => {
  const { engine, makePdf } = await load();
  for (const rotate of [0, 90, 180, 270]) {
    const { id } = engine.openDocument(makePdf([{ text: '', rotate }]));
    const key = engine.addAnnotation(id, 0, { type: 'Stamp', rects: [{ x: 50, y: 50, w: 200, h: 40 }], icon: 'Approved', color: [0, 0.5, 0] });
    const [stamp] = engine.listAnnotations(id, 0);
    assert.strictEqual(stamp.icon, 'Approved');
    const [box] = stamp.rects;
    assert.ok(box.w > box.h * 2 && box.w <= 200 && close(box.h, 40), `wider than tall at ${rotate}°: ${JSON.stringify(box)}`);
    assert.ok(close(box.x + box.w / 2, 150) && close(box.y, 50), 'centred where it was put');
    engine.changeAnnotation(id, 0, key, { color: [1, 0, 0] });
    assert.deepStrictEqual(engine.listAnnotations(id, 0)[0].rects, [box]);
    const page = engine.renderPage(id, 0, 1);
    assert.ok(inked(page, Math.round(box.x), 50, Math.round(box.x + 3), 90), 'the left edge of the frame');
    assert.ok(!inked(page, 0, 95, page.width, page.height), 'nothing is drawn outside the box');
  }
});

test('picture stamps stay with the signatures', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['hi']));
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  engine.addSignature(id, 0, png, { x: 10, y: 10, w: 50, h: 50 });
  engine.addAnnotation(id, 0, { type: 'Stamp', rects: [{ x: 100, y: 100, w: 150, h: 40 }], icon: 'Draft', color: [1, 0, 0] });
  assert.deepStrictEqual(engine.listAnnotations(id, 0).map((a) => a.icon), ['Draft']);
  assert.strictEqual(engine.listSignatures(id, 0).length, 1);
});
