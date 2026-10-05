// Turns one page by a quarter turn (degrees is 90 or -90). Undo turns it back.
export function rotatePage({ engine, docId, index, degrees }) {
  return {
    pages: [index],
    execute: () => engine.rotatePage(docId, index, degrees),
    undo: () => engine.rotatePage(docId, index, -degrees),
  };
}
