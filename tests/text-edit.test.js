const test = require('node:test');
const assert = require('node:assert');

// A stand-in for the engine client that records what it was asked.
function fakeEngine() {
  const calls = [];
  return {
    calls,
    replaceText: async (docId, index, edit) => { calls.push(['replace', index, edit.text]); return { key: 7, font: { name: 'Helvetica', kind: 'standard' } }; },
    swapText: async (docId, key, which) => { calls.push(['swap', key, which]); },
  };
}

test('a text change runs once, then undo and redo swap it', async () => {
  const { changeText } = await import('../renderer/commands/text-edit.js');
  const engine = fakeEngine();
  const command = changeText({ engine, docId: 1 }, 2, { text: 'Hi' });
  assert.deepStrictEqual(command.pages, [2]);
  await command.execute();
  assert.deepStrictEqual(command.font, { name: 'Helvetica', kind: 'standard' });
  await command.undo();
  await command.execute();
  assert.deepStrictEqual(engine.calls, [['replace', 2, 'Hi'], ['swap', 7, 'before'], ['swap', 7, 'after']]);
});

test('colours go to hex and back, and styles compare by what they look like', async () => {
  const { toHex, fromHex, sameStyle, DEFAULT_STYLE } = await import('../renderer/features/text-edit/style.js');
  assert.strictEqual(toHex([1, 0.5, 0]), '#ff8000');
  assert.deepStrictEqual(fromHex('#ff0000'), [1, 0, 0]);
  assert.deepStrictEqual(fromHex('nonsense'), [0, 0, 0]);
  assert.ok(sameStyle(DEFAULT_STYLE, { ...DEFAULT_STYLE, color: [0.001, 0, 0] }));
  assert.ok(!sameStyle(DEFAULT_STYLE, { ...DEFAULT_STYLE, bold: true }));
});

test('standard font names read naturally', async () => {
  const { fontLabel } = await import('../renderer/features/text-edit/style.js');
  assert.strictEqual(fontLabel('Times-Roman'), 'Times');
  assert.strictEqual(fontLabel('Helvetica-BoldOblique'), 'Helvetica Bold Oblique');
  assert.strictEqual(fontLabel('Courier'), 'Courier');
});

// Enough of a MuPDF font for styleOf.
const font = (name, flags = {}) => ({
  getName: () => name, isMono: () => !!flags.mono, isSerif: () => !!flags.serif, isBold: () => !!flags.bold, isItalic: () => !!flags.italic,
});

test('a font from the file maps to the closest standard font', async () => {
  const { styleOf, standardFont, looksStandard } = await import('../pdf-engine/standard-fonts.js');
  const pick = (f) => standardFont(styleOf(f));
  assert.strictEqual(pick(font('ABCDEF+Calibri-Bold')), 'Helvetica-Bold');
  assert.strictEqual(pick(font('TimesNewRomanPS-ItalicMT')), 'Times-Italic');
  assert.strictEqual(pick(font('Georgia')), 'Times-Roman');
  assert.strictEqual(pick(font('NotoSans-Regular', { serif: true })), 'Helvetica');
  assert.strictEqual(pick(font('Consolas')), 'Courier');
  assert.strictEqual(pick(font('F12', { serif: true, bold: true, italic: true })), 'Times-BoldItalic');
  assert.strictEqual(styleOf(font('ABCDEF+Calibri')).name, 'Calibri');
  assert.ok(looksStandard('ArialMT') && looksStandard('Times New Roman') && looksStandard('Helvetica-Bold'));
  assert.ok(!looksStandard('Calibri'));
});

test('WinAnsi holds Latin-1 and the Windows extras, and nothing else', async () => {
  const { winAnsiBytes } = await import('../pdf-engine/standard-fonts.js');
  assert.deepStrictEqual(winAnsiBytes('Aé€’'), [0x41, 0xe9, 0x80, 0x92]);
  assert.strictEqual(winAnsiBytes('Ω'), null);
  assert.strictEqual(winAnsiBytes('a\nb'), null);
});

test('font names from PDFs read as people know them, and the face counts as style', async () => {
  const { readableFont, sameStyle, DEFAULT_STYLE } = await import('../renderer/features/text-edit/style.js');
  assert.strictEqual(readableFont('ABCDEF+TimesNewRomanPS-BoldMT'), 'Times New Roman');
  assert.strictEqual(readableFont('ArialMT'), 'Arial');
  assert.strictEqual(readableFont('Calibri,Bold'), 'Calibri');
  assert.strictEqual(sameStyle({ ...DEFAULT_STYLE, face: 'Calibri' }, DEFAULT_STYLE), false);
});

test('document fonts are offered by the names people know, own line first when its style is kept', async () => {
  const { documentFaces, fontsToReuse } = await import('../renderer/features/text-edit/faces.js');
  const fonts = [
    { id: 'AAAAAA+Calibri', family: 'sans', bold: false, italic: false },
    { id: 'BBBBBB+Calibri-Bold', family: 'sans', bold: true, italic: false },
    { id: 'CCCCCC+Calibri', family: 'sans', bold: false, italic: false },
  ];
  const line = { font: { id: 'CCCCCC+Calibri', family: 'sans', bold: false, italic: false } };
  const faces = documentFaces(fonts, line);
  assert.deepStrictEqual([...faces.keys()], ['Calibri']);
  const plain = { bold: false, italic: false };
  assert.deepStrictEqual(fontsToReuse(faces.get('Calibri'), plain, line), ['CCCCCC+Calibri', 'AAAAAA+Calibri']);
  assert.deepStrictEqual(fontsToReuse(faces.get('Calibri'), { bold: true, italic: false }, line), ['BBBBBB+Calibri-Bold']);
  const lonely = { font: { id: 'DDDDDD+Garamond', family: 'serif', bold: false, italic: false } };
  assert.deepStrictEqual([...documentFaces(fonts, lonely).keys()], ['Calibri', 'Garamond']);
});

test('an installed font shows in the editor and makes a style differ', async () => {
  const { cssOf, sameStyle, DEFAULT_STYLE } = await import('../renderer/features/text-edit/style.js');
  assert.ok(cssOf({ ...DEFAULT_STYLE, system: 'Segoe UI' }).fontFamily.startsWith('"Segoe UI"'));
  assert.ok(!sameStyle(DEFAULT_STYLE, { ...DEFAULT_STYLE, system: 'Segoe UI' }));
  assert.ok(sameStyle({ ...DEFAULT_STYLE, system: 'Segoe UI' }, { ...DEFAULT_STYLE, system: 'Segoe UI' }));
});
