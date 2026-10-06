const test = require('node:test');
const assert = require('node:assert');

const load = () => import('../renderer/features/reader/print-range.js');

test('empty text means every page', async () => {
  const { parsePrintRange } = await load();
  assert.deepStrictEqual(parsePrintRange('  ', 3), [0, 1, 2]);
});

test('single pages and ranges, sorted and without repeats', async () => {
  const { parsePrintRange } = await load();
  assert.deepStrictEqual(parsePrintRange('7, 1-3, 2', 10), [0, 1, 2, 6]);
});

test('open ends run to the first or last page', async () => {
  const { parsePrintRange } = await load();
  assert.deepStrictEqual(parsePrintRange('-2', 5), [0, 1]);
  assert.deepStrictEqual(parsePrintRange('4-', 5), [3, 4]);
});

test('bad text or pages outside the file are refused', async () => {
  const { parsePrintRange } = await load();
  for (const text of ['0', '6', '3-2', 'a', '1,,2', '1-2-3', '-', ',']) {
    assert.strictEqual(parsePrintRange(text, 5), null, text);
  }
});
