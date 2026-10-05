// The list of search matches in the sidebar. New matches are added to the end
// while a search runs; a new search starts the list again.
export function createResults(find) {
  const root = document.createElement('div');
  root.className = 'results';
  const note = document.createElement('p');
  note.className = 'panel-note';
  const list = document.createElement('div');
  root.append(note, list);

  let query = null;
  let shown = 0;
  let marked = null;

  function row(hit, index) {
    const el = document.createElement('button');
    el.className = 'result';
    const page = document.createElement('span');
    page.className = 'result-page';
    page.textContent = `p. ${hit.page + 1}`;
    const text = document.createElement('span');
    text.className = 'result-text';
    text.textContent = hit.snippet || '…';
    el.append(page, text);
    el.addEventListener('click', () => find.goTo(index));
    return el;
  }

  function render(state) {
    if (state.query !== query) {
      query = state.query;
      shown = 0;
      marked = null;
      list.replaceChildren();
    }
    list.append(...state.hits.slice(shown).map((hit, i) => row(hit, shown + i)));
    shown = state.hits.length;

    marked?.classList.remove('current');
    marked = list.children[state.current] ?? null;
    marked?.classList.add('current');
    marked?.scrollIntoView({ block: 'nearest' });

    if (!state.query) note.textContent = 'Type in the search box and press Enter.';
    else if (state.searching) note.textContent = `${state.hits.length} found, searched ${state.scanned} pages…`;
    else if (!state.hits.length) note.textContent = 'No matches.';
    else note.textContent = `${state.hits.length}${state.truncated ? '+' : ''} matches`;
  }

  find.subscribe(render);
  render(find.state);
  return { element: root };
}
