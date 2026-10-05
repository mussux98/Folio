const test = require('node:test');
const assert = require('node:assert');

const load = () => import('../renderer/commands/page-order.js');

test('pages move to a gap, and the restore order puts them back', async () => {
  const { moveOrder } = await load();
  const move = moveOrder(5, [1, 2], 5);
  assert.deepStrictEqual(move.order, [0, 3, 4, 1, 2]);
  const back = move.order.map((_, k) => move.order.indexOf(k));
  assert.deepStrictEqual(move.restore, back);
  assert.strictEqual(move.first, 3);
});

test('moving to the front, and several apart pages at once', async () => {
  const { moveOrder } = await load();
  assert.deepStrictEqual(moveOrder(4, [3], 0).order, [3, 0, 1, 2]);
  assert.deepStrictEqual(moveOrder(6, [4, 1], 3).order, [0, 2, 1, 4, 3, 5]);
});

test('dropping next to where the pages already are changes nothing', async () => {
  const { moveOrder } = await load();
  assert.ok(moveOrder(4, [1], 1).unchanged);
  assert.ok(moveOrder(4, [1], 2).unchanged);
  assert.ok(moveOrder(4, [1, 2], 3).unchanged);
  assert.ok(!moveOrder(4, [1], 3).unchanged);
});
