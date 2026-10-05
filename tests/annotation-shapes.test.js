const test = require('node:test');
const assert = require('node:assert');

const load = () => import('../renderer/features/annotations/shapes.js');
const page = { width: 300, height: 200 };

test('the box of a stroke includes its thickness, and a box shape is its own rect', async () => {
  const { boxOf } = await load();
  assert.deepStrictEqual(boxOf({ type: 'Ink', width: 4, paths: [[{ x: 10, y: 20 }, { x: 50, y: 5 }]] }), { x: 8, y: 3, w: 44, h: 19 });
  assert.deepStrictEqual(boxOf({ type: 'Square', rects: [{ x: 1, y: 2, w: 3, h: 4 }] }), { x: 1, y: 2, w: 3, h: 4 });
});

test('a click picks a line near its stroke and a box anywhere inside', async () => {
  const { hits } = await load();
  const line = { type: 'Line', width: 2, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] };
  assert.ok(hits(line, { x: 50, y: 3 }));
  assert.ok(!hits(line, { x: 50, y: 10 }));
  assert.ok(!hits(line, { x: 110, y: 0 }));
  const dot = { type: 'Ink', width: 2, paths: [[{ x: 20, y: 20 }]] };
  assert.ok(hits(dot, { x: 21, y: 21 }), 'a stroke of one point');
  assert.ok(hits({ type: 'Circle', rects: [{ x: 10, y: 10, w: 50, h: 50 }] }, { x: 35, y: 35 }));
});

test('moving keeps the shape on the page', async () => {
  const { movedBy } = await load();
  const square = { type: 'Square', rects: [{ x: 10, y: 10, w: 50, h: 50 }] };
  assert.deepStrictEqual(movedBy(square, 20, 5, page), { rects: [{ x: 30, y: 15, w: 50, h: 50 }] });
  assert.deepStrictEqual(movedBy(square, -100, 500, page), { rects: [{ x: 0, y: 150, w: 50, h: 50 }] });
  const line = { type: 'Line', width: 0, points: [{ x: 10, y: 10 }, { x: 20, y: 20 }] };
  assert.deepStrictEqual(movedBy(line, 5, -50, page), { points: [{ x: 15, y: 0 }, { x: 25, y: 10 }] });
});

test('resizing from a corner keeps the opposite corner, and a stamp keeps its shape', async () => {
  const { resizedBy } = await load();
  const rect = { x: 100, y: 100, w: 40, h: 20 };
  assert.deepStrictEqual(resizedBy(rect, 'se', 10, 30, page), { x: 100, y: 100, w: 50, h: 50 });
  assert.deepStrictEqual(resizedBy(rect, 'nw', 10, 5, page), { x: 110, y: 105, w: 30, h: 15 });
  assert.deepStrictEqual(resizedBy(rect, 'se', 40, 0, page, true), { x: 100, y: 100, w: 80, h: 40 });
  assert.deepStrictEqual(resizedBy(rect, 'se', 1000, 0, page, true), { x: 100, y: 100, w: 200, h: 100 }, 'stops at the page edge');
  assert.deepStrictEqual(resizedBy(rect, 'se', -100, -100, page), { x: 100, y: 100, w: 4, h: 4 });
});

test('Shift snaps a line to 45° and a box to a square', async () => {
  const { snapped, boxFrom } = await load();
  const end = snapped({ x: 0, y: 0 }, { x: 10, y: 1 });
  assert.ok(Math.abs(end.y) < 1e-9 && Math.abs(end.x - Math.hypot(10, 1)) < 1e-9);
  assert.deepStrictEqual(boxFrom({ x: 50, y: 50 }, { x: 20, y: 90 }, false), { x: 20, y: 50, w: 30, h: 40 });
  assert.deepStrictEqual(boxFrom({ x: 50, y: 50 }, { x: 20, y: 90 }, true), { x: 20, y: 50, w: 30, h: 30 });
});
