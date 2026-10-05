// Filling in a form field. A placement is { index, key }: the page and the
// engine's name for the field. before is what the field held, so undo can put it back.
export function setFormValue({ engine, docId }, { index, key }, before, value) {
  const apply = (next) => engine.setFormValue(docId, index, key, next);
  return {
    pages: [index],
    execute: () => apply(value),
    undo: () => apply(before),
  };
}
