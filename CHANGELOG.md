# Changelog

All notable changes to Folio are documented here. Format follows Keep a Changelog; versions follow Semantic Versioning.

## [2.0.0] - 2026-10-06
### Added
- Editing text can use any font installed on the computer: the font button in the editor opens a list you can search, with each name shown in its own font. The chosen font is embedded and cut down to the letters used when you save.
- Edit Images: Edit → Edit Images (or Images in the toolbar) lets you delete a picture that is part of the page, such as a logo or a scanned signature, or drag it somewhere else and resize it. Text over or under it stays. Each change can be undone.
- Editing text keeps the layout when the file's font isn't installed (most of all on a Mac): Arial, Helvetica, Times, Courier and Calibri are replaced by look-alikes that ship with Folio and have exactly the same letter widths.
- Print asks which pages first: all, this page, or a range like 1-3, 7, 10-. Only those pages are prepared, so printing a few pages of a big file is quick.
- Mac build: a signed and notarized DMG for Intel and Apple Silicon (`npm run dist:mac` on a Mac). PDFs opened from Finder, the Dock or "Open With" become tabs; the tab bar sits in the title bar next to the window buttons; the menus follow Mac conventions (Folio and Window menus, Cmd+G for Find Next).
- OCR: Edit → Recognize Text (OCR)… reads scanned pages in English, Spanish or both and lays invisible text over them, so they can be searched, selected and copied. Works fully offline. Pages that already have text are skipped, it can be cancelled, and it can be undone.
- Save Smaller Copy: File → Save Smaller Copy… writes a smaller copy of the file. Pictures are scaled down to High (200 dpi), Medium (150 dpi) or Low (96 dpi) and stored as JPEG; text and drawings stay sharp, fonts are cut down to the letters used, and a password is kept. The open file is not changed, and you are told the size before and after.
- Password protection: File → Password… locks the file with a password (AES-256), changes it, or removes it. It takes effect when you save and can be undone. Protected files keep their password when saved.
- Redaction: select text and press Redact, or press Redact and drag over any part of a page. What is underneath is removed from the file, not just covered: text, the covered part of pictures, and drawings inside the area. A black box is left in its place unless you untick Black box. Undo brings it back until you save.
- Forms: fill in text fields, checkboxes, radio buttons, drop-down lists and list boxes right on the page. Tab moves to the next field, Esc puts back what was there, each change can be undone, and the answers are written into the PDF on Save (they show in Edge and Acrobat). Read-only fields, signature fields and push buttons are left alone, and scripts in a form (such as calculated totals) are not run.
- Drawing: Pen for freehand, Shapes for rectangles, ellipses, lines and arrows (Shift for squares, circles and 45° lines), and Stamp for Approved, Draft, Confidential and the other standard stamps. Click a drawing to recolour it, change its thickness, drag it somewhere else or resize it from a corner. Stamps stay upright on turned pages. All of it can be undone.
- Text markup and sticky notes: select text and choose Highlight, Underline or Strike in the toolbar; Note puts a sticky note where you click. Click markup or a note to change its colour, edit it or delete it. Works on annotations already in the file, and can be undone.
- Page tools in a new Pages menu: delete, insert a blank page, insert pages from other PDFs, copy, cut and paste pages between tabs (Ctrl+C, Ctrl+X, Ctrl+V on the thumbnails, or the Pages menu), merge files, extract pages to a new file, split into several files. Thumbnails can be picked and dragged to reorder pages. Rotate now turns every picked page. All of it can be undone, except writing the extracted and split files.

## [1.0.0] - 2026-10-05
### Added
- Windows installer (`Folio Setup 1.0.0.exe`, per-user, choose the install folder). At install it asks whether Folio should open PDF files by default. App icon.
- No auto-updates and no network use: download new versions by hand.
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
