const test = require('node:test');
const assert = require('node:assert');

const load = () => import('../renderer/features/signatures/geometry.js');
const page = { width: 300, height: 400 };

test('a new signature is centred on the click and kept on the page', async () => {
  const { placedAt, DEFAULT_WIDTH } = await load();
  assert.deepStrictEqual(placedAt({ x: 150, y: 200 }, 3, page), { x: 150 - DEFAULT_WIDTH / 2, y: 200 - DEFAULT_WIDTH / 6, w: DEFAULT_WIDTH, h: DEFAULT_WIDTH / 3 });
  const corner = placedAt({ x: 0, y: 399 }, 3, page);
  assert.deepStrictEqual([corner.x, corner.y + corner.h], [0, 400]);
});

test('moving stops at the page edges', async () => {
  const { movedBy } = await load();
  const rect = { x: 100, y: 100, w: 60, h: 20 };
  assert.deepStrictEqual(movedBy(rect, 10, -5, page), { x: 110, y: 95, w: 60, h: 20 });
  assert.deepStrictEqual(movedBy(rect, 1000, 1000, page), { x: 240, y: 380, w: 60, h: 20 });
  assert.deepStrictEqual(movedBy(rect, -1000, -1000, page), { x: 0, y: 0, w: 60, h: 20 });
});

test('resizing keeps the aspect ratio and the opposite corner fixed', async () => {
  const { resizedBy } = await load();
  const rect = { x: 100, y: 100, w: 60, h: 20 };
  assert.deepStrictEqual(resizedBy(rect, 'se', 30, 0, page), { x: 100, y: 100, w: 90, h: 30 });
  assert.deepStrictEqual(resizedBy(rect, 'nw', -30, 0, page), { x: 70, y: 90, w: 90, h: 30 });
  assert.deepStrictEqual(resizedBy(rect, 'ne', 0, -20, page), { x: 100, y: 80, w: 120, h: 40 });
});

test('resizing has a smallest size and stays on the page', async () => {
  const { resizedBy, MIN_WIDTH } = await load();
  const rect = { x: 100, y: 100, w: 60, h: 20 };
  assert.strictEqual(resizedBy(rect, 'se', -500, -500, page).w, MIN_WIDTH);
  const big = resizedBy(rect, 'se', 900, 900, page);
  assert.ok(big.x + big.w <= 300 && big.y + big.h <= 400);
  assert.ok(Math.abs(big.w / big.h - 3) < 1e-9);
});

test('a quarter turn swaps width and height around the centre', async () => {
  const { turnedRect } = await load();
  assert.deepStrictEqual(turnedRect({ x: 100, y: 100, w: 60, h: 20 }, page), { x: 120, y: 80, w: 20, h: 60 });
});

test('a turned signature that no longer fits is shrunk and kept on the page', async () => {
  const { turnedRect } = await load();
  const turned = turnedRect({ x: 0, y: 150, w: 300, h: 40 }, page);
  assert.ok(turned.w <= 300 && turned.h <= 400 && turned.x >= 0 && turned.y >= 0 && turned.y + turned.h <= 400);
  assert.ok(Math.abs(turned.h / turned.w - 300 / 40) < 1e-9);
  const tall = turnedRect({ x: 0, y: 0, w: 380, h: 20 }, { width: 300, height: 400 });
  assert.ok(tall.h <= 400 && tall.w <= 300);
});

test('a replacement picture keeps the centre and width but takes its own shape', async () => {
  const { replacedRect } = await load();
  assert.deepStrictEqual(replacedRect({ x: 100, y: 100, w: 60, h: 20 }, 2, page), { x: 100, y: 95, w: 60, h: 30 });
});
