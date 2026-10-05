// Annotation colours as [r, g, b] from 0 to 1, which is how PDF stores them.
export const PALETTE = [
  ['Yellow', [1, 0.85, 0]],
  ['Green', [0.4, 0.85, 0.4]],
  ['Blue', [0.45, 0.7, 1]],
  ['Pink', [1, 0.55, 0.75]],
  ['Red', [0.9, 0.2, 0.2]],
];

const [YELLOW, , , , RED] = PALETTE.map(([, color]) => color);

// What a new annotation of each type starts with.
export const DEFAULT_COLORS = { Highlight: YELLOW, Underline: RED, StrikeOut: RED, Text: YELLOW };

export const toCss = ([r, g, b]) => `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
