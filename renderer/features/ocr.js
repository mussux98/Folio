import { activeTab } from '../state/store.js';
import { addOcrText } from '../commands/ocr.js';
import { createOcrReader, LANGUAGES } from '../../pdf-engine/ocr-reader.js';
import { isCancelled } from '../../pdf-engine/client.js';
import { createNotice } from './notice.js';

const DPI = 300; // what Tesseract reads best

let notice = null;
let working = false;

// Edit > Recognize Text (OCR)…: reads scanned pages and lays invisible text
// over them, so they can be searched, selected and copied. Pages that already
// have text are left alone. The whole run is one undo step; Cancel adds nothing.
// It runs in the tab's turn, so no other edit moves the pages while it reads.
export async function recognizeText({ store, reader, editing }) {
  const tab = activeTab(store.getState());
  if (working || !tab) return;
  const doc = reader.documentOf(tab.id);
  if (!doc) return;
  working = true;
  notice ??= createNotice();
  try {
    const choice = await askScope(tab.page);
    if (!choice) return;
    let found = null;
    await editing.run(tab.id, async () => {
      found = await readPages(doc, choice, tab.page - 1);
      return found?.pages.length ? addOcrText(doc, found.pages) : null;
    });
    if (found) notice.show(summary(found, choice.scope));
  } catch (err) {
    notice.show(`Text could not be recognised: ${err.message}`);
  } finally {
    working = false;
  }
}

function summary({ scanned, pages }, scope) {
  if (!scanned) return scope === 'page' ? 'This page already has text.' : 'No scanned pages: every page already has text.';
  if (!pages.length) return 'No text was found on the scanned pages.';
  const words = pages.reduce((sum, page) => sum + page.words.length, 0);
  return `Recognised ${words} words on ${pages.length} of ${scanned} scanned page${scanned === 1 ? '' : 's'}.`;
}

// Resolves to { scanned, pages: [{ index, words }] }, or null if cancelled.
async function readPages({ engine, docId, pageCount }, { scope, languages }, current) {
  const asked = scope === 'page' ? [current] : Array.from({ length: pageCount }, (_, i) => i);
  const todo = await engine.pagesWithoutText(docId, asked);
  if (!todo.length) return { scanned: 0, pages: [] };

  const progress = showProgress();
  let ocr = null;
  let rendering = null;
  progress.onCancel(() => rendering?.cancel());
  try {
    progress.set('Loading the text recogniser…');
    ocr = await createOcrReader(languages);
    const pages = [];
    for (const [n, index] of todo.entries()) {
      if (progress.cancelled) return null;
      progress.set(`Reading page ${index + 1} (${n + 1} of ${todo.length})…`);
      rendering = engine.ocrPicture(docId, index, DPI);
      const { png, scale } = await rendering.promise;
      if (progress.cancelled) return null;
      const words = await ocr.read(png, scale);
      if (words.length) pages.push({ index, words });
    }
    return progress.cancelled ? null : { scanned: todo.length, pages };
  } catch (err) {
    if (isCancelled(err)) return null;
    throw err;
  } finally {
    progress.remove();
    await ocr?.stop();
  }
}

// The busy box with a line of progress and a Cancel button.
function showProgress() {
  const overlay = document.createElement('div');
  overlay.className = 'busy';
  const box = document.createElement('div');
  box.className = 'busy-box';
  const line = document.createElement('p');
  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  box.append(line, cancel);
  overlay.append(box);
  document.body.append(overlay);

  const state = { cancelled: false };
  let onCancel = () => {};
  function stop() {
    if (state.cancelled) return;
    state.cancelled = true;
    line.textContent = 'Stopping…';
    cancel.disabled = true;
    onCancel();
  }
  function onKey(event) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    stop();
  }
  cancel.addEventListener('click', stop);
  document.addEventListener('keydown', onKey, true);
  cancel.focus();

  return Object.assign(state, {
    set: (text) => { if (!state.cancelled) line.textContent = text; },
    onCancel: (task) => { onCancel = task; },
    remove() {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
    },
  });
}

// Resolves to { scope: 'page' | 'all', languages: ['eng', ...] }, or null if cancelled.
function askScope(page) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'busy';
    const box = document.createElement('div');
    box.className = 'busy-box smaller-dialog ocr-dialog';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Recognize text');

    const title = document.createElement('h2');
    title.textContent = 'Recognize text (OCR)';
    const note = document.createElement('p');
    note.className = 'sign-note';
    note.textContent = 'Scanned pages get invisible text over them, so they can be searched and copied. Pages that already have text are skipped.';

    const option = (type, name, value, label, checked) => {
      const row = document.createElement('label');
      const input = document.createElement('input');
      input.type = type;
      input.name = name;
      input.value = value;
      input.checked = checked;
      const text = document.createElement('span');
      text.textContent = label;
      row.append(input, text);
      return row;
    };
    const heading = (text) => {
      const h = document.createElement('h3');
      h.textContent = text;
      return h;
    };

    const scopes = [
      option('radio', 'ocr-scope', 'page', `This page (${page})`, false),
      option('radio', 'ocr-scope', 'all', 'All scanned pages', true),
    ];
    const languages = LANGUAGES.map(({ code, label }) => option('checkbox', 'ocr-language', code, label, code === 'eng'));

    const actions = document.createElement('div');
    actions.className = 'sign-actions';
    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    const ok = document.createElement('button');
    ok.textContent = 'Recognize';
    ok.className = 'primary';
    actions.append(cancel, ok);

    const chosen = () => ({
      scope: box.querySelector('input[name="ocr-scope"]:checked').value,
      languages: [...box.querySelectorAll('input[name="ocr-language"]:checked')].map((input) => input.value),
    });
    // At least one language must be ticked.
    box.addEventListener('change', () => { ok.disabled = !chosen().languages.length; });

    function onKey(event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close(null);
      } else if (event.key === 'Enter' && !ok.disabled) {
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

    box.append(title, note, heading('Pages'), ...scopes, heading('Language'), ...languages, actions);
    overlay.append(box);
    document.body.append(overlay);
    ok.focus();
  });
}
