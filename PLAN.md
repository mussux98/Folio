# Folio plan

> 🔁 **Start a new session for each sub-phase below.** Open the session in `Documents\Folio` so it reads `CLAUDE.md`, this plan and `ARCHITECTURE.md`, not old chat history.
> 🧠 **Check the model before you start.** Each sub-phase lists the recommended model. Switch it in the app's model picker.

Status key: ⬜ not started · 🟨 in progress · ✅ done

## Phase 0: Setup · model: **Sonnet** · ✅
- Install Node.js LTS and Git with `winget` (approve the Windows admin prompt).
- Set up the Git identity and run `git init`.
- Scaffold the Electron project following the layout in `ARCHITECTURE.md`. Add electron-builder and MuPDF.js at pinned versions.
- Move `folio.html` (the web prototype) into `prototype/`.
- Lock down the window (rules 1–3), create an empty `shared/ipc-channels.js`, add a test runner, `CHANGELOG.md` and `LICENSE` (AGPL-3.0).
- **Done when:** `npm start` opens an empty, secure Folio window, and the first commit is made.

## Phase 1: First launch (v1.0), reader + text editing + signatures
### 1a. Shell, tabs, files · **Sonnet** · ✅
- Window, native menu (File, Edit, View, Help), right-click menu with Cut, Copy, Paste and Select All.
- Tabs: open, close, switch, reorder; each tab has its own document state.
- Open from the dialog, drag-and-drop, Explorer double-click, and "Open with" (rule 17). Single instance (rule 18).
- Recent files. Remember window size, and the page and zoom per file.
- **Done when:** several PDFs open in tabs and Folio reopens where you left off. Pages may still be blank.

### 1b. Reader on MuPDF.js · **Sonnet** · ✅
- `pdf-engine/` in a Web Worker: open, page count, render page, extract text.
- Continuous scroll, lazy rendering, cancellation (rules 19–20), thumbnails, zoom (fit width, fit page, %, Ctrl+wheel), page navigation, keyboard shortcuts from the prototype.
- Text selection and copy, Find with a results list and highlights, the document outline (table of contents), printing.
- Clear errors for broken or password-protected files, with a password prompt.
- **Done when:** it matches or beats `prototype/folio.html` and stays smooth on a 1,000-page file.
- **Finished and tested on real PDFs.** Print speed is parked under "Later improvements".

### 1c. Editing foundation · **Opus** · ✅
- Command pattern with undo/redo (Ctrl+Z / Ctrl+Y), per tab.
- Dirty flag, "Save changes?" on closing a tab, window or the app (rule 15).
- Save and Save As with atomic writes (rule 14).
- Coordinate utilities, screen ↔ PDF points (rule 21), with tests on rotated and cropped pages.
- **Done when:** a test edit can be undone and redone, saved safely, and survives reopening.
- **Finished and tested.** The test edit is page rotation (Edit → Rotate Page, Ctrl+R / Ctrl+Shift+R). Save rewrites the whole file: a second incremental save from MuPDF produces a broken file.

### 1d. Signatures · **Sonnet** · ✅
- Create a signature by drawing (mouse, pen or touch, with smoothing) or by importing an image (PNG/JPG, with optional background removal for white).
- Saved signatures library, stored locally in `userData`.
- Place, move, resize, turn (quarter turns), replace and delete a signature on any page, with undo. This works on every image stamp in a file, including ones from earlier sessions and other programs. It is written into the PDF on Save.
- **Done when:** you can sign a real document, save it, and the signature shows correctly in Edge and Acrobat.
- **Finished and tested, including in Edge and Acrobat.** A signature is a Stamp annotation (Sign button or Edit → Sign…). Rotating a page after signing it turns the signature with the page. Stamps made by other programs are edited the same way, but turning or replacing one redraws it from its plain picture.

### 1e. Editing existing text · **Opus**
Split in two so each half is tested on its own.

