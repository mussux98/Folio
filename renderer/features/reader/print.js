import { isCancelled } from '../../../pdf-engine/client.js';
import { askPrintPages } from './print-dialog.js';

const PRINT_DPI = 150;
const MAX_PIXELS = 16e6;

// Draws the pixels on white (pages are transparent where nothing is drawn) and
// returns a JPEG blob URL.
function toJpegUrl({ width, height, pixels }) {
  const page = document.createElement('canvas');
  page.width = width;
  page.height = height;
  const ctx = page.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  layer.getContext('2d').putImageData(new ImageData(pixels, width, height), 0, 0);
  ctx.drawImage(layer, 0, 0);
  return new Promise((resolve) => {
    page.toBlob((blob) => resolve(URL.createObjectURL(blob)), 'image/jpeg', 0.92);
  });
}

function buildOverlay(onCancel) {
  const overlay = document.createElement('div');
  overlay.className = 'busy';
  const box = document.createElement('div');
  box.className = 'busy-box';
  const text = document.createElement('p');
  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', onCancel);
  box.append(text, cancel);
  overlay.append(box);
  document.body.append(overlay);
  return { text, remove: () => overlay.remove() };
}

// Printing happens in the main process (rule 7), but it prints what the window
// shows, so the pages are first drawn into a hidden area that only the print
// stylesheet reveals.
export async function printDocument({ engine, entry, folio, currentPage }) {
  const area = document.getElementById('print-area');
  const count = entry.sizes.length / 2;
  const pages = await askPrintPages(count, currentPage());
  if (!pages) return;
  const urls = [];
  let cancelled = false;
  let cancelRequest = () => {};
  const overlay = buildOverlay(() => {
    cancelled = true;
    cancelRequest();
  });

  try {
    for (let n = 0; n < pages.length && !cancelled; n++) {
      const i = pages[n];
      overlay.text.textContent = `Preparing page ${i + 1} (${n + 1} of ${pages.length})…`;
      const points = entry.sizes[i * 2] * entry.sizes[i * 2 + 1];
      const scale = Math.min(PRINT_DPI / 72, Math.sqrt(MAX_PIXELS / points));
      const request = engine.renderPage(entry.docId, i, scale, 0);
      cancelRequest = request.cancel;
      let image;
      try {
        image = await request.promise;
      } catch (err) {
        if (isCancelled(err)) break;
        throw err;
      }
      const url = await toJpegUrl(image);
      urls.push(url);
      const img = document.createElement('img');
      img.className = 'print-page';
      img.src = url;
      area.append(img);
    }
    if (!cancelled) {
      overlay.text.textContent = 'Waiting for the print dialog…';
      await Promise.all([...area.querySelectorAll('img')].map((img) => img.decode().catch(() => {})));
      await folio.print();
    }
  } finally {
    overlay.remove();
    area.replaceChildren();
    urls.forEach((url) => URL.revokeObjectURL(url));
  }
}
