const test = require('node:test');
const assert = require('node:assert');

const load = () => import('../pdf-engine/fuzzy-search.js');

// One character per 10 points, so a match's box is easy to predict.
const line = (text) => [...text].map((c, i) => ({ c, quad: [i * 10, 0, i * 10 + 10, 0, i * 10, 10, i * 10 + 10, 10] }));

test('foldText drops case, accents and stray marks', async () => {
  const { foldText } = await load();
  assert.strictEqual(foldText('Café `Ñandú'), 'cafe nandu');
  assert.strictEqual(foldText('é'), 'e');
  assert.strictEqual(foldText('ﬁn'), 'fin');
});

test('findInLine returns a box around each match', async () => {
  const { findInLine } = await load();
  const boxes = findInLine(line('ab ab'), 'AB');
  assert.deepStrictEqual(boxes, [{ x: 0, y: 0, w: 20, h: 10 }, { x: 30, y: 0, w: 20, h: 10 }]);
});

test('a stray mark inside the match is covered by its box', async () => {
  const { findInLine } = await load();
  assert.deepStrictEqual(findInLine(line('a`bc'), 'abc'), [{ x: 0, y: 0, w: 40, h: 10 }]);
});

test('an empty or mark-only needle finds nothing', async () => {
  const { findInLine } = await load();
  assert.deepStrictEqual(findInLine(line('abc'), '  '), []);
  assert.deepStrictEqual(findInLine(line('abc'), '`'), []);
});
