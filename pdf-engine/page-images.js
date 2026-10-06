// Pictures that are part of a page's content, such as a scanned signature or a
// logo, as opposed to stamps. One can be deleted, or lifted out into a stamp
// that is then moved and resized like a signature. A picture is named by its
// place in the order the page draws them. Rects are in page space.
// Changes go through the redaction store (redactions.js), so undo and redo
// swap the page's content the same way.
import * as mupdf from '../node_modules/mupdf/dist/mupdf.js';
import { withAlpha } from './signatures.js';

const MOST_OF_PAGE = 0.9; // a picture this much of the page is a scan, not offered
const SMALLEST = 4; // points
const INSET = 0.1; // of each side, so a redaction misses pictures that only touch this one
const LARGEST_SIDE = 3000; // pixels of a lifted picture

// The box around a picture drawn with ctm (it fills the unit square).
function boundsOf([a, b, c, d, e, f]) {
  const corners = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => [x * a + y * c + e, x * b + y * d + f]);
  const xs = corners.map((p) => p[0]);
  const ys = corners.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// Every picture the page's own content draws, in order, with where it goes.
// Annotations are left out, and so are pictures that only make up a mask.
// The images must be released with release().
function drawnPictures(page) {
  const found = [];
  let masks = 0;
  const device = new mupdf.Device({
    beginMask() { masks++; },
    endMask() { masks--; },
    fillImage(image, ctm) {
      if (masks) image.destroy();
      else found.push({ image, ctm: [...ctm] });
    },
  });
  try {
    page.runPageContents(device, mupdf.Matrix.identity);
  } finally {
    device.close();
  }
  return found;
}

const release = (pictures) => pictures.forEach(({ image }) => image.destroy());

// How many times each image is drawn, by the image MuPDF loaded for it.
function counts(pictures) {
  const seen = new Map();
  for (const { image } of pictures) seen.set(image.pointer, (seen.get(image.pointer) ?? 0) + 1);
  return seen;
}

// The image objects the page's resources name, and those of the forms it uses,
// each with every path of names that leads to it from the page: [form, ..., image].
// MuPDF loads a picture once, so a loaded image's pointer leads back to its
// object while both are alive. The images must be destroyed after.
function imageObjects(doc, page) {
  const found = new Map(); // pointer -> { ref, paths, image }
  const visited = new Set();
  function walk(resources, path) {
    // A form may have no resources, like the empty one a deleted picture leaves.
    if (!resources.isDictionary()) return;
    resources.get('XObject').forEach((ref, name) => {
      const value = ref.resolve();
      const subtype = value.get('Subtype').asName();
      if (subtype === 'Image' && ref.isIndirect()) {
        const image = doc.loadImage(ref);
        const { pointer } = image;
        if (!found.has(pointer)) found.set(pointer, { ref, paths: [], image });
        else image.destroy();
        found.get(pointer).paths.push([...path, name]);
      } else if (subtype === 'Form' && ref.isIndirect() && !visited.has(ref.asIndirect())) {
        visited.add(ref.asIndirect());
        walk(value.get('Resources'), [...path, name]);
      }
    });
  }
  walk(page.getObject().getInheritable('Resources'), []);
  return found;
}

// A picture's RGB colours and its transparency (as grey), apart. One with
// transparency is RGB from withAlpha(); any other becomes RGB and solid.
function split(pixmap) {
  const box = [0, 0, pixmap.getWidth(), pixmap.getHeight()];
  const alpha = new mupdf.Pixmap(mupdf.ColorSpace.DeviceGray, box, false);
  alpha.clear(255);
  if (!pixmap.getAlpha()) return { colour: pixmap.convertToColorSpace(mupdf.ColorSpace.DeviceRGB), alpha };
  const colour = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, box, false);
  const from = pixmap.getPixels();
  const rgb = colour.getPixels();
  const a = alpha.getPixels();
  for (let i = 0; i < a.length; i++) {
    rgb.set(from.subarray(i * 4, i * 4 + 3), i * 3);
    a[i] = from[i * 4 + 3];
  }
  return { colour, alpha };
}

// The picture drawn with matrix onto black, at size. MuPDF's drawing loses a
// picture's transparency, so colours and transparency are drawn apart.
function drawn(pixmap, matrix, { width, height }) {
  const out = new mupdf.Pixmap(pixmap.getColorSpace(), [0, 0, width, height], false);
  const image = new mupdf.Image(pixmap);
  try {
    out.clear(0);
    const draw = new mupdf.DrawDevice(mupdf.Matrix.identity, out);
    draw.fillImage(image, matrix, 1);
    draw.close();
    return out;
  } finally {
    image.destroy();
  }
}

function copyOf(doc, dict) {
  const out = doc.newDictionary();
  if (dict.isDictionary()) dict.forEach((value, key) => out.put(key, value));
  return out;
}

