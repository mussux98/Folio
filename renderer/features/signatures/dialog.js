import { createDrawPad, COLORS } from './draw-pad.js';
import { createImportPane } from './import-pane.js';

function button(label, className, onClick) {
  const el = document.createElement('button');
  el.textContent = label;
  if (className) el.className = className;
  el.addEventListener('click', onClick);
  return el;
}

// The "New signature" window. Resolves to PNG bytes, or null if cancelled.
export function askForSignature() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'busy';
    const box = document.createElement('div');
    box.className = 'busy-box sign-dialog';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'New signature');

    let active = null;
    const save = button('Use signature', 'primary', async () => {
      save.disabled = true;
      close(await active.toPng());
    });
    const update = () => { save.disabled = active.isEmpty(); };
    const pad = createDrawPad(update);
    const imported = createImportPane(update);

    const colors = document.createElement('div');
    colors.className = 'sign-colors';
    for (const [name, value] of Object.entries(COLORS)) {
      const swatch = button('', 'sign-color', () => pad.setColor(value));
      swatch.title = name;
      swatch.style.background = value;
      colors.append(swatch);
    }
    const drawView = document.createElement('div');
    drawView.append(pad.element, colors, button('Clear', '', () => pad.clear()));

    const body = document.createElement('div');
    const drawTab = button('Draw', 'sign-tab', () => show(pad));
    const importTab = button('Import picture', 'sign-tab', () => show(imported));
    const tabs = document.createElement('div');
    tabs.className = 'sign-tabs';
    tabs.append(drawTab, importTab);

    function show(which) {
      active = which;
      body.replaceChildren(which === pad ? drawView : imported.element);
      drawTab.classList.toggle('active', which === pad);
      importTab.classList.toggle('active', which === imported);
      update();
    }

    const actions = document.createElement('div');
    actions.className = 'sign-actions';
    actions.append(button('Cancel', '', () => close(null)), save);

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
    document.addEventListener('keydown', onKey, true);

    box.append(tabs, body, actions);
    overlay.append(box);
    document.body.append(overlay);
    show(pad);
  });
}
