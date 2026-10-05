// The saved signatures as the window sees them: { id, png, url, aspect }.
// url is a blob address for showing the picture; aspect is width / height.
// The files live in the main process (rule 7); this keeps a decoded copy.
export function createLibrary(folio) {
  let items = [];
  const listeners = new Set();

  async function decode({ id, png }) {
    const blob = new Blob([png], { type: 'image/png' });
    const bitmap = await createImageBitmap(blob);
    const item = { id, png, url: URL.createObjectURL(blob), aspect: bitmap.width / bitmap.height };
    bitmap.close();
    return item;
  }

  function publish(next) {
    for (const old of items) if (!next.some((item) => item.id === old.id)) URL.revokeObjectURL(old.url);
    items = next;
    for (const listener of listeners) listener(items);
  }

  async function refresh() {
    const saved = await folio.listSignatures();
    const known = new Map(items.map((item) => [item.id, item]));
    const decoded = await Promise.all(saved.map((entry) => known.get(entry.id) ?? decode(entry).catch(() => null)));
    publish(decoded.filter(Boolean));
  }

  return {
    refresh,
    get items() { return items; },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    // Resolves to false when the library is full.
    async add(png) {
      const id = await folio.addSignature(png);
      if (!id) return false;
      await refresh();
      return true;
    },
    async remove(id) {
      await folio.removeSignature(id);
      await refresh();
    },
  };
}
