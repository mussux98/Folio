// A one-page form for the tests, written as plain PDF text (MuPDF repairs the missing
// cross-reference table). Fields, top to bottom: name (text), notes (multiline text),
// agree (checkbox), size (radio group S / M), country (combo), colors (list),
// locked (read-only text) and send (push button).
import * as mupdf from '../../node_modules/mupdf/dist/mupdf.js';

const stream = (dict, body) => `<< ${dict} /Length ${body.length} >>\nstream\n${body}\nendstream`;
const box = '/Type /XObject /Subtype /Form /BBox [0 0 20 20]';
const widget = (extra) => `<< /Type /Annot /Subtype /Widget /F 4 /P 3 0 R ${extra} >>`;
const text = (extra) => widget(`/FT /Tx /DA (/Helv 12 Tf 0 g) /MK << /BC [0] >> ${extra}`);

const OBJECTS = [
  '<< /Type /Catalog /Pages 2 0 R /AcroForm << /Fields [5 0 R 6 0 R 7 0 R 8 0 R 11 0 R 12 0 R 13 0 R 14 0 R] /DA (/Helv 0 Tf 0 g) /DR << /Font << /Helv 4 0 R >> >> >> >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /Helv 4 0 R >> >> /Contents 15 0 R /Annots [5 0 R 6 0 R 7 0 R 9 0 R 10 0 R 11 0 R 12 0 R 13 0 R 14 0 R] >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  text('/T (name) /Rect [20 340 200 360] /MaxLen 12'),
  text('/T (notes) /Ff 4096 /Rect [20 260 200 330]'),
  widget('/FT /Btn /T (agree) /V /Off /AS /Off /Rect [20 230 40 250] /MK << /BC [0] >> /AP << /N << /Yes 16 0 R /Off 17 0 R >> >>'),
  '<< /FT /Btn /Ff 32768 /T (size) /V /Off /Kids [9 0 R 10 0 R] >>',
  widget('/Parent 8 0 R /Rect [20 200 40 220] /AS /Off /AP << /N << /S 16 0 R /Off 17 0 R >> >>'),
  widget('/Parent 8 0 R /Rect [60 200 80 220] /AS /Off /AP << /N << /M 16 0 R /Off 17 0 R >> >>'),
  widget('/FT /Ch /Ff 131072 /T (country) /Opt [(Spain) (France) (Italy)] /Rect [20 160 200 180] /DA (/Helv 12 Tf 0 g) /MK << /BC [0] >>'),
  widget('/FT /Ch /T (colors) /Opt [[(r) (Red)] [(g) (Green)] [(b) (Blue)]] /Rect [20 90 200 150] /DA (/Helv 12 Tf 0 g) /MK << /BC [0] >>'),
  text('/T (locked) /Ff 1 /V (fixed) /Rect [20 60 200 80]'),
  widget('/FT /Btn /Ff 65536 /T (send) /Rect [20 20 100 45] /MK << /CA (Send) /BC [0] >> /DA (/Helv 12 Tf 0 g)'),
  stream('', ''),
  stream(box, '0 0 1 rg 0 0 20 20 re f'),
  stream(box, ''),
];

export function makeFormPdf() {
  const body = OBJECTS.map((object, i) => `${i + 1} 0 obj\n${object}\nendobj\n`).join('');
  const text = `%PDF-1.7\n${body}trailer\n<< /Root 1 0 R /Size ${OBJECTS.length + 1} >>\n%%EOF`;
  return mupdf.Document.openDocument(new TextEncoder().encode(text), 'application/pdf')
    .asPDF().saveToBuffer('').asUint8Array();
}
