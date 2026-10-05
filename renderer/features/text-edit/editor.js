import { FAMILIES, cssOf, toHex, fromHex } from './style.js';

const BAR_ROOM = 40; // points above the box needed to show the bar over it
const MIN_SIZE = 4;
const MAX_SIZE = 144;

function control(tag, title, props = {}) {
  const el = Object.assign(document.createElement(tag), props);
  el.title = title;
  el.setAttribute('aria-label', title);
  return el;
}

const FACE = 'face:'; // font list values of the document's fonts start with this

// The bar over the editor that changes the style. onChange gets the new style.
// The font list offers the document's fonts (faces: [{ label, family }]) first,
// then the standard families.
function buildBar(style, faces, onChange, onDone) {
  const bar = document.createElement('div');
  bar.className = 'text-bar';

  const family = control('select', 'Font');
  const option = (value, textContent) => family.append(Object.assign(document.createElement('option'), { value, textContent }));
  for (const { label } of faces) option(FACE + label, label);
  for (const [value, label] of FAMILIES) option(value, label);
  family.value = style.face ? FACE + style.face : style.family;
  const picked = () => faces.find(({ label }) => FACE + label === family.value) ?? null;
  const size = control('input', 'Size in points', { type: 'number', min: MIN_SIZE, max: MAX_SIZE, step: 0.5, value: String(Math.round(style.size * 2) / 2) });
  const bold = control('button', 'Bold', { textContent: 'B', className: 'bold' });
  const italic = control('button', 'Italic', { textContent: 'I', className: 'italic' });
  const color = control('input', 'Colour', { type: 'color', value: toHex(style.color) });
  const done = control('button', 'Done (Enter)', { textContent: 'Done', className: 'done' });

  const read = () => ({
    family: picked()?.family ?? family.value,
    face: picked()?.label ?? null,
    bold: bold.classList.contains('on'),
    italic: italic.classList.contains('on'),
    size: Math.min(MAX_SIZE, Math.max(MIN_SIZE, Number(size.value) || style.size)),
    color: fromHex(color.value),
  });

  for (const [button, on] of [[bold, style.bold], [italic, style.italic]]) {
    button.classList.toggle('on', on);
    button.addEventListener('click', () => {
      button.classList.toggle('on');
      onChange(read());
    });
  }
  family.addEventListener('change', () => onChange(read()));
  size.addEventListener('input', () => onChange(read()));
  color.addEventListener('input', () => onChange(read()));
  done.addEventListener('click', onDone);

  bar.append(family, size, bold, italic, color, done);
  return { bar, read };
}

// An editing box placed over a page's edit layer, in points.
// at: { x, y, w, h } where the box goes (w and h are the least it takes up).
// multiline: Enter starts a new line, and Ctrl+Enter finishes.
// faces: the document's fonts for the font list, [{ label, family }].
// onFinish(save) is called on Enter, Done or Esc; the caller then closes it.
export function openEditor({ layer, at, text, style, faces = [], multiline, onFinish }) {
  const el = document.createElement('div');
  el.className = at.y < BAR_ROOM ? 'text-editor below' : 'text-editor';
  el.style.left = `${at.x}px`;
  el.style.top = `${at.y}px`;

  const field = document.createElement('textarea');
  field.value = text;
  field.spellcheck = false;
  field.style.minWidth = `${Math.max(at.w, 8)}px`;
  field.style.minHeight = `${at.h}px`;
  field.style.lineHeight = multiline ? '1.2' : `${at.h}px`;

  let current = style;
  const apply = (next) => {
    current = next;
    Object.assign(field.style, cssOf(next));
  };
  const { bar } = buildBar(style, faces, apply, () => onFinish(true));
  apply(style);

  field.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onFinish(false);
    } else if (event.key === 'Enter' && (!multiline || event.ctrlKey)) {
      event.preventDefault();
      onFinish(true);
    }
  });

  const error = document.createElement('div');
  error.className = 'text-error';
  error.hidden = true;

  el.append(bar, field, error);
  layer.append(el);
  field.focus();
  field.setSelectionRange(text.length, text.length);

  return {
    el,
    value: () => ({ text: field.value, style: current }),
    showError(message) {
      error.textContent = message;
      error.hidden = false;
      field.focus();
    },
    close: () => el.remove(),
  };
}
