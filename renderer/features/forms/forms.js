import { setFormValue } from '../../commands/form.js';
import { buildFormLayer } from './form-layer.js';

// Filling in form fields. Every change is an undoable command run through editing
// (rule 16); the answers are written into the PDF on Save. Scripts in a form (totals,
// formats) are not run, and signature fields are left to the Sign button.
export function createForms({ reader, editing }) {
  const report = (promise) => promise.catch((err) => console.error('Form edit failed:', err));

  // A page is drawn again after every change, which rebuilds its fields. If one was
  // being typed in, it comes back focused with what was typed so far.
  function carryOver(layer) {
    const active = document.activeElement;
    if (!active?.matches?.('.form-layer .form-field')) return;
    const { key } = active.dataset;
    const text = 'value' in active && active.matches('input, textarea') ? { value: active.value, from: active.selectionStart, to: active.selectionEnd } : null;
    queueMicrotask(() => {
      const next = layer.querySelector(`[data-key="${key}"]`);
      if (!next) return;
      next.focus();
      if (text && text.value !== next.value) {
        // Not kept yet: it is when the focus leaves, as it would have been.
        next.value = text.value;
        next.setSelectionRange?.(text.from, text.to);
        next.addEventListener('blur', () => next.dispatchEvent(new Event('change')), { once: true });
      }
    });
  }

  function layerFor({ tabId, index, fields, width, height }) {
    const layer = buildFormLayer({ fields, width, height, commit(field, value) {
      const doc = reader.documentOf(tabId);
      if (!doc || value === field.value) return;
      const before = field.value;
      field.value = value;
      report(editing.run(tabId, setFormValue(doc, { index, key: field.key }, before, value)));
    } });
    carryOver(layer);
    return layer;
  }

  return { layerFor };
}
