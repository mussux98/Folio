const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { checkPdfPath, pdfPathsFromArgv } = require('../main/pdf-path.js');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-pdf-'));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

function write(name, content) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, content);
  return file;
}

test('accepts a real PDF and reports name and size', async () => {
  const file = write('good.pdf', '%PDF-1.4\n%%EOF\n');
  const info = await checkPdfPath(file);
  assert.deepStrictEqual(info, { path: file, name: 'good.pdf', size: 15 });
});

test('accepts an uppercase extension', async () => {
  const info = await checkPdfPath(write('LOUD.PDF', '%PDF-1.7\n'));
  assert.strictEqual(info.name, 'LOUD.PDF');
});

test('rejects values that are not absolute paths', async () => {
  await assert.rejects(checkPdfPath('relative.pdf'), /valid file path/);
  await assert.rejects(checkPdfPath(42), /valid file path/);
  await assert.rejects(checkPdfPath(undefined), /valid file path/);
});

test('rejects other extensions', async () => {
  await assert.rejects(checkPdfPath(write('notes.txt', '%PDF-1.4')), /Only PDF files/);
});

test('rejects a .pdf file without a PDF header', async () => {
  await assert.rejects(checkPdfPath(write('fake.pdf', 'hello world')), /not a valid PDF/);
});

test('rejects an empty .pdf file', async () => {
  await assert.rejects(checkPdfPath(write('empty.pdf', '')), /not a valid PDF/);
});

test('flags a missing file so the caller can forget it', async () => {
  await assert.rejects(checkPdfPath(path.join(dir, 'gone.pdf')), (err) => err.missing === true);
});

test('rejects a folder named like a PDF', async () => {
  const folder = path.join(dir, 'folder.pdf');
  fs.mkdirSync(folder);
  await assert.rejects(checkPdfPath(folder), Error);
});

test('does not keep the file locked (it can be renamed right after)', async () => {
  const file = write('moveme.pdf', '%PDF-1.4');
  await checkPdfPath(file);
  const moved = path.join(dir, 'moved.pdf');
  fs.renameSync(file, moved);
  assert.ok(fs.existsSync(moved));
});

test('pdfPathsFromArgv keeps only PDFs and resolves them', () => {
  const workingDir = path.join(dir, 'work');
  const argv = ['--flag', 'electron.exe', '.', 'a.pdf', path.join(dir, 'b.PDF'), 'notes.txt', '--x.pdf'];
  assert.deepStrictEqual(pdfPathsFromArgv(argv, workingDir), [
    path.join(workingDir, 'a.pdf'),
    path.join(dir, 'b.PDF'),
  ]);
});
