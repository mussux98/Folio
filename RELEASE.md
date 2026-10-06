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

# Releasing Folio (Mac)

Needs a Mac, an Apple Developer account ($99/year) and a "Developer ID Application" certificate in the login keychain.

## Build
```
npm install
npm test
APPLE_ID=you@example.com APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx APPLE_TEAM_ID=ABCDE12345 npm run dist:mac
```
The app-specific password is made at appleid.apple.com. Never put these values in a file in the repository. electron-builder signs with the keychain certificate (hardened runtime, `build/entitlements.mac.plist`), submits to Apple's notarization service and staples the ticket. This is the only step that sends anything to Apple; the app itself still makes no network requests.

Output: `dist/Folio-<version>-x64.dmg` and `dist/Folio-<version>-arm64.dmg`.

## Manual checklist (clean Mac)
- [ ] The DMG opens, Folio drags to Applications and starts with no Gatekeeper warning.
- [ ] Double-click a PDF in Finder while Folio is closed, then while it is open: it opens as a tab.
- [ ] Drop a PDF on the Dock icon.
- [ ] The tab bar sits next to the window buttons and the empty part drags the window.
- [ ] Cmd+O, S, W, P, F, G, Z, Shift+Z work; Cmd+Q asks to save changes.
- [ ] Closing the window leaves Folio in the Dock; clicking the Dock icon opens a new window.
- [ ] OCR, redaction, compression, password and forms work in the packaged app (WebAssembly runs under the hardened runtime).
- [ ] Open the saved file in Preview.
