import { drawStrokes, contentBounds } from './ink.js';

const PAD_WIDTH = 560;
const PAD_HEIGHT = 200;
const PEN_WIDTH = 3.2;
const EXPORT_SCALE = 3; // the saved picture is sharper than the pad
const MARGIN = 6;
export const COLORS = { Black: '#111111', Blue: '#1a3d8f' };

// Crops a canvas to a box plus a margin and encodes it as PNG bytes.
export async function cropToPng(source, box, margin = 0) {
  const out = new OffscreenCanvas(box.w + margin * 2, box.h + margin * 2);
  out.getContext('2d').drawImage(source, box.x, box.y, box.w, box.h, margin, margin, box.w, box.h);
  return new Uint8Array(await (await out.convertToBlob({ type: 'image/png' })).arrayBuffer());
}

// A canvas to sign on with mouse, pen or touch. Returns { element, clear, isEmpty, setColor, toPng }.
export function createDrawPad(onChange) {
  const element = document.createElement('canvas');
  element.className = 'sign-pad';
  element.width = PAD_WIDTH * 2;
  element.height = PAD_HEIGHT * 2;
  const ctx = element.getContext('2d');
  const strokes = [];
  let color = COLORS.Black;
  let current = null;

  function redraw() {
    ctx.clearRect(0, 0, element.width, element.height);
    drawStrokes(ctx, strokes, { color, width: PEN_WIDTH, scale: 2 });
  }

  function pointOf(event) {
    const box = element.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * PAD_WIDTH,
      y: ((event.clientY - box.top) / box.height) * PAD_HEIGHT,
      p: event.pointerType === 'pen' && event.pressure > 0 ? event.pressure : 0.5,
    };
  }

  element.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    element.setPointerCapture(event.pointerId);
    current = [pointOf(event)];
    strokes.push(current);
    redraw();
    onChange();
  });
  element.addEventListener('pointermove', (event) => {
    if (!current) return;
    // A fast pen delivers several points per frame.
    const parts = event.getCoalescedEvents?.() ?? [];
    for (const part of parts.length ? parts : [event]) current.push(pointOf(part));
    redraw();
  });
  const finish = () => { current = null; };
  element.addEventListener('pointerup', finish);
  element.addEventListener('pointercancel', finish);

  return {
    element,
    isEmpty: () => strokes.length === 0,
    clear() {
      strokes.length = 0;
      redraw();
      onChange();
    },
    setColor(next) {
      color = next;
      redraw();
    },
    // The ink on a transparent background, trimmed to its edges. Resolves to PNG bytes or null.
    async toPng() {
      const width = PAD_WIDTH * EXPORT_SCALE;
      const height = PAD_HEIGHT * EXPORT_SCALE;
      const big = new OffscreenCanvas(width, height);
      const bigCtx = big.getContext('2d');
      drawStrokes(bigCtx, strokes, { color, width: PEN_WIDTH, scale: EXPORT_SCALE });
      const box = contentBounds(bigCtx.getImageData(0, 0, width, height).data, width, height);
      return box ? cropToPng(big, box, MARGIN * EXPORT_SCALE) : null;
    },
  };
}