#### 1e-i. Edit lines and add text with standard fonts · ✅
- Click a text line to edit it in place, with its size, color, bold and italic, and the closest standard font (Helvetica, Times or Courier).
- With MuPDF.js: remove the original glyphs (true removal, not covering) and write the new text in the same position.
- Tell the user when the standard font is not the line's own font.
- Add new text boxes anywhere.
- Known limits stated in the UI: text that reflows across lines, and scanned pages (no real text).
- **Finished and tested, including in Edge and Acrobat.** Edit Text button, Edit → Edit Text or Ctrl+E. Enter or Done keeps a change, Esc cancels it, and emptying a line deletes it. Undo swaps the page's old content back in. Save leaves out everything no page uses any more, so the removed text and unused fonts are gone from the file. Text outside WinAnsi embeds MuPDF's copy of the standard font. Characters no standard font has are refused with a message. Only horizontal text can be edited, and longer text grows to the right even when the original was centered.

#### 1e-ii. Reuse embedded fonts · ✅
- Reuse the line's embedded font when it contains the needed characters, so edits keep the original look (e.g. Arial or Calibri). Otherwise keep the standard font and the notice.
- Known limit to state in the UI: subset fonts missing characters.
- **Done when:** text edits on typical documents (letters, invoices, forms) save cleanly and look right in other readers.
- **Finished and tested.** An edited line keeps its font: the file's own copy when every letter is drawn with it somewhere in the document, else the same font installed on this computer (found by name in the system font folders, only if its maker allows embedding), else the closest standard font with a notice. The font list offers the document's fonts by name, then Sans, Serif and Mono, for edited lines and new text boxes. Installed fonts go in whole and Save keeps only the letters used. Spaces a subset lacks are written as gaps of the line's own space width.

### 1f. Release v1.0 for Windows · **Sonnet** · ✅
- electron-builder NSIS installer, file association for `.pdf` (optional, asked at install), app icon.
- Manual release checklist, `CHANGELOG.md`, version 1.0.0.
- Code signing: decide later. Until then, document the SmartScreen "More info → Run anyway" step.
- **Done when:** `Folio Setup 1.0.0.exe` installs and runs on a clean Windows machine.
- **Built and tested here:** `npm run dist` makes the installer (per-user NSIS, asks about the PDF association); the packaged app opens and renders a PDF; silent install and uninstall work. The checklist in `RELEASE.md` still has to be run by hand on a clean machine. No auto-updates, no code signing for 1.0.

## Phase 2: Page tools · **Sonnet** · ✅
Rotate, delete, reorder (drag thumbnails), insert, extract, merge PDFs, split.
- **Built:** a **Pages** menu. Thumbnails can be picked (click, Ctrl/Cmd, Shift, Ctrl+A) and dragged to reorder; Delete key removes the picked pages. Rotate, delete, move, insert blank page, insert pages from files and merge are undoable commands. Extract and split write new files and leave the document alone (split asks pages per file and a folder; it never overwrites).
- **Tested:** engine, commands, validation and part naming have automated tests. Delete, undo, drag-reorder, insert blank and rotate were driven in the running app. The native file and folder dialogs (insert from file, merge, extract, split) were **not** clicked through by hand; check them once.
- **Copy, cut and paste pages** (Ctrl+C/X/V with the thumbnails focused, or the Pages menu) work between tabs; the copy stays inside Folio and is lost on quit. Tested in the running app across two tabs.
- Pages are tracked by position, so these commands rely on undo running in reverse order (it does).

## Phase 3: Annotations · **Sonnet** (Opus for coordinate-heavy parts) · ✅
Highlight, underline, strikethrough, sticky notes, freehand drawing, shapes, stamps.
- **3a · text markup and sticky notes · ✅.** Select text, then Highlight / Underline / Strike (one undo step even across pages). Note: click a page, type, click away. Click a markup line or a note to recolour, edit or delete it, including ones already in the file. Highlights are written with square ends and multiply blend.
- **3b · freehand, shapes, stamps · ✅.** Pen (stays on until Esc), Shapes menu (rectangle, ellipse, line, arrow; Shift for square, circle, 45°) and Stamp menu (Approved, Not Approved, Draft, Final, Confidential, For Comment). Click a drawing to recolour, change its thickness, drag it, or resize a box shape from its corners (stamps keep their shape); ink is move-only. Shapes are outlines only. Stamps are counter-turned so they stay upright on rotated pages. Picture stamps stay with signatures.

