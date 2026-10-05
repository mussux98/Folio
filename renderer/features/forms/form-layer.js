const OFF = 'Off';
const MIN_FONT = 6; // points
const MAX_FONT = 16;

const el = (tag, className, props = {}) => Object.assign(document.createElement(tag), { className, ...props });

function place(node, { x, y, w, h }) {
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  node.style.width = `${w}px`;
  node.style.height = `${h}px`;
}

const fontFor = (h) => Math.max(MIN_FONT, Math.min(MAX_FONT, h * 0.7));

// A box to type in. It keeps a change when the focus leaves it (or on Enter in a
// single line); Esc puts back what was there.
function textBox(field, commit) {
  const input = field.multiline ? el('textarea', 'form-input') : el('input', 'form-input', { type: field.password ? 'password' : 'text' });
  input.value = field.value;
  if (field.maxLen > 0) input.maxLength = field.maxLen;
  input.style.fontSize = `${field.multiline ? 12 : fontFor(field.rect.h)}px`;
  input.addEventListener('change', () => commit(field, input.value));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') input.value = field.value;
  });
  return input;
}

function comboBox(field, commit) {
  if (field.editable) {
    const list = el('datalist', '', { id: `form-options-${field.key}` });
    for (const { label, value } of field.options) list.append(el('option', '', { value, label }));
    const input = textBox({ ...field, multiline: false }, commit);
    input.setAttribute('list', list.id);
    return [input, list];
  }
  const select = el('select', 'form-input');
  select.style.fontSize = `${fontFor(field.rect.h)}px`;
  const known = field.options.some((option) => option.value === field.value);
  if (!known) select.append(el('option', '', { value: field.value, textContent: field.value }));
  for (const { label, value } of field.options) select.append(el('option', '', { value, textContent: label }));
  select.value = field.value;
  select.addEventListener('change', () => commit(field, select.value));
  return [select];
}

function listBox(field, commit) {
  const select = el('select', 'form-input', { size: Math.max(2, field.options.length) });
  select.style.fontSize = '12px';
  for (const { label, value } of field.options) select.append(el('option', '', { value, textContent: label }));
  select.value = field.value;
  select.addEventListener('change', () => commit(field, select.value));
  return [select];
}

// A checkbox or radio button is a transparent button over the one the page draws, so the
// page's own look shows through. Pressing a radio button that is on turns the group off.
function toggleBox(field, commit) {
  const radio = field.kind === 'radio';
  const button = el('button', 'form-toggle', { type: 'button' });
  button.setAttribute('role', radio ? 'radio' : 'checkbox');
  button.setAttribute('aria-label', field.label || field.name);
  const checked = () => (radio ? field.value === field.on : field.value !== OFF);
  button.setAttribute('aria-checked', String(checked()));
  button.addEventListener('click', () => {
    const next = checked() ? OFF : field.on;
    commit(field, next);
    button.setAttribute('aria-checked', String(next !== OFF));
  });
  return [button];
}

const BUILDERS = { text: (f, c) => [textBox(f, c)], combo: comboBox, list: listBox, checkbox: toggleBox, radio: toggleBox };

// The layer over one page for its form fields, built in PDF points and scaled by --z like
// the other layers. fields are as the engine lists them, in tab order; commit(field, value)
// is called when the user changes one. Read-only fields are left to the page's own picture.
export function buildFormLayer({ fields, width, height, commit }) {
  const layer = el('div', 'form-layer');
  layer.style.width = `${width}px`;
  layer.style.height = `${height}px`;
  for (const field of fields) {
    if (field.readOnly) continue;
    const [control, ...extra] = BUILDERS[field.kind](field, commit);
    control.classList.add('form-field');
    control.dataset.key = field.key;
    place(control, field.rect);
    layer.append(control, ...extra);
  }
  return layer;
}
