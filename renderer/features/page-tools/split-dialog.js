// "Split document": asks how many pages each file gets. Resolves to that
// number, or null if cancelled.
export function askPartSize(pageCount) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'busy';
    const box = document.createElement('div');
    box.className = 'busy-box split-dialog';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Split document');

    const label = document.createElement('label');
    label.textContent = 'Pages in each file ';
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.max = String(pageCount - 1);
    input.value = String(Math.max(1, Math.ceil(pageCount / 2)));
    label.append(input);

    const summary = document.createElement('p');
    summary.className = 'sign-note';
    const actions = document.createElement('div');
    actions.className = 'sign-actions';
    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    const ok = document.createElement('button');
    ok.textContent = 'Choose folder…';
    ok.className = 'primary';
    actions.append(cancel, ok);

    const size = () => Number(input.value);
    const valid = () => Number.isInteger(size()) && size() >= 1 && size() < pageCount;
    function update() {
      ok.disabled = !valid();
      summary.textContent = valid()
        ? `${pageCount} pages become ${Math.ceil(pageCount / size())} files.`
        : `Enter a number from 1 to ${pageCount - 1}.`;
    }
    input.addEventListener('input', update);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && valid()) close(size());
    });

    function onKey(event) {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      close(null);
    }
    function close(result) {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      resolve(result);
    }
    cancel.addEventListener('click', () => close(null));
    ok.addEventListener('click', () => close(size()));
    document.addEventListener('keydown', onKey, true);

    box.append(label, summary, actions);
    overlay.append(box);
    document.body.append(overlay);
    update();
    input.focus();
    input.select();
  });
}
