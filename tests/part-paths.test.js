const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const { partPaths } = require('../main/part-paths');

const folder = path.join('C:', 'docs');

test('parts are named after the file, in order', () => {
  assert.deepStrictEqual(partPaths(folder, 'report', 3, () => false), [
    path.join(folder, 'report - part 1.pdf'),
    path.join(folder, 'report - part 2.pdf'),
    path.join(folder, 'report - part 3.pdf'),
  ]);
});

test('existing files are never reused: every part gets the same new number', () => {
  const taken = new Set([path.join(folder, 'report - part 2.pdf'), path.join(folder, 'report (2) - part 1.pdf')]);
  assert.deepStrictEqual(partPaths(folder, 'report', 2, (p) => taken.has(p)), [
    path.join(folder, 'report (3) - part 1.pdf'),
    path.join(folder, 'report (3) - part 2.pdf'),
  ]);
});
