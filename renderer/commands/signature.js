// Edits to signatures. A placement is { index, png, rect, key }: the page, the
// picture, where it sits (page space) and the engine's name for it. The key
// changes whenever the signature is put back, so every command reads it when it
// runs. png is null for a signature that came from the file; it is read from
// the file the first time it is needed.

async function pictureOf({ engine, docId }, placement) {
  placement.png ??= await engine.signaturePicture(docId, placement.index, placement.key);
  return placement.png;
}

function put({ engine, docId }, placement, png, rect) {
  return engine.addSignature(docId, placement.index, png, rect).then((key) => {
    Object.assign(placement, { key, png, rect });
  });
}

export function placeSignature(target, placement) {
  return {
    pages: [placement.index],
    execute: () => put(target, placement, placement.png, placement.rect),
    undo: () => target.engine.removeSignature(target.docId, placement.index, placement.key),
  };
}

export function moveSignature({ engine, docId }, placement, rect) {
  let before = placement.rect;
  const goTo = async (to) => {
    await engine.moveSignature(docId, placement.index, placement.key, to);
    placement.rect = to;
  };
  return {
    pages: [placement.index],
    execute() {
      before = placement.rect;
      return goTo(rect);
    },
    undo: () => goTo(before),
  };
}

export function removeSignature(target, placement) {
  let saved = null;
  return {
    pages: [placement.index],
    async execute() {
      saved = { png: await pictureOf(target, placement), rect: placement.rect };
      await target.engine.removeSignature(target.docId, placement.index, placement.key);
    },
    undo: () => put(target, placement, saved.png, saved.rect),
  };
}

// Swaps a signature's picture and box for another (a different signature, or the
// same one turned). Undoing swaps them back.
export function changeSignature(target, placement, { png, rect }) {
  let before = null;
  const swap = async (to) => {
    await target.engine.removeSignature(target.docId, placement.index, placement.key);
    await put(target, placement, to.png, to.rect);
  };
  return {
    pages: [placement.index],
    async execute() {
      before = { png: await pictureOf(target, placement), rect: placement.rect };
      await swap({ png, rect });
    },
    undo: () => swap(before),
  };
}
