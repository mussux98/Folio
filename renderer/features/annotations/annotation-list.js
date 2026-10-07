import { toCss } from './colors.js';

const CHUNK = 40; // pages read per request, so the engine stays free for drawing

const LABELS = {
  Text: 'Note', Highlight: 'Highlight', Underline: 'Underline', StrikeOut: 'Strike', Ink: 'Pen',
  Square: 'Rectangle', Circle: 'Ellipse', Line: 'Line', Stamp: 'Stamp',
};

const FILTERS = [
  ['All', null],
  ['Notes', ['Text']],
  ['Highlights', ['Highlight']],
  ['Underlines', ['Underline']],
  ['Strikes', ['StrikeOut']],
  ['Pen', ['Ink']],
  ['Shapes', ['Square', 'Circle', 'Line']],
  ['Stamps', ['Stamp']],
];

const el = (tag, className, text) => Object.assign(document.createElement(tag), { className, ...(text === undefined ? {} : { textContent: text }) });

// The sidebar list of every note, highlight, underline, strike, pen mark and shape in
// the document, with its page and text. It is read the first time it is shown and then
// kept current by pagesChanged(). onPick(item) gets { index, key, type, ... } of a clicked row.
export function createAnnotationList({ engine, docId, pageCount, onPick }) {
  const root = el('div', 'annotation-list');
  const filter = el('select', 'annotation-filter');
  filter.setAttribute('aria-label', 'Show');
  FILTERS.forEach(([label], i) => filter.append(Object.assign(el('option'), { value: String(i), textContent: label })));
  const note = el('p', 'panel-note');
  const list = el('div');
  root.append(filter, note, list);

  let items = [];
  let state = 'idle'; // 'idle', 'loading' or 'loaded'
  let stale = false; // a page changed while the first read was running

  function row(item) {
    const button = el('button', 'result annotation-row');
    const dot = el('span', 'annotation-dot');
    dot.style.background = toCss(item.color?.length === 3 ? item.color : [0.6, 0.6, 0.6]);
    const page = el('span', 'result-page', `p. ${item.index + 1}`);
    const body = el('span', 'annotation-body');
    body.append(el('span', 'annotation-kind', LABELS[item.type] ?? item.type));
    const words = item.contents || item.text;
    if (words) body.append(el('span', 'result-text', words));
    button.append(dot, page, body);
    button.addEventListener('click', () => onPick(item));
    return button;
  }

  function render() {
    const wanted = FILTERS[Number(filter.value)][1];
    const shown = wanted ? items.filter((item) => wanted.includes(item.type)) : items;
    list.replaceChildren(...shown.map(row));
    if (state === 'loading') note.textContent = 'Reading the document…';
    else if (!items.length) note.textContent = 'No annotations in this document.';
    else if (!shown.length) note.textContent = 'None of this kind.';
    else note.textContent = wanted ? `${shown.length} of ${items.length}` : `${items.length} annotation${items.length === 1 ? '' : 's'}`;
  }
  filter.addEventListener('change', render);

  async function load() {
    if (state !== 'idle') return;
    state = 'loading';
    items = [];
    stale = false;
    render();
    try {
      for (let from = 0; from < pageCount; from += CHUNK) {
        items.push(...await engine.summarizeAnnotations(docId, from, from + CHUNK));
        render();
      }
    } catch {
      // The document was closed while reading; nothing is left to show.
    }
    state = 'loaded';
    if (stale) {
      state = 'idle';
      load();
    } else {
      render();
    }
  }

  render();
  return {
    element: root,
    // Reads the list the first time the panel is shown.
    refresh: load,
    // An edit changed these pages (indexes): read them again.
    async pagesChanged(pages) {
      if (state === 'idle') return;
      if (state === 'loading') {
        stale = true;
        return;
      }
      const fresh = [];
      try {
        for (const index of pages) fresh.push(...await engine.summarizeAnnotations(docId, index, index + 1));
      } catch {
        return;
      }
      items = [...items.filter((item) => !pages.includes(item.index)), ...fresh].sort((a, b) => a.index - b.index);
      render();
    },
  };
}
