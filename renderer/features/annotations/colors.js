// Annotation colours as [r, g, b] from 0 to 1, which is how PDF stores them.
export const PALETTE = [
  ['Yellow', [1, 0.85, 0]],
  ['Green', [0.4, 0.85, 0.4]],
  ['Blue', [0.45, 0.7, 1]],
  ['Pink', [1, 0.55, 0.75]],
  ['Red', [0.9, 0.2, 0.2]],
];

// Pens and shapes also come in darker colours, which read better as lines.
export const DRAW_PALETTE = [
  ['Black', [0, 0, 0]],
  ['Dark blue', [0.1, 0.25, 0.75]],
  ['Dark green', [0, 0.5, 0.2]],
  ...PALETTE.slice(2),
];

const [YELLOW, , , , RED] = PALETTE.map(([, color]) => color);
const [BLACK] = DRAW_PALETTE.map(([, color]) => color);

// What a new annotation of each type starts with.
export const DEFAULT_COLORS = {
  Highlight: YELLOW, Underline: RED, StrikeOut: RED, Text: YELLOW,
  Ink: BLACK, Square: RED, Circle: RED, Line: RED, Stamp: RED,
};

// Line thicknesses in points: thin, medium and thick.
export const WIDTHS = [1, 2, 4];
export const DEFAULT_WIDTH = 2;

export const toCss = ([r, g, b]) => `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
