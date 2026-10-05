// Freehand ink, rectangles, ellipses, lines and arrows, and text stamps. Like the
// markup in annotations.js, positions are in page space and MuPDF.js converts
// them to the file's PDF space. Points are { x, y }; boxes are { x, y, w, h }.
import * as mupdf from '../node_modules/mupdf/dist/mupdf.js';

export const DRAWN = ['Ink', 'Square', 'Circle', 'Line', 'Stamp'];
const BOXED = ['Square', 'Circle', 'Stamp'];

const toPoint = ({ x, y }) => [x, y];
const fromPoint = ([x, y]) => ({ x, y });
const toRect = ({ x, y, w, h }) => [x, y, x + w, y + h];
const fromRect = ([x0, y0, x1, y1]) => ({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });

const turnsOf = (page) => ((page.getObject().getInheritable('Rotate').asNumber() || 0) % 360 + 360) % 360;

// MuPDF draws a stamp's words in the file's own space, so on a turned page they
// come out sideways, squeezed into a box of the wrong shape. The appearance is
// made for a box the right way round, then turned back by the page's /Rotate, and
// the annotation's rect is written straight into the file to fit the turned picture.
function uprightStamp(page, annot, box) {
  const turns = turnsOf(page);
  const sideways = turns % 180 !== 0;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const [w, h] = sideways ? [box.h, box.w] : [box.w, box.h];
  annot.setRect([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]);
  annot.update();
  if (!turns) return;
  // MuPDF shrank one side to fit the words; that is the size on screen, the other way round.
  const made = fromRect(annot.getRect());
  const [fw, fh] = sideways ? [made.h, made.w] : [made.w, made.h];
  const toPdf = mupdf.Matrix.invert(page.getTransform());
  const [c, s] = { 90: [0, 1], 180: [-1, 0], 270: [0, -1] }[turns];
  annot.getObject().get('AP', 'N').put('Matrix', [c, s, -s, c, 0, 0]);
  annot.getObject().put('Rect', mupdf.Rect.transform([cx - fw / 2, cy - fh / 2, cx + fw / 2, cy + fh / 2], toPdf));
  annot.update();
}

// Writes the shape's position. spec: { type, rects?, paths?, points?, arrow?, width?, icon? }.
// On a change only the fields given are written.
export function writeShape(annot, { type, rects, paths, points, arrow, width, icon }) {
  if (paths) annot.setInkList(paths.map((path) => path.map(toPoint)));
  if (points) annot.setLine(toPoint(points[0]), toPoint(points[1]));
  if (arrow !== undefined) annot.setLineEndingStyles('None', arrow ? 'OpenArrow' : 'None');
  if (rects && type !== 'Stamp') annot.setRect(toRect(rects[0]));
  if (width !== undefined && type !== 'Stamp') annot.setBorderWidth(width);
  if (icon) annot.setIcon(icon);
}

// Brings the appearance up to date. A stamp keeps the box it was given, or its own.
export function refreshShape(page, annot, rects) {
  if (annot.getType() === 'Stamp') uprightStamp(page, annot, rects?.[0] ?? fromRect(annot.getRect()));
  else annot.update();
}

// The shape's position and look, in the same fields writeShape takes.
export function readShape(annot) {
  const type = annot.getType();
  const shape = {};
  if (BOXED.includes(type)) shape.rects = [fromRect(annot.getRect())];
  if (type === 'Ink') shape.paths = annot.getInkList().map((path) => path.map(fromPoint));
  if (type === 'Line') {
    shape.points = annot.getLine().map(fromPoint);
    const { start, end } = annot.getLineEndingStyles();
    shape.arrow = start !== 'None' || end !== 'None';
  }
  if (type === 'Stamp') shape.icon = annot.getIcon();
  else shape.width = annot.getBorderWidth();
  return shape;
}
