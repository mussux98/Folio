const test = require('node:test');
const assert = require('node:assert');

const load = async () => {
  const { createEngine } = await import('../pdf-engine/engine.js');
  const { makePdf, makeSubsetPdf, fontFile } = await import('./fixtures/make-pdf.mjs');
  return { engine: createEngine(), makePdf, makeSubsetPdf, fontFile };
};

const texts = (engine, id) => engine.getText(id, 0).map((line) => line.text.trim());

// Opens saved bytes in a fresh engine; with a password, unlocks them.
function reopen(engine, bytes, password) {
  const opened = engine.openDocument(bytes);
  if (password === undefined) return opened;
  return engine.authenticate(opened.id, password);
}

test('a protected file saves with its password unless told otherwise', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['Secret'], { password: 'old' }));
  engine.authenticate(id, 'old');
  assert.strictEqual(engine.isProtected(id), true);
  const saved = engine.save(id);
  assert.strictEqual(reopen(engine, saved).locked, true);
  assert.strictEqual(reopen(engine, saved, 'old').locked, false);
});

test('a plain file gets a password on save', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['Hello']));
  assert.strictEqual(engine.isProtected(id), false);
  assert.strictEqual(engine.setProtection(id, 'pässword 1=2'), null);
  assert.strictEqual(engine.isProtected(id), true);
  const saved = engine.save(id);
  assert.strictEqual(reopen(engine, saved).locked, true);
  assert.strictEqual(reopen(engine, saved, 'wrong').locked, true);
  const again = reopen(engine, saved, 'pässword 1=2');
  assert.strictEqual(again.locked, false);
  assert.deepStrictEqual(texts(engine, again.id), ['Hello']);
});

test('the password can be changed, removed, and put back as it was', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['Secret'], { password: 'old' }));
  engine.authenticate(id, 'old');

  const before = engine.setProtection(id, 'new');
  const changed = engine.save(id);
  assert.strictEqual(reopen(engine, changed, 'old').locked, true);
  assert.strictEqual(reopen(engine, changed, 'new').locked, false);

  engine.setProtection(id, '');
  assert.strictEqual(engine.isProtected(id), false);
  assert.strictEqual(reopen(engine, engine.save(id)).locked, false);

  // Undo: back to the file's own password.
  engine.setProtection(id, before);
  assert.strictEqual(reopen(engine, engine.save(id), 'old').locked, false);
});

test('a password with a comma is refused', async () => {
  const { engine, makePdf } = await load();
  const { id } = engine.openDocument(makePdf(['Hello']));
  assert.throws(() => engine.setProtection(id, 'a,b'), /comma/);
  assert.strictEqual(engine.isProtected(id), false);
});

test('installed fonts are still cut down when the file has a password', async () => {
  const { engine, makeSubsetPdf, fontFile } = await load();
  const { id } = engine.openDocument(makeSubsetPdf('Dear Mr Brown,'));
  const line = engine.textLineAt(id, 0, { x: 40, y: 45 });
  const bytes = fontFile('Times-Roman');
  const installed = { key: 'times', family: 'Times', bytes, index: 0 };
  engine.replaceText(id, 0, { ...line, text: 'Dear Ms Green,', reuse: [line.font.id], installed });
  engine.setProtection(id, 'pw');
  const saved = engine.save(id);
  assert.ok(saved.length < bytes.length / 2, `saved ${saved.length} bytes, font is ${bytes.length}`);
  const again = reopen(engine, saved, 'pw');
  assert.strictEqual(again.locked, false);
  assert.deepStrictEqual(texts(engine, again.id), ['Dear Ms Green,']);
});
