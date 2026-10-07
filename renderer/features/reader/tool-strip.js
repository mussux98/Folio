import { icon } from './tool-icons.js';

function iconButton(name, title, onClick, className = '') {
  const el = document.createElement('button');
  el.className = `tool icon-tool ${className}`.trim();
  el.title = title;
  el.setAttribute('aria-label', title);
  el.append(icon(name));
  el.addEventListener('click', onClick);
  // Marking and redacting act on the text selected on the page, so no button may take the selection away.
  el.addEventListener('mousedown', (event) => event.preventDefault());
  return el;
}

function divider() {
  const el = document.createElement('span');
  el.className = 'strip-divider';
  return el;
}

// The column of editing tools beside the pages: markup, text, redaction, pictures and signing.
export function createToolStrip({ annotating, redacting, toggleTextEditing, toggleImages, openSignMenu }) {
  const el = document.createElement('div');
  el.className = 'tool-strip';
  el.append(
    iconButton('highlight', 'Highlight the selected text', () => annotating.markSelection('Highlight')),
    iconButton('underline', 'Underline the selected text', () => annotating.markSelection('Underline')),
    iconButton('strike', 'Strike out the selected text', () => annotating.markSelection('StrikeOut')),
    divider(),
    iconButton('note', 'Add a sticky note', () => annotating.startNote(), 'note-button'),
    iconButton('pen', 'Draw freehand', () => annotating.startPen(), 'pen-button'),
    iconButton('shapes', 'Draw a rectangle, ellipse, line or arrow', (event) => annotating.openShapes(event.currentTarget), 'shapes-button'),
    iconButton('stamp', 'Add a stamp such as Approved or Draft', (event) => annotating.openStamps(event.currentTarget), 'stamp-button'),
    divider(),
    iconButton('text', 'Change or add text (Ctrl+E)', toggleTextEditing, 'edit-text-button'),
    iconButton('redact', 'Remove the selected text, or drag over areas to remove (Ctrl+Shift+X)', redacting.toggle, 'redact-button'),
    iconButton('images', 'Move, resize or delete pictures in the page', toggleImages, 'images-button'),
    iconButton('sign', 'Add a signature', openSignMenu, 'sign-button'),
  );
  return { element: el };
}
