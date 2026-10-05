// Turns pages by a quarter turn (degrees is 90 or -90). Undo turns them back.
export function rotatePages({ engine, docId }, indexes, degrees) {
  const turn = (by) => Promise.all(indexes.map((index) => engine.rotatePage(docId, index, by)));
  return {
    pages: indexes,
    execute: () => turn(degrees),
    undo: () => turn(-degrees),
  };
}
