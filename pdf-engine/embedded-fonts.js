// Reusing a font that is already in the file, so edited text keeps its look.
// Most embedded fonts are subsets holding only the letters the file used, and
// MuPDF can't map characters to their shapes. The font's ToUnicode table can.
// It may list letters whose shapes were cut out (MuPDF's own subsetting keeps
// the whole table), so the caller says which letters the font really draws.

import { styleOfName } from './standard-fonts.js';

const SUBSET_TAG = /^[A-Z]{6}\+/;
// The standard fonts are offered anyway, as Sans, Serif and Mono.
const STANDARD = /^(Helvetica|Times-|Courier|Symbol$|ZapfDingbats$)/;

// The font dictionaries a page uses, its forms included, with their own names.
function* fontsOf(resources, seen = new Set()) {
  if (!resources.isDictionary()) return;
  const fonts = resources.get('Font');
  if (fonts.isDictionary()) {
    const list = [];
    fonts.forEach((font) => list.push(font));
    yield* list;
  }
  const forms = resources.get('XObject');
  if (!forms.isDictionary()) return;
  const inner = [];
  forms.forEach((form) => {
    const key = form.isIndirect() ? form.asIndirect() : null;
    if (key !== null && seen.has(key)) return;
    if (key !== null) seen.add(key);
    if (form.get('Subtype').asName() === 'Form') inner.push(form.get('Resources'));
  });
  for (const res of inner) yield* fontsOf(res, seen);
}

const unhex = (text) => parseInt(text, 16);

// A UTF-16BE hex string as one character, or null for none or several (ligatures).
function charOf(hex) {
  const units = hex.match(/.{4}/g)?.map(unhex) ?? [];
  const text = String.fromCharCode(...units);
  return [...text].length === 1 ? text : null;
}

// ToUnicode as character -> code, with how many bytes a code takes.
// The first code listed for a character wins.
export function parseToUnicode(cmap) {
  const map = new Map();
  let width = 0;
  const put = (code, hex, char) => {
    width ||= hex.length / 2;
    if (char && !map.has(char)) map.set(char, code);
  };
  for (const [, body] of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const [, src, dst] of body.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) put(unhex(src), src, charOf(dst));
  }
  for (const [, body] of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const [, lo, hi, dst, list] of body.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:<([0-9a-fA-F]+)>|\[([^\]]*)\])/g)) {
      const first = unhex(lo);
      const last = Math.min(unhex(hi), first + 0xffff);
      if (list !== undefined) {
        [...list.matchAll(/<([0-9a-fA-F]*)>/g)].forEach(([, item], i) => {
          if (first + i <= last) put(first + i, lo, charOf(item));
        });
      } else if (dst.length % 4 === 0) {
        // Each code after the first adds one to the last UTF-16 unit.
        const base = dst.slice(0, -4);
        const end = unhex(dst.slice(-4));
        for (let code = first; code <= last; code++) {
          const unit = end + code - first;
          if (unit > 0xffff) break;
          put(code, lo, charOf(base + unit.toString(16).padStart(4, '0')));
        }
      }
    }
  }
  return { map, width };
}

// Only fonts whose codes are plain: one byte, or two with Identity-H.
function codeWidth(font) {
  const subtype = font.get('Subtype').asName();
  if (subtype === 'Type0') return font.get('Encoding').asName() === 'Identity-H' ? 2 : 0;
  return subtype === 'Type1' || subtype === 'TrueType' || subtype === 'MMType1' || subtype === 'Type3' ? 1 : 0;
}

function readMap(font) {
  const width = codeWidth(font);
  const cmap = font.get('ToUnicode');
  if (!width || !cmap.isStream()) return null;
  const parsed = parseToUnicode(cmap.readStream().asString());
  return parsed.width === width && parsed.map.size ? parsed.map : null;
}

// The first of these font dictionaries that has a code for every character of
// the text, as { ref, codes: character -> code, width: bytes per code }, or null.
// Spaces may be missing: many files place words apart instead of drawing spaces.
export function findEmbedded(fonts, text) {
  const wanted = [...new Set(text)].filter((char) => char !== ' ');
  for (const font of fonts) {
    const map = readMap(font);
    if (map && wanted.every((char) => map.has(char))) return { ref: font, codes: map, width: codeWidth(font) };
  }
  return null;
}

// FontDescriptor flags: 1 fixed pitch, 2 serif, 7 italic, 19 force bold.
function flagsOf(font) {
  const descendants = font.get('DescendantFonts');
  const descriptor = (descendants.isArray() ? descendants.get(0) : font).get('FontDescriptor');
  const flags = descriptor.isDictionary() ? descriptor.get('Flags').asNumber() : 0;
  return { mono: Boolean(flags & 1), serif: Boolean(flags & 2), italic: Boolean(flags & 64), bold: Boolean(flags & 0x40000) };
}

const sameObject = (a, b) => a.isIndirect() && b.isIndirect() && a.asIndirect() === b.asIndirect();

// The text fonts of the whole document, by their names in the file:
// name -> { style: { name, family, bold, italic }, fonts: [dictionaries] }.
export function documentFonts(doc) {
  const found = new Map();
  const seen = new Set();
  for (let index = 0; index < doc.countPages(); index++) {
    for (const font of fontsOf(doc.findPage(index).getInheritable('Resources'), seen)) {
      const name = font.get('BaseFont').asName();
      if (!name || STANDARD.test(name) || font.get('Subtype').asName() === 'Type3') continue;
      if (!found.has(name)) found.set(name, { style: styleOfName(name, flagsOf(font)), fonts: [] });
      const { fonts } = found.get(name);
      if (!fonts.some((other) => sameObject(other, font))) fonts.push(font);
    }
  }
  return found;
}

export const withoutTag = (name) => name.replace(SUBSET_TAG, '');
