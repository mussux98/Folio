const test = require('node:test');
const assert = require('node:assert');

test('a form edit sets the new value, and undo puts the old one back', async () => {
  const { setFormValue } = await import('../renderer/commands/form.js');
  const calls = [];
  const target = { docId: 7, engine: { setFormValue: async (...args) => calls.push(args) } };
  const command = setFormValue(target, { index: 2, key: '41' }, 'old', 'new');
  assert.deepStrictEqual(command.pages, [2]);
  await command.execute();
  await command.undo();
  await command.execute();
  assert.deepStrictEqual(calls, [[7, 2, '41', 'new'], [7, 2, '41', 'old'], [7, 2, '41', 'new']]);
});
