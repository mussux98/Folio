import { movedBy, resizedBy } from './geometry.js';

const CORNERS = ['nw', 'ne', 'sw', 'se'];
const BAR_ROOM = 40; // points above a box needed to show the buttons over it
const MIN_DRAG = 0.5; // points; smaller than this was a click, not a move

function place(el, rect) {
  el.style.left = `${rect.x}px`;
  el.style.top = `${rect.y}px`;
  el.style.width = `${rect.w}px`;
  el.style.height = `${rect.h}px`;
}

// The buttons over a selected signature. They keep their size at any zoom (see the CSS).
function buildBar(placement, rect, handlers) {
  const bar = document.createElement('div');
  bar.className = rect.y < BAR_ROOM ? 'sign-bar below' : 'sign-bar';
  // A press here is a click on a button, never the start of a drag.
  bar.addEventListener('pointerdown', (event) => event.stopPropagation());
  const buttons = [
    ['↺', 'Turn left', () => handlers.turn(placement, -1)],
    ['↻', 'Turn right', () => handlers.turn(placement, 1)],
    ['Replace', 'Use another saved signature', (event) => handlers.replace(placement, event.currentTarget)],
    ['Delete', 'Delete this signature (Delete key)', () => handlers.remove(placement)],
  ];
  for (const [label, title, onClick] of buttons) {
    const button = document.createElement('button');
    button.textContent = label;
    button.title = title;
    button.setAttribute('aria-label', title);
    button.addEventListener('click', onClick);
    bar.append(button);
  }
  return bar;
}

// The layer over one page where signatures are chosen, moved and resized.
// Like the other layers it is built in PDF points and scaled by --z. The picture
// itself is part of the page; the boxes here only take clicks and drags.
// items: [{ rect, placement }].
// handlers: { isSelected(placement), select(placement | null), place(point), change(placement, rect),
//   turn(placement, quarterTurns), replace(placement, button), remove(placement) }
export function buildSignLayer({ items, width, height, handlers }) {
  const el = document.createElement('div');
  el.className = 'sign-layer';
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  const page = { width, height };
  const boxes = [];

  // Points per screen pixel, so drags follow the pointer at any zoom.
  const pointsPerPixel = () => width / el.getBoundingClientRect().width;

  el.addEventListener('pointerdown', (event) => {
    if (event.target !== el || event.button !== 0) return;
    const box = el.getBoundingClientRect();
    const scale = pointsPerPixel();
    const point = { x: (event.clientX - box.left) * scale, y: (event.clientY - box.top) * scale };
    if (!handlers.place(point)) handlers.select(null);
  });

  // Runs a drag: rectFor turns the pointer's travel (in points) into the box's new rect.
  function drag(event, box, placement, rectFor) {
    event.stopPropagation();
    event.preventDefault();
    handlers.select(placement);
    const start = { x: event.clientX, y: event.clientY, rect: placement.rect };
    const scale = pointsPerPixel();
    let rect = start.rect;
    box.setPointerCapture(event.pointerId);
    const move = (e) => {
      rect = rectFor(start.rect, (e.clientX - start.x) * scale, (e.clientY - start.y) * scale);
      place(box, rect);
    };
    const end = (e) => {
      box.removeEventListener('pointermove', move);
      box.removeEventListener('pointerup', end);
      box.removeEventListener('pointercancel', end);
      if (e.type === 'pointercancel') place(box, start.rect);
      else if (Math.hypot(rect.x - start.rect.x, rect.y - start.rect.y, rect.w - start.rect.w) > MIN_DRAG) handlers.change(placement, rect);
    };
    box.addEventListener('pointermove', move);
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
  }

  for (const { rect, placement } of items) {
    const box = document.createElement('div');
    box.className = 'sign-box';
    place(box, rect);
    box.addEventListener('pointerdown', (event) => {
      if (event.button === 0) drag(event, box, placement, (from, dx, dy) => movedBy(from, dx, dy, page));
    });
    for (const corner of CORNERS) {
      const handle = document.createElement('div');
      handle.className = `sign-handle ${corner}`;
      handle.addEventListener('pointerdown', (event) => {
        if (event.button === 0) drag(event, box, placement, (from, dx, dy) => resizedBy(from, corner, dx, dy, page));
      });
      box.append(handle);
    }
    box.append(buildBar(placement, rect, handlers));
    boxes.push({ box, placement });
    el.append(box);
  }

  return {
    el,
    // Shows which box is selected.
    update() {
      for (const { box, placement } of boxes) box.classList.toggle('selected', handlers.isSelected(placement));
    },
  };
}
