// Which thumbnails are picked. The picks live in the store (tab.selected).
// A plain click picks one page, Ctrl or Cmd adds or removes one, Shift picks
// everything between the last plain click and this one.
export function createSelection({ store, tabId, count }) {
  let anchor = null;
  const picked = () => store.getState().tabs.find((tab) => tab.id === tabId)?.selected ?? [];

  return {
    picked,
    click(i, { shiftKey, ctrlKey, metaKey }) {
      if (shiftKey && anchor !== null) {
        const [from, to] = [Math.min(anchor, i), Math.max(anchor, i)];
        store.setSelection(tabId, Array.from({ length: to - from + 1 }, (_, n) => from + n));
      } else if (ctrlKey || metaKey) {
        const now = picked();
        store.setSelection(tabId, now.includes(i) ? now.filter((n) => n !== i) : [...now, i]);
        anchor = i;
      } else {
        store.setSelection(tabId, [i]);
        anchor = i;
      }
    },
    selectAll: () => store.setSelection(tabId, Array.from({ length: count }, (_, i) => i)),
    clear: () => store.setSelection(tabId, []),
  };
}
