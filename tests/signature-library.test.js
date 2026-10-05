const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createSignatureLibrary, MAX_SIGNATURES } = require('../main/signature-library.js');

const tempFolder = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'folio-sig-')), 'signatures');
const png = (n) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, n]);

test('a missing folder is an empty library', async () => {
  assert.deepStrictEqual(await createSignatureLibrary(tempFolder()).list(), []);
});

test('added signatures come back in the order they were added', async () => {
  const library = createSignatureLibrary(tempFolder());
  const first = await library.add(png(1));
  await new Promise((resolve) => setTimeout(resolve, 20));
  const second = await library.add(png(2));
  const all = await library.list();
  assert.deepStrictEqual(all.map((item) => item.id), [first, second]);
  assert.deepStrictEqual([...all[1].png], [...png(2)]);
});

test('a removed signature is gone, and a bad id is refused', async () => {
  const library = createSignatureLibrary(tempFolder());
  const id = await library.add(png(1));
  assert.strictEqual(await library.remove('../../settings'), false);
  assert.strictEqual(await library.remove(id), true);
  assert.deepStrictEqual(await library.list(), []);
});

test('the library holds a limited number of signatures', async () => {
  const library = createSignatureLibrary(tempFolder());
  for (let i = 0; i < MAX_SIGNATURES; i++) await library.add(png(1));
  assert.strictEqual(await library.add(png(1)), null);
});
