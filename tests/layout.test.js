const test = require('node:test');
const assert = require('node:assert');

const load = () => import('../renderer/features/reader/layout.js');

// Three pages: 100x200, 100x200 and a wide 300x100.
const sizes = new Float32Array([100, 200, 100, 200, 300, 100]);

test('pages stack with a gap and padding, scaled by zoom', async () => {
  const { computeLayout, PAGE_GAP, DESK_PAD } = await load();
  const layout = computeLayout(sizes, 2);
  assert.deepStrictEqual([...layout.tops], [DESK_PAD, DESK_PAD + 400 + PAGE_GAP, DESK_PAD + 2 * (400 + PAGE_GAP)]);
  assert.strictEqual(layout.maxWidth, 600);
  assert.strictEqual(layout.total, DESK_PAD * 2 + 400 + 400 + 200 + PAGE_GAP * 2);
});

test('an empty document has no height', async () => {
  const { computeLayout } = await load();
  assert.strictEqual(computeLayout(new Float32Array(0), 1).total, 0);
});

test('pageAtOffset finds the page under a position', async () => {
  const { computeLayout, pageAtOffset } = await load();
  const layout = computeLayout(sizes, 1);
  assert.strictEqual(pageAtOffset(layout, 0), 0);
  assert.strictEqual(pageAtOffset(layout, layout.tops[1]), 1);
  assert.strictEqual(pageAtOffset(layout, layout.tops[2] - 1), 1);
  assert.strictEqual(pageAtOffset(layout, 99999), 2);
});

test('visibleRange lists every page touching the band', async () => {
  const { computeLayout, visibleRange } = await load();
  const layout = computeLayout(sizes, 1);
  assert.deepStrictEqual(visibleRange(layout, 0, 100), { first: 0, last: 0 });
  assert.deepStrictEqual(visibleRange(layout, 150, 200), { first: 0, last: 1 });
  assert.deepStrictEqual(visibleRange(layout, 0, 5000), { first: 0, last: 2 });
});

test('currentPage is the page with the most on screen', async () => {
  const { computeLayout, currentPage } = await load();
  const layout = computeLayout(sizes, 1);
  // Mostly page 2 is showing.
  assert.strictEqual(currentPage(layout, layout.tops[1] - 20, 120), 1);
  assert.strictEqual(currentPage(layout, 0, 100), 0);
});

test('fit width and fit page', async () => {
  const { fitZoom, DESK_PAD } = await load();
  assert.strictEqual(fitZoom('width', 100, 1000, 100 + DESK_PAD * 2, 300), 1);
  // A tall page is limited by height in fit-page mode.
  assert.strictEqual(fitZoom('page', 100, 400, 1000, 400 + DESK_PAD * 2), 1);
  assert.strictEqual(fitZoom('width', 100, 100, 1e6, 10), 8);
});
