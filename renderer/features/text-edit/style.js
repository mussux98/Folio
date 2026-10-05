// How text looks: { family: 'sans' | 'serif' | 'mono', bold, italic, size, color: [r, g, b] },
// with size in points and colour parts from 0 to 1. The editor shows it with
// the system's look-alikes of the standard PDF fonts.

export const DEFAULT_STYLE = Object.freeze({ family: 'sans', bold: false, italic: false, size: 12, color: [0, 0, 0] });

export const FAMILIES = [['sans', 'Sans'], ['serif', 'Serif'], ['mono', 'Mono']];

const CSS_FAMILIES = {
  sans: 'Helvetica, Arial, sans-serif',
  serif: '"Times New Roman", Times, serif',
  mono: '"Courier New", Courier, monospace',
};

export function cssOf({ family, bold, italic, size, color }) {
  return {
    fontFamily: CSS_FAMILIES[family] ?? CSS_FAMILIES.sans,
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
  return a.family === b.family && a.bold === b.bold && a.italic === b.italic
    && a.size === b.size && toHex(a.color) === toHex(b.color);
}

// A standard font's name as the user reads it: "Times-BoldItalic" -> "Times Bold Italic".
export const fontLabel = (name) => name.replace('-Roman', '').replace('-', ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
