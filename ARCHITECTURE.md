# Folio architecture

## Stack
- **Electron**: desktop shell. Windows first; Mac after Windows v1 is complete.
- **MuPDF.js** (WebAssembly, AGPL-3.0): the only PDF engine. It renders pages, extracts text, edits text, redacts, and writes the saved file.
- **Plain JavaScript** (ES modules). No UI framework until one is clearly needed.
- **electron-builder**: Windows installer (NSIS); Mac later.

## Layout
```
main/                 main process: windows, menus, file I/O, dialogs, settings, printing
  main.js             startup, single instance, wiring
  window.js           the window, CSP, saved size and position
  menu.js             native menu
  documents.js        openDocument(): the one way files get opened (rule 17)
  pdf-path.js         checks a path is a real PDF, reads command-line files
  settings.js         settings.json in userData (recent, views, session)
  signature-library.js  saved signature pictures in userData/signatures
  validate.js         checks what the renderer sends (rule 5)
  ipc.js              IPC handlers
  preload.js          exposes only the functions listed in shared/ipc-channels.js
shared/
  ipc-channels.js     the single list of every IPC message
renderer/             the window UI
  index.html, styles.css, app.js
  state/              single owner of app state (tabs, documents, view)
  features/           one module per feature: tabs, reader/ (viewer, thumbnails, outline,
                      find, print, ...), signatures, text-edit, ...
  commands/           undo/redo command objects
pdf-engine/           the ONLY code that talks to MuPDF.js
  engine.js           the MuPDF calls (also run directly by the tests)
  worker.js           runs engine.js in a Web Worker
  client.js           the app's side: queue, priorities, cancellation
tests/
```

## Rules

### Security
1. Every window uses `contextIsolation: true`, `sandbox: true` and `nodeIntegration: false`.
2. No remote code. Every script, font, library and WASM file ships inside the app.
3. A strict Content Security Policy: only the app's own scripts may run.
4. Links inside PDFs open in the system browser, never in Folio, and only for `http`, `https` and `mailto`.
5. The main process validates every IPC request (types, paths, `.pdf` extension, sizes).
6. **Zero phone-home.** No analytics or background network requests. Auto-updates are undecided; any update check must be opt-in.

### Separation of responsibilities
7. The main process does OS work (files, menus, dialogs, settings, printing). The renderer does display and interaction. Neither does the other's job.
8. Every IPC channel is defined in `shared/ipc-channels.js`. If it isn't listed there, it doesn't exist.
9. Only `pdf-engine/` imports MuPDF.js. The rest of the app calls its API (`openDocument`, `renderPage`, `getText`, `replaceText`, `addImage`, `save`, ...). The engine runs in a Web Worker so the UI never freezes.

### Code organization
10. Small modules split by feature, each a few hundred lines at most.
11. One state owner (`renderer/state/`). Features read from it and react to changes; they don't keep private copies.
12. One tab is one document state: file path, page, zoom, undo stack, dirty flag.

### Documents and files
13. **No file locks.** Read the whole file into memory, then close the handle at once, so Explorer can still move or rename the PDF.
14. **Atomic saves.** Write to a temp file in the same folder, then rename it over the original. On `EBUSY`/`EPERM`, retry briefly, then tell the user "the file is in use by another program". Never write directly over the original.
15. **Unsaved changes.** Each tab has a dirty flag. Closing a tab, a window or the app shows a native "Save changes?" dialog from the main process (window `close` event), not from `beforeunload`.
16. **Undo/redo.** Every edit is a command object with `execute()` and `undo()`. Edits stay in memory and are written into the PDF only on Save or Export.
17. **One entry point for opening files.** Explorer arguments, the second-instance event, Mac `open-file` (registered before `ready`), drag-and-drop and the Open dialog all go through `openDocument(path)`.
18. **Single instance.** `app.requestSingleInstanceLock()`. A PDF opened while Folio runs becomes a new tab in the existing window.

### Rendering and coordinates
19. Render only visible pages, plus a margin. Cancel outdated renders when the user scrolls or zooms. Limit how many renders run at once, and free canvases far off-screen.
20. Never blank a page while it re-renders. Draw into a new canvas and swap it in when done.
21. Store every position (signatures, text edits, annotations) in **PDF points** relative to the page. Never store screen pixels. Convert only through the engine's page transform, which handles y-flip, `/Rotate` and crop-box offsets.

### Cross-platform
22. No Windows-only assumptions: use `path.join`, `CmdOrCtrl` accelerators and `app.getPath('userData')`. Platform-specific code lives in clearly marked places.

### Quality
23. Fail gracefully. A broken, encrypted or huge PDF shows a clear message and never crashes or freezes the app.
24. Performance budget: a 1,000-page file scrolls smoothly with stable memory. Keep heavy test PDFs in `tests/fixtures/`.
25. Automated tests for logic (engine API, commands, save, IPC validation), plus a manual checklist before each release.
26. Exact dependency versions, locked by `package-lock.json`. Upgrade Electron and MuPDF.js deliberately.

### Workflow
27. Git from day one. Make small commits with clear messages.
28. Semantic versioning and a `CHANGELOG.md`.
