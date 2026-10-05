const test = require('node:test');
const assert = require('node:assert');

const load = async () => {
  const { createEngine } = await import('../pdf-engine/engine.js');
  const { makeFormPdf } = await import('./fixtures/make-form.mjs');
  const engine = createEngine();
  const { id } = engine.openDocument(makeFormPdf());
  return { engine, id, makeFormPdf };
};

const field = (engine, id, name, at = 0) => engine.listFormFields(id, 0).filter((f) => f.name === name)[at];
const inkIn = (page, { x, y, w, h }) => {
  let dark = 0;
  for (let py = Math.floor(y); py < y + h; py++) {
    for (let px = Math.floor(x); px < x + w; px++) if (page.pixels[(py * page.width + px) * 4 + 3] && page.pixels[(py * page.width + px) * 4] < 128) dark++;
  }
  return dark;
};

test('fields are listed top to bottom in page space, without push buttons', async () => {
  const { engine, id } = await load();
  const fields = engine.listFormFields(id, 0);
  assert.deepStrictEqual(fields.map((f) => [f.kind, f.name]), [
    ['text', 'name'], ['text', 'notes'], ['checkbox', 'agree'], ['radio', 'size'], ['radio', 'size'],
    ['combo', 'country'], ['list', 'colors'], ['text', 'locked'],
  ]);
  assert.deepStrictEqual(fields[0].rect, { x: 20, y: 40, w: 180, h: 20 });
  assert.strictEqual(fields[0].maxLen, 12);
  assert.strictEqual(fields[1].multiline, true);
  assert.strictEqual(fields[7].readOnly, true);
  assert.deepStrictEqual(fields[5].options.map((o) => o.value), ['Spain', 'France', 'Italy']);
  assert.deepStrictEqual(fields[6].options, [{ label: 'Red', value: 'r' }, { label: 'Green', value: 'g' }, { label: 'Blue', value: 'b' }]);
  assert.deepStrictEqual(fields.slice(3, 5).map((f) => f.on), ['S', 'M']);
});

test('text, choices and checkboxes take values and show them on the page', async () => {
  const { engine, id } = await load();
  const name = field(engine, id, 'name');
  assert.strictEqual(inkIn(engine.renderPage(id, 0, 1), { x: 24, y: 42, w: 100, h: 16 }), 0);
  engine.setFormValue(id, 0, name.key, 'Ana García');
  assert.strictEqual(field(engine, id, 'name').value, 'Ana García');
  assert.ok(inkIn(engine.renderPage(id, 0, 1), { x: 24, y: 42, w: 100, h: 16 }) > 0, 'the text is drawn');

  engine.setFormValue(id, 0, name.key, '123456789012345');
  assert.strictEqual(field(engine, id, 'name').value, '123456789012', 'cut to the field\'s limit');
  engine.setFormValue(id, 0, name.key, '');
  assert.strictEqual(field(engine, id, 'name').value, '');

  engine.setFormValue(id, 0, field(engine, id, 'country').key, 'France');
  engine.setFormValue(id, 0, field(engine, id, 'colors').key, 'g');
  assert.strictEqual(field(engine, id, 'country').value, 'France');
  assert.strictEqual(field(engine, id, 'colors').value, 'g');

  const agree = field(engine, id, 'agree');
  engine.setFormValue(id, 0, agree.key, 'Yes');
  engine.setFormValue(id, 0, agree.key, 'Yes');
  assert.strictEqual(field(engine, id, 'agree').value, 'Yes', 'setting a state twice does not flip it back');
  engine.setFormValue(id, 0, agree.key, 'Off');
  assert.strictEqual(field(engine, id, 'agree').value, 'Off');
});

test('choosing a radio button turns the one that was on off, and Off clears the group', async () => {
  const { engine, id } = await load();
  const [small, medium] = [0, 1].map((at) => field(engine, id, 'size', at));
  engine.setFormValue(id, 0, small.key, 'S');
  assert.strictEqual(field(engine, id, 'size', 1).value, 'S', 'the group has one value');
  engine.setFormValue(id, 0, medium.key, 'M');
  assert.strictEqual(field(engine, id, 'size').value, 'M');
  engine.setFormValue(id, 0, medium.key, 'S'); // what undoing a change back to S does
  assert.strictEqual(field(engine, id, 'size').value, 'S');
  engine.setFormValue(id, 0, small.key, 'Off');
  assert.strictEqual(field(engine, id, 'size').value, 'Off');
});

test('read-only fields and unknown keys are refused', async () => {
  const { engine, id } = await load();
  assert.throws(() => engine.setFormValue(id, 0, field(engine, id, 'locked').key, 'x'), /read-only/);
  assert.throws(() => engine.setFormValue(id, 0, '9999', 'x'), /no longer on the page/);
  assert.throws(() => engine.setFormValue(id, 0, field(engine, id, 'name').key, 5), /not a value/);
});

test('filled values survive saving and reopening', async () => {
  const { engine, id } = await load();
  engine.setFormValue(id, 0, field(engine, id, 'name').key, 'Ana');
  engine.setFormValue(id, 0, field(engine, id, 'agree').key, 'Yes');
  engine.setFormValue(id, 0, field(engine, id, 'size', 1).key, 'M');
  engine.setFormValue(id, 0, field(engine, id, 'country').key, 'Italy');
  const reopened = engine.openDocument(engine.save(id)).id;
  assert.deepStrictEqual(
    ['name', 'agree', 'size', 'country'].map((n) => field(engine, reopened, n).value),
    ['Ana', 'Yes', 'M', 'Italy'],
  );
  assert.ok(inkIn(engine.renderPage(reopened, 0, 1), { x: 24, y: 42, w: 100, h: 16 }) > 0);
});

test('a document without a form has no fields, and fields keep their place on a rotated page', async () => {
  const { engine, id } = await load();
  const before = field(engine, id, 'name').rect;
  engine.rotatePage(id, 0, 90);
  const after = field(engine, id, 'name').rect;
  assert.deepStrictEqual(after, { x: 400 - before.y - before.h, y: before.x, w: before.h, h: before.w });
  const { makePdf } = await import('./fixtures/make-pdf.mjs');
  assert.deepStrictEqual(engine.listFormFields(engine.openDocument(makePdf(['plain'])).id, 0), []);
});
