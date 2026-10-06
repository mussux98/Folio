// Turns what Tesseract read from a page picture into the words the engine
// writes: { text, x, y, w, size } in page points, y on the word's baseline.
// scale is the picture's pixels per point.

const MIN_CONFIDENCE = 30; // below this a "word" is usually a speck or part of a picture

// The baseline's height at x, on the line from (x0, y0) to (x1, y1).
function baselineAt({ x0, y0, x1, y1 }, x) {
  if (x1 === x0) return y0;
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

export function wordsFrom(blocks, scale) {
  const words = [];
  for (const block of blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        // The row's full height, ascenders to descenders, is the font size.
        const size = line.rowAttributes?.rowHeight || line.bbox.y1 - line.bbox.y0;
        for (const word of line.words ?? []) {
          const text = word.text.trim();
          if (!text || word.confidence < MIN_CONFIDENCE) continue;
          const { x0, y1, x1 } = word.bbox;
          const baseline = line.baseline ? baselineAt(line.baseline, x0) : y1;
          words.push({ text, x: x0 / scale, y: baseline / scale, w: (x1 - x0) / scale, size: size / scale });
        }
      }
    }
  }
  return words;
}
