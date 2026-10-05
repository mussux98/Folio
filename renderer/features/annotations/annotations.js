import { activeTab } from '../../state/store.js';
import { placeAnnotation, removeAnnotation, changeAnnotation, together } from '../../commands/annotation.js';
import { createNotice } from '../notice.js';
import { buildAnnotationLayer } from './annotation-layer.js';
import { selectedRects } from './selection-rects.js';
import { openPickMenu } from './pick-menu.js';
import { DRAWN } from './shapes.js';
import { DEFAULT_COLORS, DEFAULT_WIDTH } from './colors.js';

const isTextField = (el) => el?.matches?.('input, textarea, select');
const busy = () => ['editing-text', 'signing'].some((name) => document.body.classList.contains(name));

const SHAPES = [['Rectangle', 'Square'], ['Ellipse', 'Circle'], ['Line', 'Line'], ['Arrow', 'Arrow']];
const STAMPS = [
  ['Approved', 'Approved'], ['Not Approved', 'NotApproved'], ['Draft', 'Draft'],
  ['Final', 'Final'], ['Confidential', 'Confidential'], ['For Comment', 'ForComment'],
];

// What to tell the user when a tool is picked.
const HINTS = {
  Note: 'Click on the page where the note goes. Esc cancels.',
  Ink: 'Draw on the page. The pen stays on until you press Esc or click Pen again.',
  Square: 'Drag on the page to draw a rectangle. Shift makes a square. Esc cancels.',
  Circle: 'Drag on the page to draw an ellipse. Shift makes a circle. Esc cancels.',
  Line: 'Drag on the page to draw a line. Shift keeps it straight or at 45°. Esc cancels.',
  Arrow: 'Drag on the page to draw an arrow. Shift keeps it straight or at 45°. Esc cancels.',
  Stamp: 'Click on the page where the stamp goes. Esc cancels.',
};

// Highlighting, underlining and striking out the selected text, sticky notes, and
// drawing: the pen, shapes, lines, arrows and stamps. Every change is an undoable
// command run through editing (rule 16). Annotations already in a file can be
// selected, recoloured, moved, edited and deleted too.
export function createAnnotations({ store, reader, editing }) {
  const notice = createNotice();
  const placements = new Map(); // tab id -> Set of { index, spec, key }
  const layers = new Map(); // layer element -> the layer
  const looks = {}; // type -> the colour and thickness last chosen for it
  let selected = null; // { tabId, placement }
  let tool = null; // { kind, icon }: what a press on the page makes
  let closeMenu = null;

  const report = (promise) => promise.catch((err) => console.error('Annotation edit failed:', err));
  const find = (tabId, key) => [...(placements.get(tabId) ?? [])].find((p) => p.key === key) ?? null;
  const lookOf = (type) => ({ color: DEFAULT_COLORS[type], width: DEFAULT_WIDTH, ...looks[type] });

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

  // Picks the tool for the next press on a page, or puts it down (null).
  function setTool(next) {
    tool = next;
    if (next) document.body.dataset.annoTool = next.kind;
    else delete document.body.dataset.annoTool;
    document.body.classList.toggle('annotating', Boolean(next));
    if (next) {
      select(null, null);
      notice.show(HINTS[next.kind], 5000);
    } else {
      notice.hide();
    }
  }

  // The tool button pressed: the same tool again puts it down.
  const toggleTool = (kind, icon) => setTool(tool?.kind === kind && tool.icon === icon ? null : { kind, icon });

  // A toolbar menu; pressing its button again closes it.
  function openMenu(anchor, items) {
    if (closeMenu) closeMenu();
    else closeMenu = openPickMenu({ anchor, items, onClose: () => { closeMenu = null; } });
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
    const remember = (placement, changes) => {
      const { type } = placement.spec;
      if (DRAWN.includes(type)) looks[type] = { ...looks[type], ...changes };
    };
    const layer = buildAnnotationLayer({
      items,
      width,
      height,
      handlers: {
        isSelected: (placement) => selected?.placement === placement,
        select: (placement) => select(tabId, placement),
        tool: () => tool,
        // The pen stays on for the next stroke; every other tool makes one thing.
        toolDone() {
          if (tool?.kind !== 'Ink') setTool(null);
        },
        look: lookOf,
        create(spec) {
          const placement = adopt(tabId, { index, key: null, spec: { contents: '', ...lookOf(spec.type), ...spec } });
          edit(tabId, (doc) => placeAnnotation(doc, placement));
        },
        edit(placement, text) {
          select(null, null);
          if (text !== placement.spec.contents) edit(tabId, (doc) => changeAnnotation(doc, placement, { contents: text }));
        },
        recolor(placement, color) {
          remember(placement, { color });
          edit(tabId, (doc) => changeAnnotation(doc, placement, { color }));
        },
        change(placement, changes) {
          if (changes.width) remember(placement, { width: changes.width });
          edit(tabId, (doc) => changeAnnotation(doc, placement, changes));
        },
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

  // A click on markup or a shape selects it. They take no clicks of their own so that
  // text can still be selected over them; a click that ends a text selection is not a pick.
  document.addEventListener('click', (event) => {
    if (event.button !== 0 || tool || busy() || !window.getSelection().isCollapsed) return;
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
      setTool(null);
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

  return {
    layerFor,
    markSelection,
    startNote: () => toggleTool('Note'),
    startPen: () => toggleTool('Ink'),
    openShapes: (anchor) => openMenu(anchor, SHAPES.map(([label, kind]) => ({ label, onPick: () => setTool({ kind }) }))),
    openStamps: (anchor) => openMenu(anchor, STAMPS.map(([label, icon]) => ({ label, onPick: () => setTool({ kind: 'Stamp', icon }) }))),
  };
}
