const test = require('node:test');
const assert = require('node:assert');

const load = () => import('../renderer/features/reader/text-join.js');
const line = (text, block = 0) => ({ text, block });

test('lines of one paragraph are joined with a space', async () => {
  const { joinLine } = await load();
  assert.deepStrictEqual(joinLine(line('hello'), line('world')), { text: 'hello', after: ' ' });
  assert.strictEqual(joinLine(line('hello '), line('world')).after, '');
});

test('a new paragraph, or the last line, ends with a break', async () => {
  const { joinLine } = await load();
  assert.strictEqual(joinLine(line('end', 0), line('next', 1)).after, '\n');
  assert.strictEqual(joinLine(line('end'), undefined).after, '\n');
});

test('a word split with a hyphen is joined and loses the hyphen', async () => {
  const { joinLine } = await load();
  assert.deepStrictEqual(joinLine(line('la contrata-'), line('ción de')), { text: 'la contrata', after: '' });
  assert.deepStrictEqual(joinLine(line('soft­'), line('hyphen')), { text: 'soft', after: '' });
});

test('hyphens that are not splits are kept', async () => {
  const { joinLine } = await load();
  // Next line starts with a capital or a digit, or the hyphen stands alone.
  assert.strictEqual(joinLine(line('Mar-'), line('Del')).text, 'Mar-');
  assert.strictEqual(joinLine(line('2020-'), line('2021')).text, '2020-');
  assert.strictEqual(joinLine(line('a -'), line('b')).text, 'a -');
  // Another paragraph never continues the word.
  assert.strictEqual(joinLine(line('split-', 0), line('word', 1)).text, 'split-');
});
