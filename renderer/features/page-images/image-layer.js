import { movedBy, resizedBy } from '../signatures/geometry.js';

const CORNERS = ['nw', 'ne', 'sw', 'se'];
const BAR_ROOM = 40; // points above a box needed to show the bar over it
const MIN_DRAG = 0.5; // points; smaller than this was a click, not a move

function place(el, { x, y, w, h }) {
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
}

// The layer over one page where its pictures are chosen while Edit Images is on.
// It is built in PDF points and scaled by --z like the other layers, and uses
// the signature boxes' look. Dragging a picture or a corner lifts it out of the
// page into a stamp where it was dropped.
// pictures: [{ id, x, y, w, h }] from the engine.
// handlers: { isSelected(id), select(id | null), lift(id, rect), remove(id) }
export function buildImageLayer({ pictures, width, height, handlers }) {
  const el = document.createElement('div');
  el.className = 'image-layer';
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  const page = { width, height };
  const boxes = [];

  const pointsPerPixel = () => width / el.getBoundingClientRect().width;

  function drag(event, box, picture, rectFor) {
    event.stopPropagation();
    event.preventDefault();
    handlers.select(picture.id);
    const start = { x: event.clientX, y: event.clientY };
    const scale = pointsPerPixel();
    let rect = picture;
    box.setPointerCapture(event.pointerId);
    const move = (e) => {
      rect = rectFor(picture, (e.clientX - start.x) * scale, (e.clientY - start.y) * scale);
      place(box, rect);
    };
    const end = (e) => {
      box.removeEventListener('pointermove', move);
      box.removeEventListener('pointerup', end);
      box.removeEventListener('pointercancel', end);
      if (e.type === 'pointercancel') place(box, picture);
      else if (Math.hypot(rect.x - picture.x, rect.y - picture.y, rect.w - picture.w) > MIN_DRAG) handlers.lift(picture.id, rect);
    };
    box.addEventListener('pointermove', move);
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
  }

  for (const picture of pictures) {
    const box = document.createElement('div');
    box.className = 'sign-box image-box';
    box.title = 'Drag to move, or select and delete';
    place(box, picture);
    box.addEventListener('pointerdown', (event) => {
      if (event.button === 0) drag(event, box, picture, (from, dx, dy) => movedBy(from, dx, dy, page));
    });
    for (const corner of CORNERS) {
      const handle = document.createElement('div');
      handle.className = `sign-handle ${corner}`;
      handle.addEventListener('pointerdown', (event) => {
        if (event.button === 0) drag(event, box, picture, (from, dx, dy) => resizedBy(from, corner, dx, dy, page));
      });
      box.append(handle);
    }
    const bar = document.createElement('div');
    bar.className = picture.y < BAR_ROOM ? 'sign-bar below' : 'sign-bar';
    bar.addEventListener('pointerdown', (event) => event.stopPropagation());
    const remove = document.createElement('button');
    remove.textContent = 'Delete';
    remove.title = 'Delete this picture from the page (Delete key)';
    remove.setAttribute('aria-label', remove.title);
    remove.addEventListener('click', () => handlers.remove(picture.id));
    bar.append(remove);
    box.append(bar);
    boxes.push({ box, picture });
    el.append(box);
  }

  return {
    el,
    update() {
      for (const { box, picture } of boxes) box.classList.toggle('selected', handlers.isSelected(picture.id));
    },
  };
}
