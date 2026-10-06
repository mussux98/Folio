import { FAMILIES, quoted } from './style.js';
import { installedFamilies } from './installed-fonts.js';

// The editor's font list: a button that opens a searchable list of the
// document's fonts, the standard ones and every font installed on this
// computer, each name shown in its own font.
// A choice is { kind: 'face' | 'standard' | 'system', name }: a document font by
// label, 'sans' | 'serif' | 'mono', or an installed family.
// faces: [{ label }]. onPick(choice) is called when one is chosen.
export function createFontPicker({ faces, choice, onPick }) {
  const el = document.createElement('div');
  el.className = 'font-picker';
  const button = Object.assign(document.createElement('button'), { className: 'font-button', title: 'Font' });
  button.setAttribute('aria-label', 'Font');
  el.append(button);

  const labelOf = ({ kind, name }) => (kind === 'standard' ? FAMILIES.find(([key]) => key === name)?.[1] ?? name : name);
  const showChoice = () => {
    button.textContent = labelOf(choice);
    button.style.fontFamily = choice.kind === 'standard' ? '' : quoted(choice.name);
  };
  showChoice();

  let panel = null;
  const close = () => {
    panel?.remove();
    panel = null;
    document.removeEventListener('pointerdown', outside, true);
  };
  function outside(event) {
    if (!el.contains(event.target)) close();
  }

  function choose(next) {
    choice = next;
    showChoice();
    close();
    onPick(next);
  }

  function open() {
    const search = Object.assign(document.createElement('input'), { type: 'search', placeholder: 'Search fonts' });
    search.setAttribute('aria-label', 'Search fonts');
    const list = document.createElement('div');
    list.className = 'font-list';
    panel = Object.assign(document.createElement('div'), { className: 'font-panel' });
    panel.append(search, list);
    el.append(panel);
    document.addEventListener('pointerdown', outside, true);

    let installed = null;
    let first = null; // what Enter picks: the first match
    const draw = () => {
      const query = search.value.trim().toLowerCase();
      const matches = (name) => name.toLowerCase().includes(query);
      list.replaceChildren();
      first = null;
      const group = (title, items) => {
        const shown = items.filter(({ name }) => matches(labelOf({ kind: 'standard', name })));
        if (!shown.length) return;
        list.append(Object.assign(document.createElement('div'), { className: 'font-group', textContent: title }));
        for (const item of shown) {
          const row = Object.assign(document.createElement('div'), { className: 'font-item', textContent: labelOf(item) });
          if (item.kind !== 'standard') row.style.fontFamily = quoted(item.name);
          if (item.kind === choice.kind && item.name === choice.name) row.classList.add('selected');
          row.addEventListener('click', () => choose(item));
          list.append(row);
          first ??= item;
        }
      };
      group('In this document', faces.map(({ label }) => ({ kind: 'face', name: label })));
      group('Standard', FAMILIES.map(([name]) => ({ kind: 'standard', name })));
      if (installed) group('Installed', installed.map((name) => ({ kind: 'system', name })));
      else list.append(Object.assign(document.createElement('div'), { className: 'font-group', textContent: 'Loading installed fonts…' }));
      if (!first && installed) list.append(Object.assign(document.createElement('div'), { className: 'font-group', textContent: 'No fonts match.' }));
    };
    draw();
    installedFamilies().then((names) => {
      installed = names;
      if (panel) draw();
    });

    search.addEventListener('input', draw);
    search.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        if (first) choose(first);
      }
    });
    search.focus();
    list.querySelector('.selected')?.scrollIntoView({ block: 'center' });
  }

  button.addEventListener('click', () => (panel ? close() : open()));
  return { el, choice: () => choice, close };
}
