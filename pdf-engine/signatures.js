// Signatures are Stamp annotations whose picture is an image. Any image stamp
// in a file can be edited, whoever made it. Rects are in page space (see
// coords.js). MuPDF.js converts annotation rects to and from the file's PDF
// space itself, including /Rotate and the crop box.
import * as mupdf from '../node_modules/mupdf/dist/mupdf.js';

// An annotation is named by its object number, which stays the same while the
// document is open. Putting a deleted one back gives it a new number.
const keyOf = (annot) => String(annot.getObject().asIndirect());

// The picture a stamp shows: the first image in its appearance, or null.
export function imageRef(annot) {
  const found = [];
  annot.getObject().get('AP', 'N', 'Resources', 'XObject').forEach((value) => {
    if (value.resolve().get('Subtype').asName() === 'Image') found.push(value);
  });
  return found[0] ?? null;
}

export function createSignatures(doc, withPage) {
  function find(page, key) {
    const annot = page.getAnnotations().find((a) => a.getType() === 'Stamp' && keyOf(a) === key);
    if (!annot) throw new Error('That signature is no longer on the page.');
    return annot;
  }

  const toPage = (annot) => {
    const [x0, y0, x1, y1] = annot.getRect();
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };

  const toRect = ({ x, y, w, h }) => [x, y, x + w, y + h];

  // The page turns the stamp with it, so the picture is turned back by the
  // page's /Rotate to stay upright on screen.
  function keepUpright(page, annot) {
    const turns = ((page.getObject().getInheritable('Rotate').asNumber() || 0) % 360 + 360) % 360;
    const [c, s] = { 0: [1, 0], 90: [0, 1], 180: [-1, 0], 270: [0, -1] }[turns] ?? [1, 0];
    annot.getObject().get('AP', 'N').put('Matrix', [c, s, -s, c, 0, 0]);
  }

  // A stamp's default text, colour and name make some readers show a note icon next to it.
  function withoutNote(annot) {
    for (const key of ['Contents', 'C', 'Name']) annot.getObject().delete(key);
  }

  // Changing the rect or the image rebuilds the appearance, so the turn is applied after.
  function refresh(page, annot) {
    annot.update();
    withoutNote(annot);
    keepUpright(page, annot);
    annot.update();
  }

  function add(index, png, rect) {
    return withPage(index, (page) => {
      const image = new mupdf.Image(png);
      try {
        const annot = page.createAnnotation('Stamp');
        annot.setFlags(mupdf.PDFAnnotation.IS_PRINT);
        annot.setRect(toRect(rect));
        annot.setStampImage(image);
        refresh(page, annot);
        return keyOf(annot);
      } finally {
        image.destroy();
      }
    });
  }

  function move(index, key, rect) {
    withPage(index, (page) => {
      const annot = find(page, key);
      annot.setRect(toRect(rect));
      refresh(page, annot);
    });
  }

  function remove(index, key) {
    withPage(index, (page) => page.deleteAnnotation(find(page, key)));
  }

  // The image stamps on a page, so they can be selected and edited.
  function list(index) {
    return withPage(index, (page) => page.getAnnotations()
      .filter((a) => a.getType() === 'Stamp' && imageRef(a))
      .map((a) => ({ key: keyOf(a), ...toPage(a) })));
  }

  // The colours of an image, plus its transparency when it has a soft mask.
  function withAlpha(ref) {
    const image = doc.loadImage(ref);
    const colour = image.toPixmap();
    const maskRef = ref.resolve().get('SMask');
    const mask = maskRef.isNull() ? null : doc.loadImage(maskRef);
    try {
      const width = colour.getWidth();
      const height = colour.getHeight();
      const out = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, width, height], true);
      const rgb = colour.getPixels();
      const from = colour.getNumberOfComponents();
      const target = out.getPixels();
      const alpha = mask?.toPixmap();
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = y * width + x;
          const gray = from === 1;
          target.set([rgb[i * from], rgb[i * from + (gray ? 0 : 1)], rgb[i * from + (gray ? 0 : 2)], 255], i * 4);
          if (alpha) {
            // The mask may have its own size; take the nearest of its pixels.
            const mx = Math.floor((x * alpha.getWidth()) / width);
            const my = Math.floor((y * alpha.getHeight()) / height);
            target[i * 4 + 3] = alpha.getPixels()[(my * alpha.getWidth() + mx) * alpha.getNumberOfComponents()];
          }
        }
      }
      alpha?.destroy();
      return out;
    } finally {
      colour.destroy();
      image.destroy();
      mask?.destroy();
    }
  }

  // The stamp's picture as PNG bytes, so it can be put back after a deletion or a change.
  function picture(index, key) {
    return withPage(index, (page) => {
      const pixmap = withAlpha(imageRef(find(page, key)));
      try {
        return pixmap.asPNG();
      } finally {
        pixmap.destroy();
      }
    });
  }

  return { add, move, remove, list, picture };
}
