// Sets the password the file gets on its next save ('' takes it off). Undo
// puts back the setting from before.
export function setPassword({ engine, docId }, password) {
  let before = null;
  return {
    pages: [],
    async execute() {
      before = await engine.setProtection(docId, password);
    },
    undo: () => engine.setProtection(docId, before),
  };
}
