// Text markup (highlight, underline, strikethrough) and sticky notes. Positions
// are in page space (see coords.js): MuPDF.js converts annotation rects and quad
// points to and from the file's PDF space itself, including /Rotate and the crop box.
import * as mupdf from '../node_modules/mupdf/dist/mupdf.js';

const MARKUP = ['Highlight', 'Underline', 'StrikeOut'];
const KINDS = [...MARKUP, 'Text'];

// An annotation is named by its object number, which stays the same while the
// document is open. Putting a deleted one back gives it a new number.
const keyOf = (annot) => String(annot.getObject().asIndirect());

const quadOf = ({ x, y, w, h }) => [x, y, x + w, y, x, y + h, x + w, y + h];
const rectOf = ([x0, y0, x1, y1, x2, y2, x3, y3]) => {
  const xs = [x0, x1, x2, x3];
  const ys = [y0, y1, y2, y3];
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};

// MuPDF draws a highlight with rounded ends that spill past the text. This swaps its
// appearance for plain boxes, keeping the multiply blend that lets the text show through.
function squareHighlight(annot) {
  const points = annot.getObject().get('QuadPoints');
  const [r, g, b] = annot.getColor();
  const boxes = [];
  for (let i = 0; i + 7 < points.length; i += 8) {
    const xs = [0, 2, 4, 6].map((k) => points.get(i + k).asNumber());
    const ys = [1, 3, 5, 7].map((k) => points.get(i + k).asNumber());
    const [x, y] = [Math.min(...xs), Math.min(...ys)];
    boxes.push(`${x} ${y} ${Math.max(...xs) - x} ${Math.max(...ys) - y} re`);
  }
  const lines = ['/H gs', `${r} ${g} ${b} rg`, ...boxes, 'f'];
  annot.getObject().get('AP', 'N').writeStream(`${lines.join('\n')}\n`);
}

// Brings the appearance up to date after the annotation changed.
function refresh(annot) {
  annot.update();
  if (annot.getType() === 'Highlight') squareHighlight(annot);
}

export function createAnnotations(withPage) {
  function find(page, key) {
    const annot = page.getAnnotations().find((a) => KINDS.includes(a.getType()) && keyOf(a) === key);
    if (!annot) throw new Error('That annotation is no longer on the page.');
    return annot;
  }

  const describe = (annot) => {
    const type = annot.getType();
    const rects = type === 'Text'
      ? [(([x0, y0, x1, y1]) => ({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }))(annot.getRect())]
      : annot.getQuadPoints().map(rectOf);
    return { key: keyOf(annot), type, rects, color: annot.getColor(), contents: annot.getContents() };
  };

  // spec: { type, rects, color, contents }. A note has one rect, the size of its icon.
  function add(index, { type, rects, color, contents = '' }) {
    if (!KINDS.includes(type)) throw new Error('That kind of annotation is not supported.');
    return withPage(index, (page) => {
      const annot = page.createAnnotation(type);
      annot.setFlags(mupdf.PDFAnnotation.IS_PRINT);
      if (type === 'Text') {
        const [{ x, y, w, h }] = rects;
        annot.setRect([x, y, x + w, y + h]);
        annot.setIcon('Note');
      } else {
        annot.setQuadPoints(rects.map(quadOf));
      }
      annot.setColor(color);
      if (contents) annot.setContents(contents);
      refresh(annot);
      return keyOf(annot);
    });
  }

  // changes: { color?, contents?, rects? } (rects only for a note, which can be moved).
  function change(index, key, { color, contents, rects }) {
    withPage(index, (page) => {
      const annot = find(page, key);
      if (color) annot.setColor(color);
      if (contents !== undefined) annot.setContents(contents);
      if (rects) {
        const [{ x, y, w, h }] = rects;
        annot.setRect([x, y, x + w, y + h]);
      }
      refresh(annot);
    });
  }

  function remove(index, key) {
    withPage(index, (page) => page.deleteAnnotation(find(page, key)));
  }

  function list(index) {
    return withPage(index, (page) => page.getAnnotations().filter((a) => KINDS.includes(a.getType())).map(describe));
  }

  return { add, change, remove, list };
}
