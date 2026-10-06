const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createLookalikes } = require('../main/lookalike-fonts');
const { createSystemFonts } = require('../main/system-fonts');

const lookalikes = createLookalikes();

test('Arial and Helvetica names get Liberation Sans in the wanted style', async () => {
  const bold = await lookalikes.find('ABCDEF+Arial-BoldMT', true, false);
  assert.strictEqual(bold.family, 'Liberation Sans');
  assert.ok(bold.key.endsWith('LiberationSans-Bold.ttf#0'));
  const italic = await lookalikes.find('Helvetica-Oblique', false, true);
  assert.ok(italic.key.endsWith('LiberationSans-Italic.ttf#0'));
});

test('Times New Roman, Courier New and Calibri each get their look-alike', async () => {
  const family = async (name) => (await lookalikes.find(name, false, false)).family;
  assert.strictEqual(await family('TimesNewRomanPSMT'), 'Liberation Serif');
  assert.strictEqual(await family('Times-Roman'), 'Liberation Serif');
  assert.strictEqual(await family('CourierNewPSMT'), 'Liberation Mono');
  assert.strictEqual(await family('Calibri'), 'Carlito');
});

test('bold italic comes from the bold italic file, and the bytes are a real font', async () => {
  const found = await lookalikes.find('Calibri-BoldItalic', true, true);
  assert.ok(found.key.endsWith('Carlito-BoldItalic.ttf#0'));
  assert.ok(found.bytes.length > 100000);
});

test('a name with no look-alike gets nothing', async () => {
  assert.strictEqual(await lookalikes.find('Cambria', false, false), null);
  assert.strictEqual(await lookalikes.find('Garamond', false, false), null);
});

test('the system fonts fall back to the look-alike, but an installed font wins', async () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-fonts-'));
  try {
    const none = createSystemFonts([empty]);
    assert.strictEqual((await none.find('Arial', false, false)).family, 'Liberation Sans');
    assert.strictEqual(await none.find('Garamond', false, false), null);

    fs.copyFileSync(path.join(__dirname, '../main/fonts/LiberationSerif-Regular.ttf'), path.join(empty, 'LiberationSerif-Regular.ttf'));
    const installed = createSystemFonts([empty]);
    const found = await installed.find('LiberationSerif', false, false);
    assert.ok(found.key.startsWith(empty));
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
});

test('installed families are listed once each, and a family comes back in the wanted style', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-fonts-'));
  try {
    for (const name of ['LiberationSerif-Regular.ttf', 'LiberationSerif-Bold.ttf', 'Carlito-Regular.ttf']) {
      fs.copyFileSync(path.join(__dirname, '../main/fonts', name), path.join(folder, name));
    }
    const fonts = createSystemFonts([folder]);
    assert.deepStrictEqual(await fonts.families(), ['Carlito', 'Liberation Serif']);
    assert.ok((await fonts.findFamily('Liberation Serif', true, false)).key.endsWith('LiberationSerif-Bold.ttf#0'));
    // No italic in the folder: the nearest face of the family is used.
    assert.ok((await fonts.findFamily('Liberation Serif', false, true)).key.includes('LiberationSerif-'));
    assert.strictEqual((await fonts.findFamily('Carlito', true, true)).family, 'Carlito');
    assert.strictEqual(await fonts.findFamily('Garamond', false, false), null);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
