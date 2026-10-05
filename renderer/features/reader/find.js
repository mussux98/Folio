import { isCancelled } from '../../../pdf-engine/client.js';

const MAX_HITS = 5000;
const EMIT_EVERY = 25; // pages scanned between updates when nothing was found

// Searches one document page by page, so results appear while it runs and a
// new search (or closing the tab) can stop it. state.hits is in reading order:
// { page, rects, snippet, mark }.
export function createFind({ engine, docId, pageCount, viewer }) {
  let run = 0;
  let cancelPending = () => {};
  let byPage = new Map();
  const listeners = new Set();
  let state = fresh('');

  function fresh(query) {
    return { query, hits: [], current: -1, searching: false, scanned: 0, truncated: false };
  }

  const emit = () => listeners.forEach((listener) => listener(state));

  function select(index, { scroll = true } = {}) {
    const { hits } = state;
    if (!hits.length) return;
    if (hits[state.current]) hits[state.current].mark.current = false;
    state.current = (index + hits.length) % hits.length;
    const hit = hits[state.current];
    hit.mark.current = true;
    viewer.setHighlights(byPage);
    if (scroll) viewer.reveal(hit.page, hit.rects[0]);
    emit();
  }

  function addHits(page, found) {
    for (const hit of found) {
      if (state.hits.length >= MAX_HITS) {
        state.truncated = true;
        return;
      }
      const mark = { rects: hit.rects, current: false };
      if (!byPage.has(page)) byPage.set(page, []);
      byPage.get(page).push(mark);
      state.hits.push({ page, rects: hit.rects, snippet: hit.snippet, mark });
    }
  }

  function stop() {
    run++;
    cancelPending();
    cancelPending = () => {};
    state.searching = false;
  }

  // quiet: keep the view where it is (a new search scrolls to the first hit).
  async function search(query, { quiet = false } = {}) {
    stop();
    state = fresh(query.trim());
    byPage = new Map();
    viewer.setHighlights(byPage);
    if (!state.query) {
      emit();
      return;
    }
    const mine = ++run;
    state.searching = true;
    emit();

    for (let page = 0; page < pageCount && !state.truncated; page++) {
      let found = [];
      try {
        const request = engine.searchPage(docId, page, state.query);
        cancelPending = request.cancel;
        found = await request.promise;
      } catch (err) {
        if (isCancelled(err) || mine !== run) return;
      }
      if (mine !== run) return;
      state.scanned = page + 1;
      if (found.length) {
        addHits(page, found);
        if (state.current === -1) select(0, { scroll: !quiet });
        else viewer.setHighlights(byPage);
      }
      if (found.length || state.scanned % EMIT_EVERY === 0) emit();
    }
    state.searching = false;
    emit();
  }

  return {
    get state() { return state; },
    search,
    // After an edit the hits may have moved, so the same search runs again.
    refresh: () => { if (state.query) search(state.query, { quiet: true }); },
    next: () => select(state.current + 1),
    previous: () => select(state.current - 1),
    goTo: (index) => select(index),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      stop();
      listeners.clear();
    },
  };
}
