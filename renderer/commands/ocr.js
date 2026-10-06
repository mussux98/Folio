// The text OCR read, written on its pages as one undo step. The engine writes
// it once; after that, undo and redo swap each page's content from before and
// after it (see pdf-engine/ocr.js). pages is [{ index, words }].
export function addOcrText({ engine, docId }, pages) {
  let keys = null;
  return {
    pages: pages.map(({ index }) => index),
    async execute() {
      if (keys) {
        for (const key of keys) await engine.swapOcrText(docId, key, 'after');
        return;
      }
      keys = [];
      for (const { index, words } of pages) {
        const key = await engine.addOcrText(docId, index, words);
        if (key !== null) keys.push(key);
      }
    },
    async undo() {
      for (const key of [...keys].reverse()) await engine.swapOcrText(docId, key, 'before');
    },
  };
}
