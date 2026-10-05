# Changelog

All notable changes to Folio are documented here. Format follows Keep a Changelog; versions follow Semantic Versioning.

## [Unreleased]
### Added
- Reader on MuPDF.js: continuous scroll with lazy rendering, cancellation and memory freeing; thumbnails; zoom (fit width, fit page, percentages, Ctrl+wheel); page navigation and the prototype's keyboard shortcuts.
- Copying text keeps paragraphs together (lines of one paragraph are joined with a space), follows reading order (top to bottom, left to right), rejoins words split with a hyphen at the end of a line, and copies plain text only.
- Find ignores case, accents and stray accent marks (cafe finds Café, esta finds esta`).
- Text selection and copy, Find with a results list and highlights, the document outline, clickable links, printing.
- Clear messages for damaged files and a password prompt for protected ones.
- Tabs: open, close (button, middle-click, Ctrl+W), switch, reorder by dragging; each tab keeps its own page and zoom.
- Open files from the dialog, drag-and-drop, the command line, "Open with" and Open Recent; a second launch adds tabs to the running window.
- Native menu (File, Edit, View, Help) and a right-click menu with Cut, Copy, Paste and Select All.
- Folio remembers window size and position, open tabs, the active tab, and the page and zoom of each file.
- Rotate a page left or right, with undo and redo (Ctrl+Z, Ctrl+Y) for each tab.
- Save and Save As. The file is written to a temp file first and then swapped in, so a failed save never damages the original; a file in use or read-only gives a clear message.
- Signatures: draw one with mouse, pen or touch (smoothed, pressure-aware) or import a PNG/JPG with optional white-background removal. Saved signatures are kept on this computer. Click a page to place one, then move, resize (corners), turn, replace with another saved signature or delete it (Delete key), with undo and redo. This works on image stamps already in a file, including earlier sessions and other programs. Signatures are written into the PDF on Save.
- Edit text (Edit Text button or Ctrl+E): click a line to change or delete it, or click anywhere to add a text box, with font, size, bold, italic and colour. The old text is removed from the file, not covered. An edited line keeps its own font, from the file or from the fonts installed on this computer; the font list offers the document's fonts by name plus Sans, Serif and Mono. When neither has the letters, the closest standard font is used and Folio says so.
- Unsaved tabs show a dot, and closing a tab, the window or the app asks to save changes.

## [0.1.0] - 2026-10-05
### Added
- Project scaffold: Electron shell, secure empty window, MuPDF.js dependency, test runner.
