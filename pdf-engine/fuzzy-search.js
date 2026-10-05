// Matching that forgives case, accents and stray accent marks, so "cafe" finds
// "café" and "esta" finds "esta`" (a mark typed after the letter). No MuPDF
// here; the engine hands in the characters of one line.

const STRAY_MARKS = /[`´¨ˆ˜¸¯˘˙˚˝]/u;
const COMBINING = /\p{M}/u;

// Folds one character; the result can be empty (a mark) or longer (a ligature).
function foldChar(char) {
  if (STRAY_MARKS.test(char)) return '';
  let out = '';
  for (const part of char.normalize('NFKD')) {
    if (!COMBINING.test(part) && !STRAY_MARKS.test(part)) out += part.toLowerCase();
  }
  return out;
}

export function foldText(text) {
  let out = '';
  for (const char of text) out += foldChar(char);
  return out;
}

const unionBox = (quads) => {
  const xs = quads.flatMap((q) => [q[0], q[2], q[4], q[6]]);
  const ys = quads.flatMap((q) => [q[1], q[3], q[5], q[7]]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};

// chars: [{ c, quad }] for one line. Returns one box per match.
export function findInLine(chars, needle) {
  const folded = foldText(needle.trim());
  if (!folded) return [];

  let text = '';
  const owner = []; // owner[i] is the index in chars that produced text[i]
  chars.forEach(({ c }, index) => {
    const part = foldChar(c);
    for (let i = 0; i < part.length; i++) owner.push(index);
    text += part;
  });

  const boxes = [];
  for (let at = text.indexOf(folded); at !== -1; at = text.indexOf(folded, at + folded.length)) {
    const first = owner[at];
    const last = owner[at + folded.length - 1];
    boxes.push(unionBox(chars.slice(first, last + 1).map((char) => char.quad)));
  }
  return boxes;
}
