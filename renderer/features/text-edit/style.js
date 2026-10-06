// How text looks: { family: 'sans' | 'serif' | 'mono', bold, italic, size, color: [r, g, b], face },
// with size in points and colour parts from 0 to 1. face names one of the
// document's fonts ("Calibri"); system names a font installed on this computer
// instead; without either, or when Folio can't use it, the
// standard font of the family is used. The editor shows the face when it is
// installed, else the system's look-alikes of the standard PDF fonts.

export const DEFAULT_STYLE = Object.freeze({ family: 'sans', bold: false, italic: false, size: 12, color: [0, 0, 0] });

export const FAMILIES = [['sans', 'Sans'], ['serif', 'Serif'], ['mono', 'Mono']];

const CSS_FAMILIES = {
  sans: 'Helvetica, Arial, sans-serif',
  serif: '"Times New Roman", Times, serif',
  mono: '"Courier New", Courier, monospace',
};

// A font name as a CSS family, quotes and backslashes taken out.
export const quoted = (name) => `"${name.replace(/["\\]/g, '')}"`;

export function cssOf({ family, bold, italic, size, color, face, system }) {
  const generic = CSS_FAMILIES[family] ?? CSS_FAMILIES.sans;
  const named = system ?? face;
  return {
    fontFamily: named ? `${quoted(named)}, ${generic}` : generic,
    fontWeight: bold ? '700' : '400',
    fontStyle: italic ? 'italic' : 'normal',
    fontSize: `${size}px`,
    color: toHex(color),
  };
}

export const toHex = (rgb) => `#${rgb.map((part) => Math.round(part * 255).toString(16).padStart(2, '0')).join('')}`;

export function fromHex(hex) {
  const value = /^#([0-9a-f]{6})$/i.exec(hex)?.[1] ?? '000000';
  return [0, 2, 4].map((at) => parseInt(value.slice(at, at + 2), 16) / 255);
}

export function sameStyle(a, b) {
  return a.family === b.family && (a.face ?? null) === (b.face ?? null) && (a.system ?? null) === (b.system ?? null) && a.bold === b.bold && a.italic === b.italic
    && a.size === b.size && toHex(a.color) === toHex(b.color);
}

// A font's name in a PDF as the user reads it: "ABCDEF+TimesNewRomanPS-BoldMT" -> "Times New Roman".
export const readableFont = (name) => name.replace(/^[A-Z]{6}\+/, '').split(/[,-]/)[0]
  .replace(/(PSMT|MT|PS)$/, '').replace(/([a-z])([A-Z])/g, '$1 $2') || name;

// A standard font's name as the user reads it: "Times-BoldItalic" -> "Times Bold Italic".
export const fontLabel = (name) => name.replace('-Roman', '').replace('-', ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
