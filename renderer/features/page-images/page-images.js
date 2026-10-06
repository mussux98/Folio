import { activeTab } from '../../state/store.js';
import { deletePageImage, liftPageImage } from '../../commands/page-image.js';
import { createNotice } from '../notice.js';
import { buildImageLayer } from './image-layer.js';

const HINT = 'Drag a picture to move it, or select it and press Delete. Esc or Images again stops.';
const isTextField = (el) => el?.matches?.('input, textarea, select');

// Edit Images mode: the pictures that are part of a page (a scanned signature,
// a logo) get a box. Delete takes one off the page; dragging lifts it out into
// a stamp, which from then on moves like a signature. Each change is an
// undoable command run through editing (rule 16).
export function createPageImages({ store, reader, editing }) {
  const notice = createNotice();
  const layers = new Set();
  let on = false;
  let selected = null; // { tabId, index, id }

  function refresh() {
    for (const layer of [...layers]) {
      if (layer.el.isConnected) layer.update();
      else layers.delete(layer);
    }
  }

  function select(next) {
    selected = next;
    refresh();
  }

  function setOn(value) {
    on = value;
    document.body.classList.toggle('editing-images', on);
    select(null);
    if (on) notice.show(HINT, 5000);
    else notice.hide();
  }

  // A picture that overlaps another can't be taken out alone; the engine says so,
  // and the page is drawn again so a dragged box goes back to its place.
  function run(tabId, index, makeCommand) {
    const doc = reader.documentOf(tabId);
    if (!doc) return;
    select(null);
    editing.run(tabId, makeCommand(doc)).catch((err) => {
      console.error('Picture edit failed:', err);
      notice.show(err.message?.includes('overlaps') ? err.message : 'This picture could not be changed.');
      reader.pagesChanged(tabId, [index]);
    });
  }

  function layerFor({ tabId, index, pictures, width, height }) {
    const layer = buildImageLayer({
      pictures,
      width,
      height,
      handlers: {
        isSelected: (id) => selected?.tabId === tabId && selected.index === index && selected.id === id,
        select: (id) => select(id === null ? null : { tabId, index, id }),
        lift: (id, rect) => run(tabId, index, (doc) => liftPageImage(doc, index, id, rect)),
        remove: (id) => run(tabId, index, (doc) => deletePageImage(doc, index, id)),
      },
    });
    layers.add(layer);
    layer.update();
    return layer.el;
  }

  document.addEventListener('pointerdown', (event) => {
    if (selected && !event.target.closest?.('.image-box')) select(null);
  });

  document.addEventListener('keydown', (event) => {
    if (!on || isTextField(document.activeElement)) return;
    if (event.key === 'Escape') {
      setOn(false);
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && selected) {
      if (selected.tabId !== activeTab(store.getState())?.id) return;
      event.preventDefault();
      const { tabId, index, id } = selected;
      run(tabId, index, (doc) => deletePageImage(doc, index, id));
    }
  });

  return { layerFor, toggle: () => setOn(!on) };
}
