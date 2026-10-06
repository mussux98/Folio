import { parsePrintRange } from './print-range.js';

// Asks which pages to print. Resolves to a list of page indexes (0-based), or
// null if cancelled. current is the page being read (1-based).
export function askPrintPages(count, current) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'busy';
    const box = document.createElement('div');
    box.className = 'busy-box smaller-dialog print-dialog';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Print');

    const title = document.createElement('h2');
    title.textContent = 'Print';

    const choice = (value, text, checked) => {
      const row = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'print-pages';
      input.value = value;
      input.checked = checked;
      const name = document.createElement('span');
      name.textContent = text;
      row.append(input, name);
      return row;
    };
    const all = choice('all', `All ${count} pages`, true);
    const here = choice('current', `This page (${current})`, false);
    const some = choice('range', 'Pages', false);

    const range = document.createElement('input');
    range.type = 'text';
    range.placeholder = 'e.g. 1-3, 7, 10-';
    range.setAttribute('aria-label', 'Pages to print');
    some.append(range);
    range.addEventListener('focus', () => { some.querySelector('input').checked = true; });

    const error = document.createElement('p');
    error.className = 'sign-note';

    const actions = document.createElement('div');
    actions.className = 'sign-actions';
    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    const ok = document.createElement('button');
    ok.textContent = 'Print…';
    ok.className = 'primary';
    actions.append(cancel, ok);

    function pages() {
      const kind = box.querySelector('input[name="print-pages"]:checked').value;
      if (kind === 'all') return parsePrintRange('', count);
      if (kind === 'current') return [current - 1];
      const picked = range.value.trim() ? parsePrintRange(range.value, count) : null;
      if (!picked) error.textContent = `Type page numbers between 1 and ${count}, like 1-3, 7.`;
      return picked;
    }
    function accept() {
      const picked = pages();
      if (picked) close(picked);
    }
    function onKey(event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close(null);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        accept();
      }
    }
    function close(result) {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      resolve(result);
    }
    cancel.addEventListener('click', () => close(null));
    ok.addEventListener('click', accept);
    document.addEventListener('keydown', onKey, true);

    box.append(title, all, here, some, error, actions);
    overlay.append(box);
    document.body.append(overlay);
    ok.focus();
  });
}
