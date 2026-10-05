const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const { parseSession, parseView } = require('../main/validate.js');

const a = path.resolve('a.pdf');
const b = path.resolve('b.pdf');

test('parseSession keeps absolute paths and a matching active file', () => {
  assert.deepStrictEqual(parseSession({ paths: [a, b], active: b }), { paths: [a, b], active: b });
});

test('parseSession drops bad entries', () => {
  const session = parseSession({ paths: [a, 'relative.pdf', 5, null], active: 'elsewhere.pdf' });
  assert.deepStrictEqual(session, { paths: [a], active: null });
});

test('parseSession ignores an active file that is not in the list', () => {
  assert.strictEqual(parseSession({ paths: [a], active: b }).active, null);
});

test('parseSession rejects non-objects and non-arrays', () => {
  for (const value of [null, undefined, 'x', 3, {}, { paths: 'a' }]) {
    assert.strictEqual(parseSession(value), null);
  }
});

test('parseSession caps the number of tabs', () => {
  const paths = Array.from({ length: 500 }, (_, i) => path.resolve(`f${i}.pdf`));
  assert.strictEqual(parseSession({ paths, active: null }).paths.length, 100);
});

test('parseView accepts a good view and strips extra fields', () => {
  assert.deepStrictEqual(parseView({ path: a, page: 3, zoom: 1.25, evil: true }), { path: a, page: 3, zoom: 1.25 });
});

test('parseView rejects bad pages, zooms and paths', () => {
  const bad = [
    { path: 'rel.pdf', page: 1, zoom: 1 },
    { path: a, page: 0, zoom: 1 },
    { path: a, page: 1.5, zoom: 1 },
    { path: a, page: '2', zoom: 1 },
    { path: a, page: 1, zoom: 0 },
    { path: a, page: 1, zoom: 99 },
    { path: a, page: 1, zoom: NaN },
    { path: a, page: 1, zoom: '1' },
    null,
    'x',
  ];
  for (const value of bad) assert.strictEqual(parseView(value), null, JSON.stringify(value));
});
