// Builds small PDFs for the tests. Run it directly to write the heavy ones:
//   node tests/fixtures/make-pdf.mjs
import * as mupdf from '../../node_modules/mupdf/dist/mupdf.js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Letters outside ASCII become octal escapes, which the font reads as Latin-1.
function escape(text) {
  return [...text].map((c) => {
    if (c === '\\' || c === '(' || c === ')') return `\\${c}`;
    return c.charCodeAt(0) > 127 ? `\\${c.charCodeAt(0).toString(8)}` : c;
  }).join('');
}

// pages: an array of strings (one line of text each) or { text, size: [w, h], rotate, crop: [x0, y0, x1, y1] }.
// options.password encrypts the file; options.outline is [{ title, page }];
// options.links is [{ page, rect, uri }] with page counted from 0.
export function makePdf(pages, options = {}) {
  const doc = new mupdf.PDFDocument();
  const fonts = doc.newDictionary();
  fonts.put('F1', doc.addSimpleFont(new mupdf.Font('Helvetica')));
  const resources = doc.newDictionary();
  resources.put('Font', fonts);

  pages.forEach((entry, i) => {
    const { text, size = [300, 400], rotate = 0, crop } = typeof entry === 'string' ? { text: entry } : entry;
    // A new line in the text starts a new line on the page.
    const shown = text.split('\n').map((line) => `(${escape(line)}) Tj T*`).join(' ');
    const content = `BT /F1 18 Tf 22 TL 20 ${size[1] - 50} Td ${shown} ET`;
    const page = doc.addPage([0, 0, ...size], rotate, resources, content);
    // In the file's own coordinates, as a PDF writer would store it.
    if (crop) page.put('CropBox', crop);
    doc.insertPage(-1, page);
  });

  // Each insert lands before the previous one, so go backwards to keep the order.
  [...(options.outline ?? [])].reverse().forEach(({ title, page }) => {
    doc.outlineIterator().insert({ title, uri: `#page=${page}`, open: false });
  });

  for (const { page, rect, uri } of options.links ?? []) doc.loadPage(page).createLink(rect, uri);

  const saveOptions = options.password
    ? `encrypt=aes-128,user-password=${options.password},owner-password=${options.password}`
    : '';
  return doc.saveToBuffer(saveOptions).asUint8Array();
}

// The font file MuPDF has for a name, as a program would find it installed.
export function fontFile(name) {
  const doc = new mupdf.PDFDocument();
  const descriptor = doc.addFont(new mupdf.Font(name)).get('DescendantFonts').get(0).get('FontDescriptor');
  const file = ['FontFile2', 'FontFile3', 'FontFile'].map((key) => descriptor.get(key)).find((obj) => obj.isStream());
  return file.readStream().asUint8Array().slice();
}

// One line of text in an embedded font cut down to the letters it uses, like
// the files Word or a browser write. The font is MuPDF's copy of fontName.
export function makeSubsetPdf(text, fontName = 'Times-Roman') {
  const doc = new mupdf.PDFDocument();
  const font = new mupdf.Font(fontName);
  const fonts = doc.newDictionary();
  fonts.put('F1', doc.addFont(font));
  const resources = doc.newDictionary();
  resources.put('Font', fonts);
  const codes = [...text].map((c) => font.encodeCharacter(c.codePointAt(0)).toString(16).padStart(4, '0')).join('');
  doc.insertPage(-1, doc.addPage([0, 0, 300, 400], 0, resources, `BT /F1 18 Tf 20 350 Td <${codes}> Tj ET`));
  doc.subsetFonts();
  return doc.saveToBuffer('garbage,compress').asUint8Array().slice();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pages = Array.from({ length: 1000 }, (_, i) => `Page ${i + 1} of 1000. Lorem ipsum dolor sit amet.`);
  writeFileSync(fileURLToPath(new URL('./big-1000.pdf', import.meta.url)), makePdf(pages));
  console.log('wrote tests/fixtures/big-1000.pdf');
}

// One page with a picture of width × height pixels shown at shown = [w, h] points.
// options.gray makes it grey, options.bits = 1 black and white, options.softMask
// gives it a soft mask, options.password encrypts the file, options.text adds a line.
export function makeImagePdf(width, height, shown, options = {}) {
  const space = options.gray || options.bits === 1 ? mupdf.ColorSpace.DeviceGray : mupdf.ColorSpace.DeviceRGB;
  const pix = new mupdf.Pixmap(space, [0, 0, width, height], false);
  const px = pix.getPixels();
  const n = pix.getNumberOfComponents();
  // Smooth colour with some grain, like a photo or a scan.
  let seed = 1;
  const grain = () => (seed = (seed * 1103515245 + 12345) % 2147483648) % 24;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < n; c++) {
        const value = ((x * (c + 1) + y * (3 - c)) >> 2) % 230 + grain();
        px[(y * width + x) * n + c] = options.bits === 1 ? (value > 128 ? 255 : 0) : value;
      }
    }
  }
  const doc = new mupdf.PDFDocument();
  const mask = options.softMask ? new mupdf.Image(maskPixmap(width, height)) : undefined;
  const picture = doc.addImage(new mupdf.Image(pix, mask));
  if (options.bits === 1) {
    // Store it as a true one-bit picture, as a fax or bilevel scan would be.
    const row = Math.ceil(width / 8);
    const bits = new Uint8Array(row * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (px[y * width + x]) bits[y * row + (x >> 3)] |= 0x80 >> (x & 7);
    picture.writeStream(bits);
    picture.put('BitsPerComponent', 1);
    picture.delete('DecodeParms');
  }
  const pictures = doc.newDictionary();
  pictures.put('Im0', picture);
  const resources = doc.newDictionary();
  resources.put('XObject', pictures);
  const fonts = doc.newDictionary();
  fonts.put('F1', doc.addSimpleFont(new mupdf.Font('Helvetica')));
  resources.put('Font', fonts);
  const text = options.text ? `BT /F1 12 Tf 10 10 Td (${options.text}) Tj ET ` : '';
  const content = `${text}q ${shown[0]} 0 0 ${shown[1]} 20 30 cm /Im0 Do Q`;
  doc.insertPage(-1, doc.addPage([0, 0, 612, 792], 0, resources, content));
  const saveOptions = options.password
    ? `compress,encrypt=aes-256,user-password=${options.password},owner-password=${options.password}`
    : 'compress';
  return doc.saveToBuffer(saveOptions).asUint8Array().slice();
}

function maskPixmap(width, height) {
  const pix = new mupdf.Pixmap(mupdf.ColorSpace.DeviceGray, [0, 0, width, height], false);
  const px = pix.getPixels();
  for (let i = 0; i < px.length; i++) px[i] = (i % width) < width / 2 ? 255 : 0;
  return pix;
}