export function createPageImages(doc, withPage, redactions) {
  function list(index) {
    return withPage(index, (page) => {
      const [x0, y0, x1, y1] = page.getBounds();
      const pageArea = (x1 - x0) * (y1 - y0);
      const pictures = drawnPictures(page);
      try {
        return pictures.map(({ ctm }, id) => ({ id, ...boundsOf(ctm) }))
          .filter(({ w, h }) => w >= SMALLEST && h >= SMALLEST && w * h < pageArea * MOST_OF_PAGE);
      } finally {
        release(pictures);
      }
    });
  }

  // A copy of resources where the name at the end of path draws nothing. Each
  // form on the way is copied too, so other pages using them are not changed.
  function hiding(resources, [name, ...rest]) {
    const copy = copyOf(doc, resources);
    const xobjects = copyOf(doc, resources.get('XObject'));
    if (!rest.length) {
      xobjects.put(name, doc.addStream('', { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, 0, 0] }));
    } else {
      const form = xobjects.get(name);
      const dict = copyOf(doc, form.resolve());
      dict.put('Resources', hiding(form.get('Resources'), rest));
      dict.delete('Length');
      xobjects.put(name, doc.addRawStream(form.readRawStream(), dict));
    }
    copy.put('XObject', xobjects);
    return copy;
  }

  // Exact, but only for an image drawn once on the page, and through these names.
  function hideByPaths(page, paths) {
    const obj = page.getObject();
    for (const path of paths) obj.put('Resources', hiding(obj.getInheritable('Resources'), path));
  }

  // Removes images under the middle of the picture, and nothing else.
  function redactMiddle(page, { x, y, w, h }) {
    const annot = page.createAnnotation('Redact');
    annot.setRect([x + w * INSET, y + h * INSET, x + w * (1 - INSET), y + h * (1 - INSET)]);
    annot.applyRedaction(0, mupdf.PDFPage.REDACT_IMAGE_REMOVE, mupdf.PDFPage.REDACT_LINE_ART_NONE, mupdf.PDFPage.REDACT_TEXT_NONE);
  }

  // Takes picture id off the page. Fails, and the page is put back by the
  // redaction store, if anything else would go with it.
  function takeOut(page, pictures, id) {
    const target = pictures[id];
    const objects = imageObjects(doc, page);
    const expected = counts(pictures);
    expected.set(target.image.pointer, expected.get(target.image.pointer) - 1);
    // Whether exactly that one drawing of the picture is gone.
    const worked = () => {
      const left = drawnPictures(page);
      const after = counts(left);
      release(left);
      return [...expected].every(([pointer, count]) => (after.get(pointer) ?? 0) === count);
    };
    try {
      const obj = page.getObject();
      const resources = obj.get('Resources');
      const paths = objects.get(target.image.pointer)?.paths;
      if (paths && expected.get(target.image.pointer) === 0) {
        hideByPaths(page, paths);
        if (worked()) return;
        if (resources.isNull()) obj.delete('Resources');
        else obj.put('Resources', resources);
      }
      redactMiddle(page, boundsOf(target.ctm));
      if (!worked()) throw new Error('This picture overlaps another one and cannot be removed on its own.');
    } finally {
      for (const { image } of objects.values()) image.destroy();
    }
  }

  // Runs task(page, pictures) on a known picture, as one undoable change.
  function changePicture(index, id, task) {
    return redactions.change(index, (page) => {
      const pictures = drawnPictures(page);
      try {
        if (!pictures[id]) throw new Error('That picture is no longer on the page.');
        return task(page, pictures);
      } finally {
        release(pictures);
      }
    });
  }

  // Returns the key that undoes it (see redactions.swap).
  function remove(index, id) {
    return changePicture(index, id, (page, pictures) => takeOut(page, pictures, id)).key;
  }

  // The picture as it looks on the page, as PNG with its transparency, in the
  // box around it. Its own pixels are kept, up to LARGEST_SIDE.
  function lookOf(page, { image, ctm }) {
    const rect = boundsOf(ctm);
    const objects = imageObjects(doc, page);
    const found = objects.get(image.pointer);
    const pixels = found ? withAlpha(doc, found.ref) : image.toPixmap();
    for (const { image: other } of objects.values()) other.destroy();
    const perPoint = Math.max(image.getWidth() / Math.hypot(ctm[0], ctm[1]), image.getHeight() / Math.hypot(ctm[2], ctm[3]));
    const scale = Math.min(perPoint, LARGEST_SIDE / Math.max(rect.w, rect.h));
    const size = { width: Math.max(1, Math.round(rect.w * scale)), height: Math.max(1, Math.round(rect.h * scale)) };
    const matrix = mupdf.Matrix.concat(ctm, [scale, 0, 0, scale, -rect.x * scale, -rect.y * scale]);
    const { colour, alpha } = split(pixels);
    pixels.destroy();
    const shownColour = drawn(colour, matrix, size);
    const shownAlpha = drawn(alpha, matrix, size);
    const out = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, size.width, size.height], true);
    try {
      const rgb = shownColour.getPixels();
      const a = shownAlpha.getPixels();
      const target = out.getPixels();
      for (let i = 0; i < a.length; i++) {
        // The colour was drawn over black, so its edges are darkened by as much as they are see-through.
        const lift = a[i] ? 255 / a[i] : 0;
        target.set([rgb[i * 3] * lift, rgb[i * 3 + 1] * lift, rgb[i * 3 + 2] * lift, a[i]].map((v) => Math.min(255, Math.round(v))), i * 4);
      }
      return { png: out.asPNG(), rect };
    } finally {
      for (const pixmap of [colour, alpha, shownColour, shownAlpha, out]) pixmap.destroy();
    }
  }

  // Takes the picture off the page and returns what a stamp needs to show it
  // in its place: { key, png, rect }.
  function lift(index, id) {
    const { key, result } = changePicture(index, id, (page, pictures) => {
      const look = lookOf(page, pictures[id]);
      takeOut(page, pictures, id);
      return look;
    });
    return { key, ...result };
  }

  return { list, remove, lift };
}
