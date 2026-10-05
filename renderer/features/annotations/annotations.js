import { activeTab } from '../../state/store.js';
import { placeAnnotation, removeAnnotation, changeAnnotation, together } from '../../commands/annotation.js';
import { createNotice } from '../notice.js';
import { buildAnnotationLayer } from './annotation-layer.js';
import { selectedRects } from './selection-rects.js';
import { DEFAULT_COLORS } from './colors.js';

const isTextField = (el) => el?.matches?.('input, textarea, select');
const busy = () => ['editing-text', 'signing'].some((name) => document.body.classList.contains(name));

// Highlighting, underlining and striking out the selected text, and sticky notes.
// Every change is an undoable command run through editing (rule 16). Markup and
// notes already in a file can be selected, recoloured, edited and deleted too.
export function createAnnotations({ store, reader, editing }) {
  const notice = createNotice();
  const placements = new Map(); // tab id -> Set of { index, spec, key }
  const layers = new Map(); // layer element -> the layer
  let selected = null; // { tabId, placement }
  let noteArmed = false;

  const report = (promise) => promise.catch((err) => console.error('Annotation edit failed:', err));
  const find = (tabId, key) => [...(placements.get(tabId) ?? [])].find((p) => p.key === key) ?? null;

  function refresh() {
    for (const [node, layer] of [...layers]) {
      if (node.isConnected) layer.update();
      else layers.delete(node);
    }
  }

  function select(tabId, placement) {
    selected = placement ? { tabId, placement } : null;
    refresh();
  }

  function adopt(tabId, placement) {
    if (!placements.has(tabId)) placements.set(tabId, new Set());
    placements.get(tabId).add(placement);
    return placement;
  }

  // Runs the command that makeCommand builds for the tab's document.
  function edit(tabId, makeCommand) {
    const doc = reader.documentOf(tabId);
    if (doc) report(editing.run(tabId, makeCommand(doc)));
  }

  function arm(value) {
    noteArmed = value;
    document.body.classList.toggle('placing-note', value);
    if (value) {
      select(null, null);
      notice.show('Click on the page where the note goes. Esc cancels.', 5000);
    } else {
      notice.hide();
    }
  }

  // Marks the text the user has selected, across pages if it runs across pages.
  function markSelection(type) {
    const tab = activeTab(store.getState());
    const doc = tab && reader.documentOf(tab.id);
    const groups = selectedRects();
    if (!doc) return;
    if (!groups.length) {
      notice.show('Select some text first, then choose how to mark it.', 4000);
      return;
    }
    const made = groups.map(({ index, rects }) => adopt(tab.id, { index, key: null, spec: { type, rects, color: DEFAULT_COLORS[type], contents: '' } }));
    window.getSelection().removeAllRanges();
    report(editing.run(tab.id, together(made.map((placement) => placeAnnotation(doc, placement)))));
  }

  // The layer for one page, built when the page's annotations are listed.
  function layerFor({ tabId, index, annotations, width, height }) {
    const items = annotations.map(({ key, ...spec }) => {
      const known = find(tabId, key);
      if (known) known.spec = spec;
      return { placement: known ?? adopt(tabId, { index, spec, key }) };
    });
    const layer = buildAnnotationLayer({
      items,
      width,
      height,
      handlers: {
        isSelected: (placement) => selected?.placement === placement,
        select: (placement) => select(tabId, placement),
        noteArmed: () => noteArmed,
        disarm: () => arm(false),
        create(rect, text) {
          const placement = adopt(tabId, { index, key: null, spec: { type: 'Text', rects: [rect], color: DEFAULT_COLORS.Text, contents: text } });
          edit(tabId, (doc) => placeAnnotation(doc, placement));
        },
        edit(placement, text) {
          select(null, null);
          if (text !== placement.spec.contents) edit(tabId, (doc) => changeAnnotation(doc, placement, { contents: text }));
        },
        recolor: (placement, color) => edit(tabId, (doc) => changeAnnotation(doc, placement, { color })),
        remove(placement) {
          select(null, null);
          edit(tabId, (doc) => removeAnnotation(doc, placement));
        },
      },
    });
    layers.set(layer.el, layer);
    layer.update();
    return layer.el;
  }

  // A click on markup selects it. Markup takes no clicks of its own so that text can
  // still be selected over it; a click that ends a text selection is not a pick.
  document.addEventListener('click', (event) => {
    if (event.button !== 0 || noteArmed || busy() || !window.getSelection().isCollapsed) return;
    if (event.target.closest?.('.anno-layer, a, button, input, select, textarea')) return;
    const tab = activeTab(store.getState());
    const page = event.target.closest?.('.page');
    const layer = page && layers.get(page.querySelector('.anno-layer'));
    const hit = layer?.hit(layer.pointOf(event)) ?? null;
    if (hit || selected) select(hit && tab?.id, hit);
  });

  document.addEventListener('keydown', (event) => {
    if (isTextField(document.activeElement)) return;
    if (event.key === 'Escape') {
      arm(false);
      select(null, null);
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && selected) {
      const { tabId, placement } = selected;
      const doc = reader.documentOf(tabId);
      if (tabId !== activeTab(store.getState())?.id || !doc) return;
      event.preventDefault();
      select(null, null);
      report(editing.run(tabId, removeAnnotation(doc, placement)));
    }
  });

  // Forget the placements of tabs that were closed.
  store.subscribe((state) => {
    for (const id of [...placements.keys()]) if (!state.tabs.some((tab) => tab.id === id)) placements.delete(id);
    if (selected && !state.tabs.some((tab) => tab.id === selected.tabId)) selected = null;
  });

  return { layerFor, markSelection, startNote: () => arm(!noteArmed) };
}
