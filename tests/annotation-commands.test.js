const test = require('node:test');
const assert = require('node:assert');

const load = async () => {
  const { createEngine } = await import('../pdf-engine/engine.js');
  const { makePdf } = await import('./fixtures/make-pdf.mjs');
  const commands = await import('../renderer/commands/annotation.js');
  const engine = createEngine();
  const { id: docId } = engine.openDocument(makePdf(['hi', 'there']));
  // The engine's calls are synchronous; the app's client answers with promises.
  const wrapped = Object.fromEntries(['addAnnotation', 'changeAnnotation', 'removeAnnotation']
    .map((name) => [name, async (...args) => engine[name](...args)]));
  const target = { engine: wrapped, docId };
  const markup = (index) => ({ index, key: null, spec: { type: 'Highlight', rects: [{ x: 10, y: 10, w: 60, h: 12 }], color: [1, 0.75, 0], contents: '' } });
  const shown = (index = 0) => engine.listAnnotations(docId, index).map(({ type, contents }) => [type, contents]);
  return { commands, target, markup, shown };
};

test('placing, recolouring and deleting markup can each be undone and redone', async () => {
  const { commands, target, markup, shown } = await load();
  const placement = markup(0);
  const place = commands.placeAnnotation(target, placement);
  await place.execute();
  assert.deepStrictEqual(shown(), [['Highlight', '']]);

  const recolour = commands.changeAnnotation(target, placement, { color: [0, 1, 0] });
  await recolour.execute();
  assert.deepStrictEqual(placement.spec.color, [0, 1, 0]);
  await recolour.undo();
  assert.deepStrictEqual(placement.spec.color, [1, 0.75, 0]);
  await recolour.execute();

  const remove = commands.removeAnnotation(target, placement);
  await remove.execute();
  assert.deepStrictEqual(shown(), []);
  await remove.undo();
  assert.deepStrictEqual(shown(), [['Highlight', '']], 'comes back, even though its key is new');
  assert.deepStrictEqual(placement.spec.color, [0, 1, 0]);

  await recolour.undo();
  await place.undo();
  assert.deepStrictEqual(shown(), []);
  await place.execute();
  assert.deepStrictEqual(shown(), [['Highlight', '']]);
});

test('editing a note changes its text and undoing puts the old text back', async () => {
  const { commands, target, shown } = await load();
  const note = { index: 0, key: null, spec: { type: 'Text', rects: [{ x: 20, y: 20, w: 20, h: 20 }], color: [1, 0.85, 0], contents: 'first' } };
  await commands.placeAnnotation(target, note).execute();
  const edit = commands.changeAnnotation(target, note, { contents: 'second' });
  await edit.execute();
  assert.deepStrictEqual(shown(), [['Text', 'second']]);
  await edit.undo();
  assert.deepStrictEqual(shown(), [['Text', 'first']]);
});

test('markup over several pages is one undo step', async () => {
  const { commands, target, markup, shown } = await load();
  const both = commands.together([markup(0), markup(1)].map((placement) => commands.placeAnnotation(target, placement)));
  assert.deepStrictEqual(both.pages, [0, 1]);
  await both.execute();
  assert.strictEqual(shown(0).length + shown(1).length, 2);
  await both.undo();
  assert.strictEqual(shown(0).length + shown(1).length, 0);
});
