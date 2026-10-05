import { whiteToTransparent } from './background.js';
import { contentBounds } from './ink.js';
import { cropToPng } from './draw-pad.js';

const MAX_SIDE = 1200; // larger pictures are shrunk; a signature doesn't need more
const MAX_FILE_BYTES = 20 * 1024 * 1024;

// Choosing a PNG or JPG to use as a signature. Returns { element, isEmpty, toPng }.
export function createImportPane(onChange) {
  const element = document.createElement('div');
  element.className = 'sign-import';

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg';
  const clearLabel = document.createElement('label');
  const clearBox = document.createElement('input');
  clearBox.type = 'checkbox';
  clearBox.checked = true;
  clearLabel.append(clearBox, ' Remove the white background');
  const preview = document.createElement('div');
  preview.className = 'sign-preview';
  const note = document.createElement('p');
  note.className = 'sign-note';
  element.append(input, clearLabel, preview, note);

  let bitmap = null;

  // The picture as pixels, shrunk if it is large, with the background cleared if asked.
  function prepare() {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);
    const data = ctx.getImageData(0, 0, width, height);
    if (clearBox.checked) whiteToTransparent(data.data);
    ctx.putImageData(data, 0, 0);
    return { canvas, data: data.data, width, height };
  }

  function showPreview() {
    preview.replaceChildren();
    if (!bitmap) return;
    const { canvas, width, height } = prepare();
    const shown = document.createElement('canvas');
    shown.width = width;
    shown.height = height;
    shown.getContext('2d').drawImage(canvas, 0, 0);
    preview.append(shown);
  }

  input.addEventListener('change', async () => {
    const file = input.files[0];
    bitmap?.close();
    bitmap = null;
    note.textContent = '';
    if (file && file.size > MAX_FILE_BYTES) {
      note.textContent = 'That picture is too large.';
    } else if (file) {
      try {
        bitmap = await createImageBitmap(file);
      } catch {
        note.textContent = 'That file could not be read as a picture.';
      }
    }
    showPreview();
    onChange();
  });
  clearBox.addEventListener('change', showPreview);

  return {
    element,
    isEmpty: () => !bitmap,
    async toPng() {
      if (!bitmap) return null;
      const { canvas, data, width, height } = prepare();
      const box = contentBounds(data, width, height) ?? { x: 0, y: 0, w: width, h: height };
      return cropToPng(canvas, box, 4);
    },
  };
}
