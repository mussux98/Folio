import { createNotice } from './notice.js';

const QUALITIES = [
  { value: 'high', label: 'High', note: '200 dpi pictures, good for printing' },
  { value: 'medium', label: 'Medium', note: '150 dpi pictures, good for screens and email' },
  { value: 'low', label: 'Low', note: '96 dpi pictures, the smallest file' },
];

let notice = null;
let working = false;

// File > Save Smaller Copy…: writes a copy with its pictures scaled down and
// stored as JPEG. The open file, its edits and its undo history stay as they are.
// The menu still works while it runs, so a second request is ignored.
export async function saveSmallerCopy(app, tab) {
  if (working) return;
  working = true;
  try {
    await makeCopy(app, tab);
  } finally {
    working = false;
  }
}

async function makeCopy({ reader, editing, folio }, tab) {
  notice ??= createNotice();
  const doc = reader.documentOf(tab.id);
  if (!doc) return;
  const quality = await askQuality();
  if (!quality) return;
  const target = await folio.chooseSavePath(tab.path.replace(/\.pdf$/i, '') + ' (smaller).pdf');
  if (!target) return;
  if (target.toLowerCase() === tab.path.toLowerCase()) {
    notice.show('Choose another name: the smaller copy cannot replace the open file.');
    return;
  }

  const busy = showBusy('Making a smaller copy…');
  let result;
  try {
    // After any edit still running, so the copy has it.
    result = await editing.inTurn(tab.id, () => doc.engine.saveSmaller(doc.docId, quality));
  } catch (err) {
    notice.show(`The copy could not be made: ${err.message}`);
    return;
  } finally {
    busy.remove();
  }
  const { before, bytes } = result;
  if (bytes.length >= before) {
    notice.show('This file is already as small as it can be made. Nothing was saved.');
    return;
  }
  if (await folio.writeFile(target, bytes)) {
    notice.show(`Saved a smaller copy: ${size(before)} → ${size(bytes.length)}.`);
  }
}

function size(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function showBusy(text) {
  const overlay = document.createElement('div');
  overlay.className = 'busy';
  const box = document.createElement('div');
  box.className = 'busy-box';
  const line = document.createElement('p');
  line.textContent = text;
  box.append(line);
  overlay.append(box);
  document.body.append(overlay);
  return overlay;
}

// Resolves to 'high', 'medium' or 'low', or null if cancelled.
function askQuality() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'busy';
    const box = document.createElement('div');
    box.className = 'busy-box smaller-dialog';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Save smaller copy');

    const title = document.createElement('h2');
    title.textContent = 'Save a smaller copy';
    const note = document.createElement('p');
    note.className = 'sign-note';
    note.textContent = 'Pictures are scaled down and lose some quality. Text and drawings stay sharp. The open file is not changed.';

    const choices = QUALITIES.map(({ value, label, note: detail }) => {
      const row = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'smaller-quality';
      input.value = value;
      input.checked = value === 'medium';
      const name = document.createElement('strong');
      name.textContent = label;
      const hint = document.createElement('span');
      hint.textContent = detail;
      row.append(input, name, hint);
      return row;
    });

    const actions = document.createElement('div');
    actions.className = 'sign-actions';
    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    const ok = document.createElement('button');
    ok.textContent = 'Save copy…';
    ok.className = 'primary';
    actions.append(cancel, ok);

    const chosen = () => box.querySelector('input:checked').value;
    function onKey(event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close(null);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        close(chosen());
      }
    }
    function close(result) {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      resolve(result);
    }
    cancel.addEventListener('click', () => close(null));
    ok.addEventListener('click', () => close(chosen()));
    document.addEventListener('keydown', onKey, true);

    box.append(title, note, ...choices, actions);
    overlay.append(box);
    document.body.append(overlay);
    ok.focus();
  });
}
