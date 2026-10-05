// The 14 standard PDF fonts. Every reader has them, so text written with them
// needs no font inside the file. Edited text uses the one closest to the original.

const FAMILIES = {
  sans: ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique'],
  serif: ['Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic'],
  mono: ['Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique'],
};

// Fonts drawn the same as a standard one, so using it is not a change the user needs to hear about.
const SAME_LOOK = /^(helvetica|arial|liberationsans|nimbussans|times|liberationserif|nimbusroman|courier|liberationmono|nimbusmono)/;

export function standardFont({ family, bold, italic }) {
  return (FAMILIES[family] ?? FAMILIES.sans)[(bold ? 1 : 0) + (italic ? 2 : 0)];
}

// What a font looks like: { name, family, bold, italic }, from its name in the
// file and its flags. The flags in many files are wrong or missing, so the
// name is checked too.
export function styleOfName(fullName, flags) {
  const name = fullName.replace(/^[A-Z]{6}\+/, '');
  const plain = name.toLowerCase();
  let family = 'sans';
  if (flags.mono || /courier|mono|consol/.test(plain)) family = 'mono';
  else if (!/sans/.test(plain) && (flags.serif || /times|serif|roman|georgia|garamond|cambria|palatino|bookman|antiqua/.test(plain))) family = 'serif';
  return {
    name,
    family,
    bold: flags.bold || /bold|black|heavy|semibold|demi/.test(plain),
    italic: flags.italic || /italic|oblique/.test(plain),
  };
}

// The style of a font MuPDF has loaded.
export const styleOf = (font) => styleOfName(font.getName(), {
  mono: font.isMono(), serif: font.isSerif(), bold: font.isBold(), italic: font.isItalic(),
});

export const looksStandard = (name) => SAME_LOOK.test(name.toLowerCase().replace(/[^a-z]/g, ''));

// WinAnsiEncoding: Latin-1, plus these in the 0x80-0x9F range.
const WIN_ANSI_EXTRA = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85], [0x2020, 0x86],
  [0x2021, 0x87], [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
  [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95],
  [0x2013, 0x96], [0x2014, 0x97], [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
  [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);

// The text as WinAnsi bytes, or null if a character is not in that encoding.
export function winAnsiBytes(text) {
  const bytes = [];
  for (const char of text) {
    const code = char.codePointAt(0);
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) bytes.push(code);
    else if (WIN_ANSI_EXTRA.has(code)) bytes.push(WIN_ANSI_EXTRA.get(code));
    else return null;
  }
  return bytes;
}
