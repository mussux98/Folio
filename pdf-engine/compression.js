// A smaller copy of a saved file. Pictures are scaled down to what the page
// needs at the chosen quality and stored as JPEG; then the file is written
// with duplicates merged, objects packed together and fonts cut down.
// The document being edited is never touched: this works on its saved bytes.
import * as mupdf from '../node_modules/mupdf/dist/mupdf.js';

export const QUALITIES = {
  high: { dpi: 200, jpeg: 85 },
  medium: { dpi: 150, jpeg: 75 },
  low: { dpi: 96, jpeg: 60 },
};

// Only worth replacing a picture when the new one is clearly smaller.
const WORTH_IT = 0.9;

// bytes: the file as Save writes it; password: what opens it ('' if nothing).
export function compressed(bytes, password, quality) {
  const settings = QUALITIES[quality];
  if (!settings) throw new Error(`Unknown quality: ${quality}`);
  let doc = null;
  try {
    doc = mupdf.Document.openDocument(bytes, 'application/pdf').asPDF();
    if (doc.needsPassword()) doc.authenticatePassword(password);
    shrinkPictures(doc, settings);
    doc.subsetFonts();
    // An encrypted file keeps its encryption: MuPDF writes it back the same way.
    const buffer = doc.saveToBuffer('garbage=deduplicate,compress,compress-images=yes,compress-fonts=yes,objstms=yes');
    try {
      return buffer.asUint8Array().slice();
    } finally {
      buffer.destroy();
    }
  } finally {
    doc?.destroy();
  }
}

function shrinkPictures(doc, settings) {
  for (const [num, { image, width, height }] of picturesOnPages(doc)) {
    const ref = doc.newIndirect(num);
    if (!canShrink(ref, image)) continue;
    const jpeg = asJpeg(image, targetSize(image, width, height, settings.dpi), settings.jpeg);
    if (jpeg.bytes.length >= rawLength(ref) * WORTH_IT) continue;
    ref.writeRawStream(jpeg.bytes);
    ref.put('Filter', doc.newName('DCTDecode'));
    ref.put('Width', jpeg.width);
    ref.put('Height', jpeg.height);
    ref.put('BitsPerComponent', 8);
    ref.put('ColorSpace', doc.newName(jpeg.gray ? 'DeviceGray' : 'DeviceRGB'));
    ref.delete('DecodeParms');
    ref.delete('Decode');
  }
}

function rawLength(ref) {
  const raw = ref.readRawStream();
  try {
    return raw.getLength();
  } finally {
    raw.destroy();
  }
}

// Every picture drawn on a page (annotations included), by object number,
// with the largest size it is shown at in points. Pictures used only as masks
// are never drawn on their own, so they are left as they are.
function picturesOnPages(doc) {
  const shown = new Map(); // image pointer -> { image, width, height }
  const device = new mupdf.Device({
    fillImage(image, ctm) {
      const width = Math.hypot(ctm[0], ctm[1]);
      const height = Math.hypot(ctm[2], ctm[3]);
      const seen = shown.get(image.pointer);
      if (!seen) return shown.set(image.pointer, { image, width, height });
      seen.width = Math.max(seen.width, width);
      seen.height = Math.max(seen.height, height);
      image.destroy();
    },
  });
  for (let i = 0; i < doc.countPages(); i++) {
    const page = doc.loadPage(i);
    try {
      page.run(device, mupdf.Matrix.identity);
    } finally {
      page.destroy();
    }
  }
  device.close();

  // MuPDF loads each picture once and hands out the same one, so the pointer
  // found on a page leads back to its object. The kept references stop it
  // being dropped from MuPDF's cache in between.
  const pictures = new Map();
  for (let num = 1; num < doc.countObjects(); num++) {
    const ref = doc.newIndirect(num);
    if (!ref.isStream() || ref.get('Subtype').asName() !== 'Image') continue;
    const loaded = doc.loadImage(ref);
    const found = shown.get(loaded.pointer);
    loaded.destroy();
    if (found) pictures.set(num, found);
  }
  return pictures;
}

// Black-and-white scans compress far better as they are, and a colour-key
// mask needs the exact colours JPEG would change.
function canShrink(ref, image) {
  if (image.getImageMask() || image.getBitsPerComponent() === 1) return false;
  if (ref.get('Mask').isArray()) return false;
  return image.getWidth() > 0 && image.getHeight() > 0;
}

// The pixels the picture needs at dpi for the largest size it is shown at.
function targetSize(image, width, height, dpi) {
  const w = image.getWidth();
  const h = image.getHeight();
  const scale = Math.min(1, Math.max((width / 72) * dpi / w, (height / 72) * dpi / h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

// The picture's own pixels (without its soft mask, which stays as it is),
// drawn at the new size into grey or RGB.
function asJpeg(image, { width, height }, quality) {
  const gray = image.getColorSpace()?.isGray() ?? false;
  const space = gray ? mupdf.ColorSpace.DeviceGray : mupdf.ColorSpace.DeviceRGB;
  const pixels = image.toPixmap();
  const plain = new mupdf.Image(pixels);
  const out = new mupdf.Pixmap(space, [0, 0, width, height], false);
  try {
    out.clear(255);
    const draw = new mupdf.DrawDevice(mupdf.Matrix.identity, out);
    draw.fillImage(plain, [width, 0, 0, height, 0, 0], 1);
    draw.close();
    return { bytes: out.asJPEG(quality), width, height, gray };
  } finally {
    out.destroy();
    plain.destroy();
    pixels.destroy();
  }
}
