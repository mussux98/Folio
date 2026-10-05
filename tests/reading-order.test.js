const test = require('node:test');
const assert = require('node:assert');

const line = (block, x, y, text = `b${block}`) => ({ block, x, y, size: 10, text });

test('blocks are read top to bottom, whatever order they were drawn in', async () => {
  const { inReadingOrder } = await import('../pdf-engine/reading-order.js');
  const lines = [line(0, 10, 700, 'footer'), line(1, 10, 20, 'title'), line(2, 10, 100, 'body')];
  assert.deepStrictEqual(inReadingOrder(lines).map((l) => l.text), ['title', 'body', 'footer']);
});

test('blocks on one row go left to right, and a block stays together', async () => {
  const { inReadingOrder } = await import('../pdf-engine/reading-order.js');
  const lines = [line(0, 300, 52, 'right'), line(1, 10, 50, 'left a'), line(1, 10, 62, 'left b'), line(2, 10, 200, 'below')];
  assert.deepStrictEqual(inReadingOrder(lines).map((l) => l.text), ['left a', 'left b', 'right', 'below']);
});

test('the lines of a block go top to bottom, even one drawn last', async () => {
  const { inReadingOrder } = await import('../pdf-engine/reading-order.js');
  const lines = [line(0, 10, 40, 'second'), line(0, 10, 60, 'third'), line(0, 10, 20, 'first (edited)')];
  assert.deepStrictEqual(inReadingOrder(lines).map((l) => l.text), ['first (edited)', 'second', 'third']);
});
