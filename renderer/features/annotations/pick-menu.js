// A small list of choices under a toolbar button, such as the shapes or the stamps.
// items: [{ label, onPick }]; onClose is called however it closes. Returns a function that closes it.
export function openPickMenu({ anchor, items, onClose }) {
  const el = document.createElement('div');
  el.className = 'pick-menu';
  el.setAttribute('role', 'menu');
  for (const { label, onPick } of items) {
    const item = document.createElement('button');
    item.textContent = label;
    item.setAttribute('role', 'menuitem');
    item.addEventListener('click', () => {
      close();
      onPick();
    });
    el.append(item);
  }

  const box = anchor.getBoundingClientRect();
  el.style.left = `${Math.max(8, Math.min(box.left, window.innerWidth - 168))}px`;
  el.style.top = `${box.bottom + 4}px`;

  function onPointerDown(event) {
    if (!el.contains(event.target) && !anchor.contains(event.target)) close();
  }
  function onKey(event) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    close();
  }
  function close() {
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('keydown', onKey, true);
    el.remove();
    onClose?.();
  }
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('keydown', onKey, true);
  document.body.append(el);
  el.querySelector('button')?.focus();
  return close;
}
