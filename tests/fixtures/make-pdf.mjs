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
