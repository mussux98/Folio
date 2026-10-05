// Builds small PDFs for the tests. Run it directly to write the heavy ones:
//   node tests/fixtures/make-pdf.mjs
import * as mupdf from '../../node_modules/mupdf/dist/mupdf.js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const escape = (text) => text.replace(/[\()]/g, '\$&');

// pages: an array of strings (one line of text each) or { text, size: [w, h], rotate }.
// options.password encrypts the file; options.outline is [{ title, page }];
// options.links is [{ page, rect, uri }] with page counted from 0.
export function makePdf(pages, options = {}) {
  const doc = new mupdf.PDFDocument();
  const fonts = doc.newDictionary();
  fonts.put('F1', doc.addSimpleFont(new mupdf.Font('Helvetica')));
  const resources = doc.newDictionary();
  resources.put('Font', fonts);

  pages.forEach((entry, i) => {
    const { text, size = [300, 400], rotate = 0 } = typeof entry === 'string' ? { text: entry } : entry;
    const content = `BT /F1 18 Tf 20 ${size[1] - 50} Td (${escape(text)}) Tj ET`;
    const page = doc.addPage([0, 0, ...size], rotate, resources, content);
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pages = Array.from({ length: 1000 }, (_, i) => `Page ${i + 1} of 1000. Lorem ipsum dolor sit amet.`);
  writeFileSync(fileURLToPath(new URL('./big-1000.pdf', import.meta.url)), makePdf(pages));
  console.log('wrote tests/fixtures/big-1000.pdf');
}
