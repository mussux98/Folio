import { cssOf, toHex, fromHex } from './style.js';
import { createFontPicker } from './font-picker.js';

const BAR_ROOM = 40; // points above the box needed to show the bar over it
const MIN_SIZE = 4;
const MAX_SIZE = 144;

function control(tag, title, props = {}) {
  const el = Object.assign(document.createElement(tag), props);
  el.title = title;
  el.setAttribute('aria-label', title);
  return el;
}

// The bar over the editor that changes the style. onChange gets the new style.
// The font list offers the document's fonts (faces: [{ label, family }]), the
// standard families and the installed fonts (see font-picker.js).
function buildBar(style, faces, onChange, onDone, refocus) {
  const bar = document.createElement('div');
  bar.className = 'text-bar';

  const start = style.system ? { kind: 'system', name: style.system }
    : style.face ? { kind: 'face', name: style.face } : { kind: 'standard', name: style.family };
  const fonts = createFontPicker({ faces, choice: start, onPick: () => { onChange(read()); refocus(); } });
  const size = control('input', 'Size in points', { type: 'number', min: MIN_SIZE, max: MAX_SIZE, step: 0.5, value: String(Math.round(style.size * 2) / 2) });
  const bold = control('button', 'Bold', { textContent: 'B', className: 'bold' });
  const italic = control('button', 'Italic', { textContent: 'I', className: 'italic' });
  const color = control('input', 'Colour', { type: 'color', value: toHex(style.color) });
  const done = control('button', 'Done (Enter)', { textContent: 'Done', className: 'done' });

  const read = () => {
    const { kind, name } = fonts.choice();
    return {
      family: kind === 'face' ? faces.find(({ label }) => label === name)?.family ?? 'sans' : kind === 'standard' ? name : style.family,
      face: kind === 'face' ? name : null,
      system: kind === 'system' ? name : null,
      bold: bold.classList.contains('on'),
      italic: italic.classList.contains('on'),
      size: Math.min(MAX_SIZE, Math.max(MIN_SIZE, Number(size.value) || style.size)),
      color: fromHex(color.value),
    };
  };

  for (const [button, on] of [[bold, style.bold], [italic, style.italic]]) {
    button.classList.toggle('on', on);
    button.addEventListener('click', () => {
      button.classList.toggle('on');
      onChange(read());
    });
  }
  size.addEventListener('input', () => onChange(read()));
  color.addEventListener('input', () => onChange(read()));
  done.addEventListener('click', onDone);

  bar.append(fonts.el, size, bold, italic, color, done);
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
  const { bar } = buildBar(style, faces, apply, () => onFinish(true), () => field.focus());
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
