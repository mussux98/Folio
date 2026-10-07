// True redaction: what lies under an area is taken out of the page, not covered.
// Text inside it is removed, images lose the covered pixels and drawings fully
// inside it go. A black box can be drawn where the content was. Like text edits,
// each redaction keeps the page's content from before and after it, so undo and
// redo swap one for the other until the file is saved.
import * as mupdf from '../node_modules/mupdf/dist/mupdf.js';

const PARTS = ['Contents', 'Resources', 'Annots'];
// Form fields and links are part of the page's structure, not marks made on it.
const KEPT_ANNOTATIONS = ['Widget', 'Link', 'Popup', 'Redact'];

export function createRedactions(doc, withPage) {
  const changes = new Map(); // key -> { index, before, after }
  let nextKey = 1;

  // The annotation list is changed in place, so copies of it are kept and put back.
  function copied(name, value) {
    if (name !== 'Annots' || !value.isArray()) return value;
    const copy = doc.newArray();
    value.forEach((item) => copy.push(item));
    return copy;
  }

  function snapshot(obj) {
    const parts = {};
    for (const name of PARTS) parts[name] = copied(name, obj.get(name));
    return parts;
  }

  function restore(obj, parts) {
    for (const name of PARTS) {
      if (parts[name].isNull()) obj.delete(name);
      else obj.put(name, copied(name, parts[name]));
    }
  }

  // Runs task(page) and keeps the page's content from before and after it under
  // a new key, with what the task returns. The task must replace what it
  // changes, not edit it in place. If it fails, the page is put back.
  function change(index, task) {
    return withPage(index, (page) => {
      const obj = page.getObject();
      const before = snapshot(obj);
      let result;
      try {
        result = task(page);
      } catch (err) {
        restore(obj, before);
        throw err;
      }
      const key = nextKey++;
      changes.set(key, { index, before, after: snapshot(obj) });
      return { key, result };
    });
  }

  // An annotation goes with the redaction when its middle is inside an area that covers at
  // least half of its width, so a highlight that only grazes the area stays.
  function mostlyInside([x0, y0, x1, y1], rects) {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    return rects.some((r) => cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h
      && Math.min(x1, r.x + r.w) - Math.max(x0, r.x) >= (x1 - x0) / 2);
  }

  // Highlights, notes, stamps and the like keep what they were drawn over, and a note can
  // hold the very words being removed, so those under the area are deleted too.
  function dropAnnotations(page, rects) {
    // Chosen first: deleting one makes the list of the others stale.
    const doomed = page.getAnnotations().filter((annot) => !KEPT_ANNOTATIONS.includes(annot.getType()) && mostlyInside(annot.getBounds(), rects));
    for (const annot of doomed) page.deleteAnnotation(annot);
  }

  // rects: [{ x, y, w, h }] in page space. box: whether a black box is left in their place.
  function redact(index, { rects, box }) {
    return change(index, (page) => {
      dropAnnotations(page, rects);
      for (const { x, y, w, h } of rects) {
        const annot = page.createAnnotation('Redact');
        annot.setRect([x, y, x + w, y + h]);
        annot.applyRedaction(box ? 1 : 0, mupdf.PDFPage.REDACT_IMAGE_PIXELS,
          mupdf.PDFPage.REDACT_LINE_ART_REMOVE_IF_COVERED, mupdf.PDFPage.REDACT_TEXT_REMOVE);
      }
    }).key;
  }

  // which: 'before' undoes the change, 'after' does it again.
  function swap(key, which) {
    const change = changes.get(key);
    if (!change) throw new Error('That redaction is no longer known.');
    withPage(change.index, (page) => restore(page.getObject(), change[which]));
  }

  return { change, redact, swap };
}
