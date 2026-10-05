// The popover under a button (the Sign button, or Replace on a selected signature):
// the saved signatures to pick from, and a way to make a new one. Returns a function that closes it.
// actions: { pick(item), remove(item), create() }; note is an optional message to show.
export function openSignatureMenu({ anchor, library, actions, note }) {
  const el = document.createElement('div');
  el.className = 'sign-menu';

  function fill(items) {
    const rows = items.map((item) => {
      const row = document.createElement('div');
      row.className = 'sign-row';
      const pick = document.createElement('button');
      pick.className = 'sign-pick';
      pick.title = 'Place this signature';
      const image = document.createElement('img');
      image.src = item.url;
      image.alt = 'Saved signature';
      pick.append(image);
      pick.addEventListener('click', () => {
        close();
        actions.pick(item);
      });
      const remove = document.createElement('button');
      remove.className = 'sign-remove';
      remove.textContent = '×';
      remove.title = 'Delete this saved signature';
      remove.setAttribute('aria-label', remove.title);
      remove.addEventListener('click', () => actions.remove(item));
      row.append(pick, remove);
      return row;
    });
    const create = document.createElement('button');
    create.className = 'sign-new';
    create.textContent = 'New signature…';
    create.addEventListener('click', () => {
      close();
      actions.create();
    });
    const message = document.createElement('p');
    message.className = 'sign-note';
    message.textContent = note ?? (items.length ? '' : 'No saved signatures yet.');
    el.replaceChildren(...rows, ...(message.textContent ? [message] : []), create);
  }

  const box = anchor.getBoundingClientRect();
  // The button sits at the right of the toolbar, so keep the menu inside the window.
  el.style.left = `${Math.max(8, Math.min(box.left, window.innerWidth - 248))}px`;
  el.style.top = `${box.bottom + 4}px`;

  const unsubscribe = library.subscribe(fill);
  fill(library.items);

  function onPointerDown(event) {
    if (!el.contains(event.target) && !anchor.contains(event.target)) close();
  }
  function onKey(event) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    close();
  }
  function close() {
    unsubscribe();
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('keydown', onKey, true);
    el.remove();
  }
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('keydown', onKey, true);
  document.body.append(el);
  return close;
}
