// Redacting areas of one page. The engine removes the content once; after that,
// undo and redo swap the page's content from before and after it (see
// pdf-engine/redactions.js). spec is { rects, box }, rects in page space.
export function redactPage({ engine, docId }, index, spec) {
  let key = null;
  return {
    pages: [index],
    async execute() {
      if (key !== null) return engine.swapRedaction(docId, key, 'after');
      key = await engine.redact(docId, index, spec);
    },
    undo: () => engine.swapRedaction(docId, key, 'before'),
  };
}
