import { activeTab } from '../../state/store.js';
import { redactPage } from '../../commands/redact.js';
import { together } from '../../commands/annotation.js';
import { selectedRects } from '../annotations/selection-rects.js';
import { createNotice } from '../notice.js';

const MIN_SIZE = 3; // points: a smaller drag is taken for a stray click
const isTextField = (el) => el?.matches?.('input:not([type=checkbox]), textarea, select');

const HINT = 'Drag over what to remove. Esc or Redact again stops.';
const WARNING = 'Redacted content is removed from the page. Undo brings it back until you save; after that it is gone for good.';

// A line's middle band, across its thin side. Whole line boxes overlap the
// lines above and below, and anything they touch would be removed too.
const band = ({ x, y, w, h }) => (w < h ? { x: x + w / 4, y, w: w / 2, h } : { x, y: y + h / 4, w, h: h / 2 });

// True redaction. Redact removes the selected text at once; with nothing
// selected it turns on redact mode, where each area dragged over a page is
// removed. Each one is an undoable command run through editing (rule 16).
// A black box is left in place of what was removed unless the user turns it off.
export function createRedacting({ store, reader, editing }) {
  const notice = createNotice();
  let on = false;
  let box = true;
  let warned = false;

  const report = (promise) => promise.catch((err) => console.error('Redaction failed:', err));

  function run(tabId, commands) {
    const doc = reader.documentOf(tabId);
    if (!doc || !commands.length) return;
    if (!warned) notice.show(WARNING, 8000);
    warned = true;
    const made = commands.map(({ index, rects }) => redactPage(doc, index, { rects, box }));
    report(editing.run(tabId, made.length === 1 ? made[0] : together(made)));
  }

  function setOn(value) {
    on = value;
    document.body.classList.toggle('redacting', on);
    if (on) notice.show(HINT, 5000);
    else notice.hide();
  }

  function toggle() {
    const tab = activeTab(store.getState());
    if (!tab) return;
    const groups = selectedRects();
    if (!groups.length) return setOn(!on);
    window.getSelection().removeAllRanges();
    run(tab.id, groups.map(({ index, rects }) => ({ index, rects: rects.map(band) })));
  }

  // A drag on a page draws the area; letting go redacts it.
  document.addEventListener('pointerdown', (event) => {
    if (!on || event.button !== 0) return;
    const page = event.target.closest?.('.page');
    const tab = activeTab(store.getState());
    const doc = tab && reader.documentOf(tab.id);
    if (!page || !doc) return;
    event.preventDefault();
    const index = Number(page.dataset.page) - 1;
    const frame = page.getBoundingClientRect();
    const scale = doc.pageSize(index)[0] / frame.width; // points per pixel
    const start = { x: event.clientX - frame.left, y: event.clientY - frame.top };
    let area = { x: start.x, y: start.y, w: 0, h: 0 };
    const draft = document.createElement('div');
    draft.className = 'redact-draft';
    page.append(draft);
    page.setPointerCapture(event.pointerId);

    const move = ({ clientX, clientY }) => {
      const x = Math.min(Math.max(clientX - frame.left, 0), frame.width);
      const y = Math.min(Math.max(clientY - frame.top, 0), frame.height);
      area = { x: Math.min(x, start.x), y: Math.min(y, start.y), w: Math.abs(x - start.x), h: Math.abs(y - start.y) };
      Object.assign(draft.style, { left: `${area.x}px`, top: `${area.y}px`, width: `${area.w}px`, height: `${area.h}px` });
    };
    const end = () => {
      page.removeEventListener('pointermove', move);
      page.removeEventListener('pointerup', end);
      page.removeEventListener('pointercancel', end);
      draft.remove();
      const rect = { x: area.x * scale, y: area.y * scale, w: area.w * scale, h: area.h * scale };
      if (rect.w >= MIN_SIZE && rect.h >= MIN_SIZE) run(tab.id, [{ index, rects: [rect] }]);
    };
    page.addEventListener('pointermove', move);
    page.addEventListener('pointerup', end);
    page.addEventListener('pointercancel', end);
  });

  document.addEventListener('keydown', (event) => {
    if (on && event.key === 'Escape' && !isTextField(document.activeElement)) setOn(false);
  });

  // The black box choice, shown in the toolbar while redact mode is on.
  function boxOption() {
    const label = document.createElement('label');
    label.className = 'redact-box-option';
    label.title = 'Leave a black box where content was removed';
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = box;
    check.addEventListener('change', () => { box = check.checked; });
    label.append(check, ' Black box');
    return label;
  }

  return { toggle, boxOption };
}
