import { activeTab } from '../../state/store.js';
import { placeSignature, moveSignature, removeSignature, changeSignature } from '../../commands/signature.js';
import { createLibrary } from './library.js';
import { buildSignLayer } from './sign-layer.js';
import { openSignatureMenu } from './menu.js';
import { askForSignature } from './dialog.js';
import { placedAt, turnedRect, replacedRect } from './geometry.js';
import { turnPicture } from './turn.js';

const isTextField = (el) => el?.matches?.('input, textarea, select');

// Choosing a signature, placing it with a click, and then moving, resizing or
// deleting it. Every change is an undoable command run through editing (rule 16).
// Only signatures placed in this session can be edited; ones already saved in a
// file become part of the document.
export function createSignatures({ store, reader, editing, folio }) {
  const library = createLibrary(folio);
  const placements = new Map(); // tab id -> Set of { index, png, rect, key }
  const layers = new Set();
  let armed = null; // the library item that the next click on a page places
  let selected = null; // { tabId, placement }
  let closeMenu = null;

  const report = (promise) => promise.catch((err) => console.error('Signature edit failed:', err));
  const find = (tabId, key) => [...(placements.get(tabId) ?? [])].find((p) => p.key === key) ?? null;

  function refresh() {
    for (const entry of [...layers]) {
      if (entry.el.isConnected) entry.update();
      else layers.delete(entry);
    }
  }

  function select(tabId, placement) {
    selected = placement ? { tabId, placement } : null;
    refresh();
  }

  function arm(item) {
    armed = item;
    document.body.classList.toggle('signing', Boolean(item));
    if (item) select(null, null);
  }

  async function placeAt(tabId, index, point, page) {
    const item = armed;
    const doc = reader.documentOf(tabId);
    arm(null);
    if (!doc) return;
    const placement = { index, png: item.png, rect: placedAt(point, item.aspect, page), key: null };
    adopt(tabId, placement);
    await editing.run(tabId, placeSignature(doc, placement));
    select(tabId, placement);
  }

  function adopt(tabId, placement) {
    if (!placements.has(tabId)) placements.set(tabId, new Set());
    placements.get(tabId).add(placement);
    return placement;
  }

  // Runs the command that makeCommand builds for the tab's document (it may be async).
  function edit(tabId, makeCommand) {
    const doc = reader.documentOf(tabId);
    if (doc) report(Promise.resolve(makeCommand(doc)).then((command) => editing.run(tabId, command)));
  }

  // The layer for one page, built when the page loads its text and links.
  function layerFor({ tabId, index, signatures, width, height }) {
    // Signatures from the file get a placement too; their picture is read when first needed.
    const items = signatures.map(({ key, ...rect }) => ({ rect, placement: find(tabId, key) ?? adopt(tabId, { index, png: null, rect, key }) }));
    const page = { width, height };
    const layer = buildSignLayer({
      items,
      width,
      height,
      handlers: {
        isSelected: (placement) => selected?.placement === placement,
        select: (placement) => select(tabId, placement),
        place(point) {
          if (!armed) return false;
          report(placeAt(tabId, index, point, { width, height }));
          return true;
        },
        change: (placement, rect) => edit(tabId, (doc) => moveSignature(doc, placement, rect)),
        remove(placement) {
          select(null, null);
          edit(tabId, (doc) => removeSignature(doc, placement));
        },
        turn: (placement, turns) => edit(tabId, async (doc) => {
          const png = await turnPicture(placement.png ?? await doc.engine.signaturePicture(doc.docId, index, placement.key), turns);
          return changeSignature(doc, placement, { png, rect: turnedRect(placement.rect, page) });
        }),
        replace(placement, button) {
          openMenu(undefined, button, (item) => edit(tabId, (doc) => changeSignature(doc, placement, {
            png: item.png,
            rect: replacedRect(placement.rect, item.aspect, page),
          })));
        },
      },
    });
    layers.add(layer);
    layer.update();
    return layer.el;
  }

  // onPick says what to do with the new signature; by default it is armed for placing.
  async function create(onPick = arm) {
    const png = await askForSignature();
    if (!png) return;
    const added = await library.add(png);
    if (added) onPick(library.items.at(-1));
    else openMenu('Your library is full. Delete a saved signature first.');
  }

  // Without an anchor or a pick action it is the Sign button's menu, which arms a signature for placing.
  function openMenu(note, anchor = document.querySelector('.sign-button'), onPick = arm) {
    if (!anchor) return;
    closeMenu?.();
    closeMenu = openSignatureMenu({
      anchor,
      library,
      note,
      actions: { pick: onPick, remove: (item) => report(library.remove(item.id)), create: () => report(create(onPick)) },
    });
    report(library.refresh());
  }

  document.addEventListener('keydown', (event) => {
    if (isTextField(document.activeElement)) return;
    if (event.key === 'Escape') {
      arm(null);
      select(null, null);
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && selected) {
      const { tabId, placement } = selected;
      const doc = reader.documentOf(tabId);
      if (tabId !== activeTab(store.getState())?.id || !doc) return;
      event.preventDefault();
      select(null, null);
      report(editing.run(tabId, removeSignature(doc, placement)));
    }
  });

  // Forget the placements of tabs that were closed.
  store.subscribe((state) => {
    for (const id of [...placements.keys()]) if (!state.tabs.some((tab) => tab.id === id)) placements.delete(id);
    if (selected && !state.tabs.some((tab) => tab.id === selected.tabId)) selected = null;
  });

  return { layerFor, openMenu: () => openMenu() };
}
