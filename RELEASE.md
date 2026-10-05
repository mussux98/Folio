# Releasing Folio (Windows)

## Build
```
npm install
npm test
npm run dist
```
Output: `dist\Folio Setup <version>.exe`. Bump `version` in `package.json` and add the entry to `CHANGELOG.md` first.

## SmartScreen
The installer is not code-signed yet, so Windows shows "Windows protected your PC". Click **More info → Run anyway**.

## Manual checklist (clean Windows machine)
- [ ] Installer runs; the install folder can be changed; the PDF-association question appears.
- [ ] Folio starts from the Start menu and desktop shortcut, with the Folio icon.
- [ ] Open a PDF (dialog, drag-and-drop, double-click when associated); a second PDF opens as a new tab.
- [ ] Password-protected and damaged files show clear messages.
- [ ] Find, zoom, thumbnails, outline, print.
- [ ] Rotate a page, edit a text line, add a text box, place a signature, then Save.
- [ ] Open the saved file in Edge and Acrobat: edits and signature look right.
- [ ] Close with unsaved changes: Folio asks to save.
- [ ] Uninstall removes the app and the "Open with" entry; user data in `%APPDATA%\Folio` is kept.
