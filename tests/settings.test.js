const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { Settings, MAX_RECENT, MAX_VIEWS } = require('../main/settings.js');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-settings-'));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

let counter = 0;
const newFile = () => path.join(dir, `settings-${counter++}`, 'settings.json');

test('starts with defaults when there is no file', () => {
  const settings = new Settings(newFile());
  assert.deepStrictEqual(settings.recent, []);
  assert.deepStrictEqual(settings.getView('C:\\a.pdf'), { page: 1, zoom: 1, fit: 'width' });
  assert.deepStrictEqual(settings.session, { paths: [], active: null });
});

test('starts with defaults when the file is damaged', () => {
  const file = newFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '{ not json');
  assert.deepStrictEqual(new Settings(file).recent, []);
});

test('flush writes the file and a new instance reads it back', () => {
  const file = newFile();
  const first = new Settings(file);
  first.addRecent('C:\\docs\\a.pdf');
  first.setView('C:\\docs\\a.pdf', { page: 7, zoom: 1.5, fit: 'page' });
  first.setSession({ paths: ['C:\\docs\\a.pdf'], active: 'C:\\docs\\a.pdf' });
  first.setWindowState({ x: 10, y: 20, width: 900, height: 700, maximized: true });
  first.flush();
  assert.ok(!fs.existsSync(`${file}.tmp`), 'temp file is gone after the rename');

  const second = new Settings(file);
  assert.deepStrictEqual(second.recent, ['C:\\docs\\a.pdf']);
  assert.deepStrictEqual(second.getView('C:\\docs\\a.pdf'), { page: 7, zoom: 1.5, fit: 'page' });
  assert.deepStrictEqual(second.session.paths, ['C:\\docs\\a.pdf']);
  assert.deepStrictEqual(second.windowState, { x: 10, y: 20, width: 900, height: 700, maximized: true });
});

test('recent files: newest first, no duplicates, capped', () => {
  const settings = new Settings(newFile());
  for (let i = 0; i < MAX_RECENT + 5; i++) settings.addRecent(`C:\\f${i}.pdf`);
  assert.strictEqual(settings.recent.length, MAX_RECENT);
  assert.strictEqual(settings.recent[0], `C:\\f${MAX_RECENT + 4}.pdf`);

  settings.addRecent(`C:\\f${MAX_RECENT}.pdf`);
  assert.strictEqual(settings.recent[0], `C:\\f${MAX_RECENT}.pdf`);
  assert.strictEqual(new Set(settings.recent).size, settings.recent.length);
});

test('recent files can be removed and cleared', () => {
  const settings = new Settings(newFile());
  settings.addRecent('C:\\a.pdf');
  settings.addRecent('C:\\b.pdf');
  settings.removeRecent('C:\\a.pdf');
  assert.deepStrictEqual(settings.recent, ['C:\\b.pdf']);
  settings.clearRecent();
  assert.deepStrictEqual(settings.recent, []);
});

test('per-file views drop the oldest past the limit', () => {
  const settings = new Settings(newFile());
  for (let i = 0; i < MAX_VIEWS + 3; i++) settings.setView(`C:\\f${i}.pdf`, { page: i + 1, zoom: 1 });
  assert.strictEqual(Object.keys(settings.data.views).length, MAX_VIEWS);
  assert.deepStrictEqual(settings.getView('C:\\f0.pdf'), { page: 1, zoom: 1, fit: 'width' });
  assert.strictEqual(settings.getView(`C:\\f${MAX_VIEWS + 2}.pdf`).page, MAX_VIEWS + 3);
});
