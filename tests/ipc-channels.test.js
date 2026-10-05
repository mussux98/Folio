const test = require('node:test');
const assert = require('node:assert');

test('ipc-channels loads and is frozen', () => {
  const channels = require('../shared/ipc-channels.js');
  assert.ok(Object.isFrozen(channels));
});
