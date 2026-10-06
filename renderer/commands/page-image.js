// Pictures that are part of a page (see pdf-engine/page-images.js). The engine
// takes the picture off the page once; after that, undo and redo swap the
// page's content from before and after it, as they do for a redaction.
// picture is the engine's name for it, from listPageImages().

export function deletePageImage({ engine, docId }, index, picture) {
  let key = null;
  return {
    pages: [index],
    async execute() {
      if (key !== null) return engine.swapRedaction(docId, key, 'after');
      key = await engine.deletePageImage(docId, index, picture);
    },
    undo: () => engine.swapRedaction(docId, key, 'before'),
  };
}

// Lifts the picture out into a stamp at rect (where it was dragged to), which
// can then be moved like a signature. The page's content from before the lift
// has no stamp, so undo takes the stamp away with it.
export function liftPageImage({ engine, docId }, index, picture, rect) {
  let lifted = null; // { key, png }
  return {
    pages: [index],
    async execute() {
      if (lifted) await engine.swapRedaction(docId, lifted.key, 'after');
      else lifted = await engine.liftPageImage(docId, index, picture);
      await engine.addSignature(docId, index, lifted.png, rect);
    },
    undo: () => engine.swapRedaction(docId, lifted.key, 'before'),
  };
}
