// Changing the text of a page: editing a line, emptying it, or adding new text.
// The engine makes the change once; after that, undo and redo swap the page's
// content from before and after it (see pdf-engine/text-edits.js).
// edit is what engine.replaceText takes. command.font is the standard font the
// text was written in, once it has run.
export function changeText({ engine, docId }, index, edit) {
  let key = null;
  const command = {
    pages: [index],
    font: null,
    async execute() {
      if (key !== null) return engine.swapText(docId, key, 'after');
      const done = await engine.replaceText(docId, index, edit);
      key = done.key;
      command.font = done.font;
    },
    undo: () => engine.swapText(docId, key, 'before'),
  };
  return command;
}
