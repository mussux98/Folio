import { PALETTE, toCss } from './colors.js';

const BAR_ROOM = 40; // points above a box needed to show the bar over it
const NOTE_SIZE = 20; // points: the icon of a new note
const HIT_PAD = 1; // points a click may miss a markup line by

const el = (tag, className, props = {}) => Object.assign(document.createElement(tag), { className, ...props });

function place(node, { x, y, w, h }) {
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  node.style.width = `${w}px`;
  node.style.height = `${h}px`;
}

// A button that keeps the focus where it was, so a note being typed is not
// closed by a click on the bar.
function barButton(label, title, onClick) {
  const button = el('button', '', { textContent: label, title });
  button.setAttribute('aria-label', title);
  button.addEventListener('mousedown', (event) => event.preventDefault());
  button.addEventListener('click', onClick);
  return button;
}

// The buttons over a selected markup line: colours and delete.
function buildMarkBar(placement, handlers) {
  const bar = el('div', 'anno-bar');
  bar.addEventListener('pointerdown', (event) => event.stopPropagation());
  for (const [name, color] of PALETTE) {
    const swatch = barButton('', name, () => handlers.recolor(placement, color));
    swatch.className = 'anno-swatch';
    swatch.style.background = toCss(color);
    bar.append(swatch);
  }
  bar.append(barButton('Delete', 'Delete this markup (Delete key)', () => handlers.remove(placement)));
  return bar;
}

// A box to type a note in. It finishes when the focus leaves it (or on Ctrl+Enter);
// Esc puts back what was there. onFinish(text) is called once per focus.
function buildEditor({ text, onFinish, onDelete }) {
  const box = el('div', 'anno-editor');
  const area = el('textarea', '', { value: text, rows: 4, placeholder: 'Type a note' });
  area.setAttribute('aria-label', 'Note');
  area.addEventListener('blur', () => onFinish(area.value));
  area.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') area.value = text;
    if (event.key === 'Escape' || (event.key === 'Enter' && event.ctrlKey)) {
      event.preventDefault();
      area.blur();
    }
  });
  box.append(area);
  if (onDelete) box.append(barButton('Delete', 'Delete this note', onDelete));
  return { box, area };
}

// The layer over one page for text markup and notes. Like the other layers it is
// built in PDF points and scaled by --z. The markup itself is part of the page; this
// layer only shows what is selected and takes clicks on notes.
// items: [{ placement }] with placement.spec = { type, rects, color, contents }.
// handlers: { isSelected(placement), select(placement | null), noteArmed(), disarm(),
//   create(rect, text), edit(placement, text), recolor(placement, color), remove(placement) }
export function buildAnnotationLayer({ items, width, height, handlers }) {
  const layer = el('div', 'anno-layer');
  layer.style.width = `${width}px`;
  layer.style.height = `${height}px`;
  const entries = [];

  const pointOf = ({ clientX, clientY }) => {
    const box = layer.getBoundingClientRect();
    const scale = width / box.width;
    return { x: (clientX - box.left) * scale, y: (clientY - box.top) * scale };
  };

  // A note being written, not yet in the file: nothing is added if it stays empty.
  function openDraft(point) {
    const rect = {
      x: Math.min(Math.max(point.x - NOTE_SIZE / 2, 0), width - NOTE_SIZE),
      y: Math.min(Math.max(point.y - NOTE_SIZE / 2, 0), height - NOTE_SIZE),
      w: NOTE_SIZE,
      h: NOTE_SIZE,
    };
    const anchor = el('div', 'anno-anchor open');
    place(anchor, rect);
    let done = false;
    const { box, area } = buildEditor({
      text: '',
      onFinish(text) {
        if (done) return;
        done = true;
        anchor.remove();
        if (text.trim()) handlers.create(rect, text.trim());
      },
    });
    anchor.append(box);
    layer.append(anchor);
    area.focus();
  }

  layer.addEventListener('pointerdown', (event) => {
    if (event.target !== layer || event.button !== 0 || !handlers.noteArmed()) return;
    handlers.disarm();
    event.preventDefault();
    openDraft(pointOf(event));
  });

  for (const { placement } of items) {
    const { type, rects } = placement.spec;
    if (type === 'Text') {
      const note = el('div', 'anno-note');
      place(note, rects[0]);
      note.title = placement.spec.contents;
      const anchor = el('div', 'anno-anchor');
      place(anchor, { x: 0, y: 0, w: rects[0].w, h: rects[0].h });
      const { box, area } = buildEditor({
        text: placement.spec.contents,
        onFinish: (text) => handlers.edit(placement, text),
        onDelete: () => handlers.remove(placement),
      });
      anchor.append(box);
      note.append(anchor);
      note.addEventListener('click', (event) => {
        if (box.contains(event.target)) return;
        handlers.select(placement);
        area.focus();
      });
      note.addEventListener('pointerdown', (event) => event.stopPropagation());
      entries.push({ placement, node: note });
      layer.append(note);
    } else {
      const mark = el('div', 'anno-mark');
      for (const rect of rects) {
        const part = el('div', 'anno-rect');
        place(part, rect);
        mark.append(part);
      }
      const first = rects[0];
      const anchor = el('div', first.y < BAR_ROOM ? 'anno-anchor below' : 'anno-anchor');
      place(anchor, first);
      anchor.append(buildMarkBar(placement, handlers));
      mark.append(anchor);
      entries.push({ placement, node: mark });
      layer.append(mark);
    }
  }

  return {
    el: layer,
    // The markup under a point, or null. Markup lines take no clicks themselves, so
    // that text can still be selected over them.
    hit(point) {
      const found = entries.filter(({ placement }) => placement.spec.type !== 'Text').findLast(({ placement }) => placement.spec.rects.some(
        ({ x, y, w, h }) => point.x >= x - HIT_PAD && point.x <= x + w + HIT_PAD && point.y >= y - HIT_PAD && point.y <= y + h + HIT_PAD,
      ));
      return found?.placement ?? null;
    },
    pointOf,
    // Shows which annotation is selected.
    update() {
      for (const { placement, node } of entries) node.classList.toggle('selected', handlers.isSelected(placement));
    },
  };
}
