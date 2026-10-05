import { isCancelled } from '../../../pdf-engine/client.js';

// A layer on one page that loads on its own, apart from the page's picture and
// text, so something just edited can be used at once. fetch() starts the request
// ({ promise, cancel }); build(data) makes the layer's element.
// While loading the state is { cancel }, once loaded { el }.
export function createOverlay(parent, fetch, build) {
  let state = null;
  let stale = null; // an edited page keeps its old layer until the new one is ready

  async function load() {
    const request = fetch();
    const mine = { cancel: request.cancel };
    state = mine;
    try {
      const data = await request.promise;
      if (state !== mine) return;
      state = { cancel() {}, el: build(data) };
      stale?.remove();
      stale = null;
      parent.append(state.el);
    } catch (err) {
      if (state === mine) state = isCancelled(err) ? null : { cancel() {} };
    }
  }

  // keep: leave the layer in place until its replacement is ready.
  function drop(keep) {
    state?.cancel();
    if (keep && state?.el) {
      stale?.remove();
      stale = state.el;
    } else {
      state?.el?.remove();
    }
    state = null;
  }

  return {
    show() {
      if (!state) load();
    },
    cancelPending() {
      if (state && !state.el) drop(false);
    },
    drop,
    release() {
      drop(false);
      stale?.remove();
      stale = null;
    },
  };
}
