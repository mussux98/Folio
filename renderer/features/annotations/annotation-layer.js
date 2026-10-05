import { PALETTE, DRAW_PALETTE, WIDTHS, toCss } from './colors.js';
import { DRAWN, BOXED, boxOf, hits, movedBy, resizedBy, centredAt } from './shapes.js';
import { shapeSvg } from './shape-svg.js';
import { drawShape } from './drawing.js';

const BAR_ROOM = 40; // points above a box needed to show the bar over it
const NOTE_SIZE = 20; // points: the icon of a new note
const STAMP_SIZE = { w: 160, h: 40 }; // points: the most a new stamp takes; it is fitted to its words
const HIT_PAD = 1; // points a click may miss a markup line by
const SHAPE_PAD = 2; // points between a shape and its selection box
const MIN_DRAG = 0.5; // points; smaller than this was a click, not a move
const CORNERS = ['nw', 'ne', 'sw', 'se'];

const el = (tag, className, props = {}) => Object.assign(document.createElement(tag), { className, ...props });

function place(node, { x, y, w, h }) {
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  node.style.width = `${w}px`;
  node.style.height = `${h}px`;
}

const padded = ({ x, y, w, h }, pad) => ({ x: x - pad, y: y - pad, w: w + 2 * pad, h: h + 2 * pad });

// A button that keeps the focus where it was, so a note being typed is not
// closed by a click on the bar.
function barButton(label, title, onClick) {
  const button = el('button', '', { textContent: label, title });
  button.setAttribute('aria-label', title);
  button.addEventListener('mousedown', (event) => event.preventDefault());
  button.addEventListener('click', onClick);
  return button;
}

