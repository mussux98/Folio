import { changeText } from '../../commands/text-edit.js';
import { createNotice } from '../notice.js';
import { buildEditLayer } from './edit-layer.js';
import { openEditor } from './editor.js';
import { DEFAULT_STYLE, sameStyle, fontLabel, readableFont } from './style.js';
import { installedFont, installedFamilyFont } from './installed-fonts.js';
import { documentFaces, fontsToReuse } from './faces.js';

const ASCENT = 0.8; // of the font size: from the top of a new box to its first baseline

const isTextField = (el) => el?.matches?.('input, textarea, select');

const HINT = 'Click a line to change it, or click anywhere else to add text. '
  + 'Edited lines do not wrap onto the next line, and scanned pages have no text to change.';

// Editing the text of a page. While it is on, a click on a line opens it in an
// editor, and a click anywhere else starts a new text box. Every change is an
// undoable command run through editing (rule 16). The font list offers the
// document's own fonts and the standard ones; an edited line starts in its own
// font. The user is told when the closest standard font had to be used instead.
export function createTextEditing({ reader, editing }) {
  const notice = createNotice();
  let on = false;
  let open = null; // { editor, finish(save) } while an editor is showing
  let newStyle = DEFAULT_STYLE; // the style of the last new text box

  const report = (promise) => promise.catch((err) => console.error('Text edit failed:', err));

  function toggle(value = !on) {
    if (open) report(open.finish(true));
    on = value;
    document.body.classList.toggle('editing-text', on);
    if (on) notice.show(HINT, 9000);
    else notice.hide();
  }

  // A face from the document is written with the file's copy when it has every
  // letter, else the installed one (the engine decides).
  async function editFor(line, at, text, style, faces) {
    const font = { family: style.family, bold: style.bold, italic: style.italic };
    const face = style.face ? faces.get(style.face) : null;
    const system = style.system ? await installedFamilyFont(style.system, style) : null;
    const base = {
      text,
      size: style.size,
      font,
      color: style.color,
      reuse: face ? fontsToReuse(face, style, line) : [],
      installed: system ?? (face ? await installedFont(face.fonts[0].id, style) : null),
    };
    if (!line) return { ...base, area: null, origin: { x: at.x, y: at.y + style.size * ASCENT } };
    return { ...base, area: line.area, origin: line.origin, space: line.space };
  }

  function tellFont(line, style, font) {
    if (style.system && font?.kind === 'standard') {
      notice.show(`Written in ${fontLabel(font.name)}, the closest standard font. "${style.system}" can't show every letter of the text.`);
      return;
    }
    if (style.face && !line?.standard && font?.kind === 'standard') {
      notice.show(`Written in ${fontLabel(font.name)}, the closest standard font. The file holds only some letters of `
        + `"${style.face}" (or another style of it), and that font is not installed on this computer.`);
    }
  }

  // line is what the engine found under the click, or null for a new box at the point.
  // faces: the document's fonts (see faces.js).
  function startEditor({ tabId, index, layer, line, point, faces }) {
    const style = line
      ? { ...line.font, size: line.size, color: line.color, face: readableFont(line.font.id) }
      : { ...newStyle, face: faces.has(newStyle.face) ? newStyle.face : null };
    const at = line ? { x: line.x, y: line.y, w: line.w, h: line.h } : { x: point.x, y: point.y, w: 40, h: style.size * 1.2 };
    const text = line ? line.text : '';
    let busy = false;

    const close = () => {
      editor.close();
      if (open?.editor === editor) open = null;
    };

    async function finish(save) {
      if (busy) return;
      const value = editor.value();
      const unchanged = line ? value.text === text && sameStyle(value.style, style) : !value.text.trim();
      if (!save || unchanged) return close();
      const doc = reader.documentOf(tabId);
      if (!doc) return close();
      busy = true;
      try {
        const command = changeText(doc, index, await editFor(line, at, value.text, value.style, faces));
        await editing.run(tabId, command);
        if (!line) newStyle = value.style;
        tellFont(line, value.style, command.font);
        close();
      } catch (err) {
        editor.showError(err.message);
      } finally {
        busy = false;
      }
    }

    const offered = [...faces.values()].map(({ label, family }) => ({ label, family }));
    const editor = openEditor({ layer, at, text, style, faces: offered, multiline: !line, onFinish: (save) => report(finish(save)) });
    open = { editor, finish };
  }

  async function pick({ tabId, index, layer, point }) {
    // The first click away from an open editor only finishes it.
    if (open) return open.finish(true);
    const doc = reader.documentOf(tabId);
    if (!doc) return;
    const line = await doc.engine.textLineAt(doc.docId, index, point);
    if (line && !line.straight) {
      notice.show('Folio can only change text that runs straight across the page.');
      return;
    }
    const faces = documentFaces(await doc.engine.documentFonts(doc.docId), line);
    if (on && !open && layer.isConnected) startEditor({ tabId, index, layer, line, point, faces });
  }

  // The layer for one page, built with the page's text layer.
  function layerFor({ tabId, index, lines, width, height }) {
    const layer = buildEditLayer({ lines, width, height, onPick: (point) => report(pick({ tabId, index, layer, point })) });
    return layer;
  }

  // A press anywhere outside the open editor finishes it.
  document.addEventListener('pointerdown', (event) => {
    if (open && !open.editor.el.contains(event.target) && !event.target.closest?.('.edit-layer')) report(open.finish(true));
  }, true);

  document.addEventListener('keydown', (event) => {
    if (on && event.key === 'Escape' && !isTextField(document.activeElement)) toggle(false);
  });

  return { layerFor, toggle: () => toggle() };
}
