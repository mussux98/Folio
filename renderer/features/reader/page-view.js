import { isCancelled } from '../../../pdf-engine/client.js';
import { buildTextLayer, buildLinkLayer, buildHighlightLayer } from './page-layers.js';

const sameScale = (a, b) => Math.abs(a - b) < b * 0.01;

// One page in the scroll. It always exists as an empty sheet of the right size;
// the picture and the text layers are loaded only while the page is near the screen.
// width and height are in PDF points; actions is { goToPage(n), openLink(url), signLayer(args) }.
export function createPageView({ index, width, height, engine, docId, actions }) {
  const el = document.createElement('div');
  el.className = 'page';
  el.dataset.page = String(index + 1);

  let canvas = null;
  let drawnScale = 0;
  let render = null; // { scale, cancel } while a picture is being made
  let failedScale = 0;
  let layers = null; // { cancel } while loading, { text, links } when loaded
  // The signing layer loads on its own and first in line, so a signature that was just
  // placed or moved can be grabbed at once. { cancel } while loading, { el } when loaded.
  let signing = null;
  let staleSigning = null; // an edited page keeps its old signing layer until the new one is ready
  let marks = [];
  let highlights = null;

  function place(left, top, w, h) {
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
  }

  async function draw(scale, priority) {
    const request = engine.renderPage(docId, index, scale, priority);
    const mine = { scale, cancel: request.cancel };
    render = mine;
    try {
      const { width: w, height: h, pixels } = await request.promise;
      // Rule 20: the new picture is finished before it replaces the old one.
      const next = document.createElement('canvas');
      next.width = w;
      next.height = h;
      next.getContext('2d').putImageData(new ImageData(pixels, w, h), 0, 0);
      if (canvas) canvas.replaceWith(next);
      else el.prepend(next);
      canvas = next;
      drawnScale = scale;
      failedScale = 0;
    } catch (err) {
      if (!isCancelled(err)) failedScale = scale;
    } finally {
      if (render === mine) render = null;
    }
  }

  async function loadLayers(priority) {
    const texts = engine.getText(docId, index, priority);
    const links = engine.getLinks(docId, index, priority);
    layers = { cancel: () => { texts.cancel(); links.cancel(); } };
    const mine = layers;
    try {
      const [lines, areas] = await Promise.all([texts.promise, links.promise]);
      if (layers !== mine) return;
      layers = {
        cancel() {},
        text: buildTextLayer(lines, width, height),
        links: buildLinkLayer(areas, width, height, actions),
      };
      el.append(layers.text, layers.links);
    } catch (err) {
      if (layers === mine) layers = isCancelled(err) ? null : { cancel() {} };
    }
  }

  async function loadSigning() {
    const request = engine.listSignatures(docId, index, -1);
    const mine = { cancel: request.cancel };
    signing = mine;
    try {
      const signatures = await request.promise;
      if (signing !== mine) return;
      signing = { cancel() {}, el: actions.signLayer({ index, signatures, width, height }) };
      staleSigning?.remove();
      staleSigning = null;
      el.append(signing.el);
    } catch (err) {
      if (signing === mine) signing = isCancelled(err) ? null : { cancel() {} };
    }
  }

  // keep: leave the layer in place until its replacement is ready.
  function dropSigning(keep) {
    signing?.cancel();
    if (keep && signing?.el) {
      staleSigning?.remove();
      staleSigning = signing.el;
    } else {
      signing?.el?.remove();
    }
    signing = null;
  }

  function cancelPending() {
    render?.cancel();
    if (layers && !layers.text) {
      layers.cancel();
      layers = null;
    }
    if (signing && !signing.el) dropSigning(false);
  }

  return {
    el,
    index,
    place,

    // Brings the page up to date for this scale. Lower priority numbers go first.
    show(scale, priority) {
      const wanted = !canvas || !sameScale(drawnScale, scale);
      if (wanted && !(render && sameScale(render.scale, scale)) && !(failedScale && sameScale(failedScale, scale))) {
        render?.cancel();
        draw(scale, priority);
      }
      if (!layers) loadLayers(priority + 2);
      if (!signing) loadSigning();
    },

    cancelPending,

    // Frees the picture and the text layers; the empty sheet stays.
    release() {
      cancelPending();
      canvas?.remove();
      canvas = null;
      drawnScale = 0;
      layers?.text?.remove();
      layers?.links?.remove();
      layers = null;
      dropSigning(false);
      staleSigning?.remove();
      staleSigning = null;
    },

    // The page was edited: draw it again at its new size. The old picture stays
    // until the new one is ready (rule 20); the text layers are rebuilt.
    redraw(w, h) {
      width = w;
      height = h;
      render?.cancel();
      render = null;
      drawnScale = 0;
      failedScale = 0;
      layers?.cancel();
      layers?.text?.remove();
      layers?.links?.remove();
      layers = null;
      dropSigning(true);
    },

    // marks: [{ rects, current }] or null.
    setHighlights(next) {
      marks = next ?? [];
      highlights?.remove();
      highlights = null;
      if (!marks.length) return;
      highlights = buildHighlightLayer(marks, width, height);
      el.insertBefore(highlights, layers?.text ?? null);
    },
  };
}
