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

### 1b. Reader on MuPDF.js · **Sonnet** · ⬜
- `pdf-engine/` in a Web Worker: open, page count, render page, extract text.
- Continuous scroll, lazy rendering, cancellation (rules 19–20), thumbnails, zoom (fit width, fit page, %, Ctrl+wheel), page navigation, keyboard shortcuts from the prototype.
- Text selection and copy, Find with a results list and highlights, the document outline (table of contents), printing.
- Clear errors for broken or password-protected files, with a password prompt.
- **Done when:** it matches or beats `prototype/folio.html` and stays smooth on a 1,000-page file.

### 1c. Editing foundation · **Opus** · ⬜
- Command pattern with undo/redo (Ctrl+Z / Ctrl+Y), per tab.
- Dirty flag, "Save changes?" on closing a tab, window or the app (rule 15).
- Save and Save As with atomic writes (rule 14).
- Coordinate utilities, screen ↔ PDF points (rule 21), with tests on rotated and cropped pages.
- **Done when:** a test edit can be undone and redone, saved safely, and survives reopening.

### 1d. Signatures · **Sonnet** · ⬜
- Create a signature by drawing (mouse, pen or touch, with smoothing) or by importing an image (PNG/JPG, with optional background removal for white).
- Saved signatures library, stored locally in `userData`.
- Place, move, resize and delete a signature on any page, with undo. It is written into the PDF on Save.
- **Done when:** you can sign a real document, save it, and the signature shows correctly in Edge and Acrobat.

### 1e. Editing existing text · **Opus** · ⬜
- Click a text line or block to edit it in place, with the original font, size and color where possible.
- With MuPDF.js: remove the original glyphs (true removal, not covering) and write the new text in the same position.
- Font handling: reuse the embedded font when it contains the needed characters; otherwise fall back to the closest standard font, and tell the user when a fallback is used.
- Add new text boxes anywhere.
- Known limits, to state honestly in the UI: subset fonts missing characters, text that reflows across lines, and scanned pages (no real text).
- **Done when:** text edits on typical documents (letters, invoices, forms) save cleanly and look right in other readers.

### 1f. Release v1.0 for Windows · **Sonnet** · ⬜
- electron-builder NSIS installer, file association for `.pdf` (optional, asked at install), app icon.
- Manual release checklist, `CHANGELOG.md`, version 1.0.0.
- Code signing: decide later. Until then, document the SmartScreen "More info → Run anyway" step.
- **Done when:** `Folio Setup 1.0.0.exe` installs and runs on a clean Windows machine.

## Phase 2: Page tools · **Sonnet** · ⬜
Rotate, delete, reorder (drag thumbnails), insert, extract, merge PDFs, split.

## Phase 3: Annotations · **Sonnet** (Opus for coordinate-heavy parts) · ⬜
Highlight, underline, strikethrough, sticky notes, freehand drawing, shapes, stamps.

## Phase 4: Forms · **Sonnet** · ⬜
Fill form fields, save, flatten.

## Phase 5: Advanced · **Opus** · ⬜
True redaction, OCR (Tesseract.js, offline), compression, password protection.

## Phase 6: Mac launch · **Sonnet** · ⬜
Mac `open-file` event, `hiddenInset` title bar, Mac menus, Apple Developer ID signing and notarization (`@electron/notarize`, $99/year), DMG.

## Open decisions
- **Auto-updates:** none, or an opt-in check (rule 6). Decide before 1f.
- **Windows code signing:** Azure Trusted Signing vs a certificate vs none. Decide before 1f.
- **Commercial MuPDF license:** only if Folio is sold as closed-source.
