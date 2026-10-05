const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const channels = require('../shared/ipc-channels.js');

test('ipc-channels loads and is frozen', () => {
  assert.ok(Object.isFrozen(channels));
});

test('every channel name is unique', () => {
  const names = Object.values(channels);
  assert.strictEqual(new Set(names).size, names.length);
});

// The sandboxed preload can't require the list, so it repeats the names.
test('preload uses exactly the channels in the shared list', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'main', 'preload.js'), 'utf8');
  const used = new Set(source.match(/'[a-z]+:[a-z-]+'/g).map((name) => name.slice(1, -1)));
  assert.deepStrictEqual([...used].sort(), Object.values(channels).sort());
});