// The buttons over a selected markup line or shape: colours, line thickness and delete.
function buildBar(placement, handlers) {
  const { type } = placement.spec;
  const drawn = DRAWN.includes(type);
  const bar = el('div', 'anno-bar');
  bar.addEventListener('pointerdown', (event) => event.stopPropagation());
  for (const [name, color] of drawn ? DRAW_PALETTE : PALETTE) {
    const swatch = barButton('', name, () => handlers.recolor(placement, color));
    swatch.className = 'anno-swatch';
    swatch.style.background = toCss(color);
    bar.append(swatch);
  }
  if (drawn && type !== 'Stamp') {
    for (const width of WIDTHS) {
      const button = barButton('', `Line ${width} pt thick`, () => handlers.change(placement, { width }));
      button.className = placement.spec.width === width ? 'anno-width current' : 'anno-width';
      button.append(el('span', '', { style: `height: calc(${width}px / var(--z))` }));
      bar.append(button);
    }
  }
  const what = drawn ? 'this drawing' : 'this markup';
  bar.append(barButton('Delete', `Delete ${what} (Delete key)`, () => handlers.remove(placement)));
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

// The layer over one page for annotations. Like the other layers it is built in PDF
// points and scaled by --z. The annotations themselves are part of the page; this
// layer shows what is selected, takes clicks on notes, drags of the selected shape,
// and the drawing of new ones.
// items: [{ placement }] with placement.spec as listed by the engine.
// handlers: { isSelected(placement), select(placement | null), tool(), toolDone(), look(type),
//   create(spec), edit(placement, text), recolor(placement, color), change(placement, changes),
//   remove(placement) }. tool() is null or { kind, icon }, kind being 'Note', 'Stamp' or a drawing tool.
export function buildAnnotationLayer({ items, width, height, handlers }) {
  const layer = el('div', 'anno-layer');
  layer.style.width = `${width}px`;
  layer.style.height = `${height}px`;
  const page = { width, height };
  const entries = [];

  const pointOf = ({ clientX, clientY }) => {
    const box = layer.getBoundingClientRect();
    const scale = width / box.width;
    return { x: (clientX - box.left) * scale, y: (clientY - box.top) * scale };
  };

  // A note being written, not yet in the file: nothing is added if it stays empty.
  function openDraft(point) {
    const rect = centredAt(point, NOTE_SIZE, NOTE_SIZE, page);
    const anchor = el('div', 'anno-anchor open');
    place(anchor, rect);
    let done = false;
    const { box, area } = buildEditor({
      text: '',
      onFinish(text) {
        if (done) return;
        done = true;
        anchor.remove();
        if (text.trim()) handlers.create({ type: 'Text', rects: [rect], contents: text.trim() });
      },
    });
    anchor.append(box);
    layer.append(anchor);
    area.focus();
  }

  layer.addEventListener('pointerdown', (event) => {
    const tool = handlers.tool();
    if (event.target !== layer || event.button !== 0 || !tool) return;
    event.preventDefault();
    const point = pointOf(event);
    if (tool.kind === 'Note') {
      handlers.toolDone();
      openDraft(point);
    } else if (tool.kind === 'Stamp') {
      handlers.toolDone();
      handlers.create({ type: 'Stamp', icon: tool.icon, rects: [centredAt(point, STAMP_SIZE.w, STAMP_SIZE.h, page)] });
    } else {
      const look = handlers.look(tool.kind === 'Arrow' ? 'Line' : tool.kind);
      drawShape({ layer, page, tool: tool.kind, event, look, onDone(spec) {
        handlers.toolDone();
        handlers.create(spec);
      } });
    }
  });

  // Moves the selected shape, or resizes it from a corner, while the button is down.
  // changesFor(dx, dy) turns the pointer's travel in points into the changes to make.
  function drag(event, node, placement, changesFor) {
    event.stopPropagation();
    event.preventDefault();
    const box = layer.getBoundingClientRect();
    const scale = width / box.width;
    const start = { x: event.clientX, y: event.clientY };
    let changes = null;
    let ghost = null;
    const move = (e) => {
      const dx = (e.clientX - start.x) * scale;
      const dy = (e.clientY - start.y) * scale;
      if (!changes && Math.hypot(dx, dy) < MIN_DRAG) return;
      changes = changesFor(dx, dy);
      const spec = { ...placement.spec, ...changes };
      ghost?.remove();
      ghost = shapeSvg(spec, width, height);
      layer.append(ghost);
      place(node, padded(boxOf(spec), SHAPE_PAD));
      layer.classList.add('dragging');
    };
    const end = (e) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      layer.classList.remove('dragging');
      // The click that ends a drag is not a click on the page.
      if (changes) {
        const swallow = (click) => click.stopPropagation();
        window.addEventListener('click', swallow, true);
        setTimeout(() => window.removeEventListener('click', swallow, true));
      }
      if (e.type === 'pointercancel' || !changes) {
        ghost?.remove();
        place(node, padded(boxOf(placement.spec), SHAPE_PAD));
      } else {
        // The ghost stays until the page shows the shape in its new place.
        handlers.change(placement, changes);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  function addNote(placement) {
    const { rects, contents } = placement.spec;
    const note = el('div', 'anno-note');
    place(note, rects[0]);
    note.title = contents;
    const anchor = el('div', 'anno-anchor');
    place(anchor, { x: 0, y: 0, w: rects[0].w, h: rects[0].h });
    const { box, area } = buildEditor({
      text: contents,
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
    return note;
  }

  function addMark(placement) {
    const { rects } = placement.spec;
    const mark = el('div', 'anno-mark');
    for (const rect of rects) {
      const part = el('div', 'anno-rect');
      place(part, rect);
      mark.append(part);
    }
    const first = rects[0];
    const anchor = el('div', first.y < BAR_ROOM ? 'anno-anchor below' : 'anno-anchor');
    place(anchor, first);
    anchor.append(buildBar(placement, handlers));
    mark.append(anchor);
    return mark;
  }

  // A drawn shape's selection box: dragged to move it, with corners to resize a box shape.
  function addShape(placement) {
    const { type } = placement.spec;
    const box = padded(boxOf(placement.spec), SHAPE_PAD);
    const shape = el('div', 'anno-shape');
    place(shape, box);
    shape.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      drag(event, shape, placement, (dx, dy) => movedBy(placement.spec, dx, dy, page));
    });
    if (BOXED.includes(type)) {
      for (const corner of CORNERS) {
        const handle = el('div', `anno-handle ${corner}`);
        handle.addEventListener('pointerdown', (event) => {
          if (event.button !== 0) return;
          const rect = placement.spec.rects[0];
          drag(event, shape, placement, (dx, dy) => ({ rects: [resizedBy(rect, corner, dx, dy, page, type === 'Stamp')] }));
        });
        shape.append(handle);
      }
    }
    const anchor = el('div', box.y < BAR_ROOM ? 'anno-anchor below' : 'anno-anchor');
    place(anchor, { x: 0, y: 0, w: box.w, h: box.h });
    anchor.append(buildBar(placement, handlers));
    shape.append(anchor);
    return shape;
  }

  for (const { placement } of items) {
    const { type } = placement.spec;
    const build = type === 'Text' ? addNote : DRAWN.includes(type) ? addShape : addMark;
    const node = build(placement);
    entries.push({ placement, node });
    layer.append(node);
  }

  const markHit = (spec, point) => spec.rects.some(
    ({ x, y, w, h }) => point.x >= x - HIT_PAD && point.x <= x + w + HIT_PAD && point.y >= y - HIT_PAD && point.y <= y + h + HIT_PAD,
  );

  return {
    el: layer,
    // The markup or shape under a point, or null. They take no clicks themselves, so
    // that text can still be selected over them.
    hit(point) {
      const found = entries.filter(({ placement }) => placement.spec.type !== 'Text').findLast(({ placement }) => {
        const { spec } = placement;
        return DRAWN.includes(spec.type) ? hits(spec, point) : markHit(spec, point);
      });
      return found?.placement ?? null;
    },
    pointOf,
    // Shows which annotation is selected.
    update() {
      for (const { placement, node } of entries) node.classList.toggle('selected', handlers.isSelected(placement));
    },
  };
}
