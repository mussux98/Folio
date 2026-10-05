// The layer over one page where text is picked for editing. Like the other
// layers it is built in PDF points and scaled by --z. It only takes clicks
// while text editing is on; the line boxes just show what a click would pick.
// lines: the page's text lines from engine.getText. onPick(point) gets the click in points.
export function buildEditLayer({ lines, width, height, onPick }) {
  const el = document.createElement('div');
  el.className = 'edit-layer';
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;

  for (const line of lines) {
    const box = document.createElement('div');
    box.className = 'edit-line';
    box.style.left = `${line.x}px`;
    box.style.top = `${line.y}px`;
    box.style.width = `${line.w}px`;
    box.style.height = `${line.h}px`;
    el.append(box);
  }

  el.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('.text-editor')) return;
    event.preventDefault();
    const box = el.getBoundingClientRect();
    const scale = width / box.width;
    onPick({ x: (event.clientX - box.left) * scale, y: (event.clientY - box.top) * scale });
  });

  return el;
}
