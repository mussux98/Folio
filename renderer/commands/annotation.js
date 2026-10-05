// Edits to text markup and notes. A placement is { index, spec, key }: the page,
// what the annotation is ({ type, rects, color, contents }, rects in page space)
// and the engine's name for it. The key changes whenever the annotation is put
// back, so every command reads it when it runs.

function put({ engine, docId }, placement) {
  return engine.addAnnotation(docId, placement.index, placement.spec).then((key) => {
    placement.key = key;
  });
}

export function placeAnnotation(target, placement) {
  return {
    pages: [placement.index],
    execute: () => put(target, placement),
    undo: () => target.engine.removeAnnotation(target.docId, placement.index, placement.key),
  };
}

export function removeAnnotation(target, placement) {
  return {
    pages: [placement.index],
    execute: () => target.engine.removeAnnotation(target.docId, placement.index, placement.key),
    undo: () => put(target, placement),
  };
}

// changes: { color?, contents?, rects? }. Undoing puts the old values back.
export function changeAnnotation({ engine, docId }, placement, changes) {
  const before = {};
  const apply = async (values) => {
    await engine.changeAnnotation(docId, placement.index, placement.key, values);
    Object.assign(placement.spec, values);
  };
  return {
    pages: [placement.index],
    execute() {
      for (const name of Object.keys(changes)) before[name] = placement.spec[name];
      return apply(changes);
    },
    undo: () => apply(before),
  };
}

// Several commands as one undo step, such as markup over a selection that runs across pages.
export function together(commands) {
  return {
    pages: [...new Set(commands.flatMap((command) => command.pages))],
    async execute() {
      for (const command of commands) await command.execute();
    },
    async undo() {
      for (const command of [...commands].reverse()) await command.undo();
    },
  };
}
