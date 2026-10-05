// Form fields: listing them for a page and filling them in. Rects are in page space
// (see coords.js); MuPDF.js converts widget rects itself. Signature fields and push
// buttons are left out: signing is done with stamps, and there is no script to run.
import * as mupdf from '../node_modules/mupdf/dist/mupdf.js';

const OFF = 'Off';

// A field is named by its widget's object number, which stays the same while the document is open.
const keyOf = (widget) => String(widget.getObject().asIndirect());

function kindOf(widget) {
  if (widget.isText()) return 'text';
  if (widget.isCheckbox()) return 'checkbox';
  if (widget.isRadioButton()) return 'radio';
  if (widget.isComboBox()) return 'combo';
  if (widget.isListBox()) return 'list';
  return null;
}

// The name a checkbox or radio button takes when it is on: the state in its
// appearance that isn't Off.
function onState(widget) {
  let found = null;
  widget.getObject().get('AP', 'N').forEach((_value, name) => {
    if (name !== OFF) found ??= name;
  });
  return found;
}

const isShown = (widget) => !(widget.getFlags() & (mupdf.PDFAnnotation.IS_HIDDEN | mupdf.PDFAnnotation.IS_NO_VIEW));

function describe(widget, kind) {
  const [x0, y0, x1, y1] = widget.getRect();
  const field = {
    key: keyOf(widget),
    kind,
    name: widget.getName(),
    label: widget.getLabel(),
    rect: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
    value: widget.getValue(),
    readOnly: widget.isReadOnly(),
  };
  if (kind === 'text') {
    Object.assign(field, { multiline: widget.isMultiline(), password: widget.isPassword(), comb: widget.isComb(), maxLen: widget.getMaxLen() });
  } else if (kind === 'combo' || kind === 'list') {
    const values = widget.getOptions(true);
    field.options = widget.getOptions(false).map((label, i) => ({ label, value: values[i] ?? label }));
    field.editable = Boolean(widget.getFieldFlags() & mupdf.PDFWidget.CH_FIELD_IS_EDIT);
  } else {
    field.on = onState(widget);
  }
  return field;
}

export function createForms(withPage) {
  const fieldsOf = (page) => page.getWidgets().filter(isShown).map((widget) => ({ widget, kind: kindOf(widget) })).filter((f) => f.kind);

  // Top to bottom, then left to right, which is the order Tab should visit them in.
  function list(index) {
    return withPage(index, (page) => fieldsOf(page)
      .map(({ widget, kind }) => describe(widget, kind))
      .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x));
  }

  // value is the text or chosen option; for a checkbox or radio button, its on state
  // (field.on) or 'Off'. A radio button's value is its group's, so setting another
  // button's state turns the current one off.
  function set(index, key, value) {
    if (typeof value !== 'string') throw new Error('That is not a value a form field can take.');
    withPage(index, (page) => {
      const fields = fieldsOf(page);
      const target = fields.find(({ widget }) => keyOf(widget) === key);
      if (!target) throw new Error('That form field is no longer on the page.');
      const { widget, kind } = target;
      if (widget.isReadOnly()) throw new Error('That field is read-only.');
      if (kind === 'text') {
        const max = widget.getMaxLen();
        widget.setTextValue(max > 0 ? value.slice(0, max) : value);
      } else if (kind === 'combo' || kind === 'list') {
        widget.setChoiceValue(value);
      } else if (kind === 'checkbox') {
        if ((widget.getValue() !== OFF) !== (value !== OFF)) widget.toggle();
      } else if (widget.getValue() !== value) {
        // Radio: pressing the button that is on turns the group off; pressing another selects it.
        const press = value === OFF
          ? fields.find((f) => f.kind === 'radio' && f.widget.getName() === widget.getName() && onState(f.widget) === widget.getValue())
          : fields.find((f) => f.kind === 'radio' && f.widget.getName() === widget.getName() && onState(f.widget) === value);
        press?.widget.toggle();
      }
    });
  }

  return { list, set };
}
