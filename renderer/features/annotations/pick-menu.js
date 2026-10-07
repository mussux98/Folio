// A small list of choices under a toolbar button, such as the shapes or the stamps.
// items: [{ label, onPick }]; onClose is called however it closes. Returns a function that closes it.
// It opens under anchor (an element), or at a point { x, y } when there is no anchor.
export function openPickMenu({ anchor, at, items, onClose }) {
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

  const box = anchor ? anchor.getBoundingClientRect() : { left: at.x, bottom: at.y };
  el.style.left = `${Math.max(8, Math.min(box.left, window.innerWidth - 248))}px`;
  el.style.top = `${Math.max(8, Math.min(box.bottom + (anchor ? 4 : 0), window.innerHeight - 260))}px`;

  function onPointerDown(event) {
    if (!el.contains(event.target) && !anchor?.contains(event.target)) close();
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
