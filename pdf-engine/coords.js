// Converting positions between the three spaces Folio uses (rule 21):
//   PDF:    points in the file's own user space, y up, before /Rotate and the crop box.
//           This is what gets written into the PDF.
//   page:   points from the top-left corner of the page as displayed, y down.
//           Everything the engine returns (text, links, search hits) is in this space.
//   screen: CSS pixels from the top-left corner of the page element: page * zoom.
// transform is engine.pageTransform(): the matrix [a, b, c, d, e, f] from PDF to page.
// Points are { x, y }; page rects are { x, y, w, h }; PDF rects are [x0, y0, x1, y1].

export function applyMatrix([a, b, c, d, e, f], { x, y }) {
  return { x: x * a + y * c + e, y: x * b + y * d + f };
}

export function invertMatrix([a, b, c, d, e, f]) {
  const det = a * d - b * c;
  if (!det) throw new Error('This page transform cannot be inverted.');
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

export const pdfToPage = (transform, point) => applyMatrix(transform, point);
export const pageToPdf = (transform, point) => applyMatrix(invertMatrix(transform), point);

export const pageToScreen = ({ x, y }, zoom) => ({ x: x * zoom, y: y * zoom });
export const screenToPage = ({ x, y }, zoom) => ({ x: x / zoom, y: y / zoom });

// The box around the four corners once they are mapped.
function boundsOf(matrix, corners) {
  const points = corners.map((corner) => applyMatrix(matrix, corner));
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export function pageRectToPdf(transform, { x, y, w, h }) {
  return boundsOf(invertMatrix(transform), [{ x, y }, { x: x + w, y }, { x, y: y + h }, { x: x + w, y: y + h }]);
}

export function pdfRectToPage(transform, [x0, y0, x1, y1]) {
  const [left, top, right, bottom] = boundsOf(transform, [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x0, y: y1 }, { x: x1, y: y1 }]);
  return { x: left, y: top, w: right - left, h: bottom - top };
}
