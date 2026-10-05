const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeFileAtomic } = require('../main/save-file');

function folder(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-save-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const busy = () => Object.assign(new Error('busy'), { code: 'EBUSY' });

test('writes a new file', async (t) => {
  const file = path.join(folder(t), 'new.pdf');
  await writeFileAtomic(file, Buffer.from('%PDF-new'));
  assert.strictEqual(fs.readFileSync(file, 'utf8'), '%PDF-new');
});

test('replaces the original and leaves no temp file behind', async (t) => {
  const dir = folder(t);
  const file = path.join(dir, 'doc.pdf');
  fs.writeFileSync(file, '%PDF-old');
  await writeFileAtomic(file, Buffer.from('%PDF-new'));
  assert.strictEqual(fs.readFileSync(file, 'utf8'), '%PDF-new');
  assert.deepStrictEqual(fs.readdirSync(dir), ['doc.pdf']);
});

test('waits for a file that is briefly in use', async (t) => {
  const file = path.join(folder(t), 'doc.pdf');
  fs.writeFileSync(file, '%PDF-old');
  let failures = 2;
  const rename = async (from, to) => {
    if (failures-- > 0) throw busy();
    fs.renameSync(from, to);
  };
  await writeFileAtomic(file, Buffer.from('%PDF-new'), { rename, retryMs: 1 });
  assert.strictEqual(fs.readFileSync(file, 'utf8'), '%PDF-new');
});

test('a file that stays in use keeps its content, and the user is told why', async (t) => {
  const dir = folder(t);
  const file = path.join(dir, 'doc.pdf');
  fs.writeFileSync(file, '%PDF-old');
  const rename = async () => { throw busy(); };
  await assert.rejects(writeFileAtomic(file, Buffer.from('%PDF-new'), { rename, retryMs: 1 }), /in use by another program/);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), '%PDF-old');
  assert.deepStrictEqual(fs.readdirSync(dir), ['doc.pdf']);
});

test('a read-only file is not replaced', async (t) => {
  const file = path.join(folder(t), 'doc.pdf');
  fs.writeFileSync(file, '%PDF-old');
  fs.chmodSync(file, 0o444);
  try {
    await assert.rejects(writeFileAtomic(file, Buffer.from('%PDF-new')), /read-only/);
    assert.strictEqual(fs.readFileSync(file, 'utf8'), '%PDF-old');
  } finally {
    fs.chmodSync(file, 0o644);
  }
});

test('a missing folder gives a clear message', async (t) => {
  const file = path.join(folder(t), 'gone', 'doc.pdf');
  await assert.rejects(writeFileAtomic(file, Buffer.from('%PDF-new')), /folder no longer exists/);
});