## Phase 4: Forms · **Sonnet** · ✅
Fill form fields, save. Flatten was left out on purpose (decided with the user).
- **Built:** text (single and multi-line, max length), checkbox, radio, drop-down (also editable) and list fields are filled in over the page. Tab goes field to field, Esc reverts, each change is an undoable command, and Save writes the answers. Read-only fields, signature fields (signing is done with stamps), push buttons and form scripts are skipped.
- **Tested:** engine tests on a generated form (`tests/fixtures/make-form.mjs`): list, fill, limits, radio groups, save and reopen, rotated pages. Driven in the running app: typing, Tab across a redraw, checkbox, radio, drop-down, list, undo and Save.
- **Known limits:** multi-select lists take one choice; on a rotated page the typing box stays upright while the saved text turns with the page; the typing boxes always show (no hide toggle).

## Phase 5: Advanced · **Opus** · 🟨 (5a, 5b done)
True redaction, OCR (Tesseract.js, offline), compression, password protection. Split in four, one session each.
- **5a · true redaction · ✅.** Redact (toolbar, Edit → Redact or Ctrl+Shift+X) removes the selected text at once; with nothing selected it turns on redact mode, where each area dragged over a page is removed. Esc ends it. Text under the area is taken out (not covered), images lose the covered pixels, drawings fully inside it go. A Black box option (on by default) leaves a box in its place. Each redaction is one undo step; Save leaves the removed content out of the file. Selected text is redacted as a band through the middle of each line, since whole line boxes overlap the lines next to them.
  - **Tested:** engine tests (text gone and back on undo, several areas, box or none, image pixels, saved file, turned page). Driven in the running app: drag with and without box, selected word, Esc, Undo/Redo from the menu, Save, and the saved file checked for the removed words.
  - **Known limits:** annotations over the area (notes, highlights) are kept; partly covered lines and shapes stay under the box.
- **5b · password protection · ✅.** Protected files ask for their password when opened (built in Phase 1). File → Password… sets, changes or removes the password that opens the file, with AES-256. It is an undoable edit like any other and takes effect on the next Save. A protected file saved without touching it keeps its password. Owner passwords and permissions (no printing, no copying) were left out on purpose: readers don't enforce them reliably.
  - **Tested:** engine tests (kept on plain save, set on a plain file, changed, removed, undone back to the file's own, comma refused, fonts still cut down in a protected file). Driven in the running app: menu on a locked tab does nothing, change, remove, undo, set on a plain file, mismatch and comma messages, Save, and each saved file checked for its password.
  - **Known limits:** a password can't contain a comma (MuPDF's save options are split at commas); setting a password on a file that only had permissions drops those permissions.
- **5c · compression · ⬜.** A save option that makes the file smaller.
- **5d · OCR · ⬜.** Tesseract.js offline, adds an invisible text layer to scanned pages.

## Phase 6: Mac launch · **Sonnet** · ⬜
Mac `open-file` event, `hiddenInset` title bar, Mac menus, Apple Developer ID signing and notarization (`@electron/notarize`, $99/year), DMG.

## Later improvements (not scheduled)
- **Edit images that are part of the page:** a scanned signature, a logo or a flattened signature is page content, not a stamp, so it can't be moved like one. Delete would remove the image with a MuPDF redaction (with a warning, since it can touch what lies under it). Move and resize would lift the image into a stamp and redact the original. It can't separate a signature merged into a full-page scan. Best done after 1e, which also changes page content. Model: **Opus**.
- **Any installed font when editing text:** a font picker with search, each name shown in its own font. The chosen font is embedded and cut down on Save. Today the font list offers the document's own fonts plus Sans, Serif and Mono.
- **Bundled look-alike fonts:** ship Liberation Sans/Serif/Mono, Carlito and Caladea (OFL/Apache, about 3–5 MB). They have the same letter widths as Arial, Times, Courier, Calibri and Cambria, so edits keep the layout when the file's subset lacks a letter and the font isn't installed (most of all on Mac).
- **Faster printing:** printing renders every page at 150 dpi before the dialog opens, so big files are slow. Ask for a page range first and render only those pages.

## Open decisions
- **Auto-updates:** none for 1.0 (decided). Revisit with an opt-in check later.
- **Windows code signing:** none for 1.0 (decided); SmartScreen step documented in `RELEASE.md`.
- **Commercial MuPDF license:** only if Folio is sold as closed-source.
