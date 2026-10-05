# Folio

A desktop PDF reader and editor for Windows, built with Electron and [MuPDF.js](https://mupdf.com/).

## Features

- Fast reader: continuous scroll, thumbnails, zoom, outline, clickable links, printing
- Find that ignores case and accents, with a results list and highlights
- Text selection and copy that keeps paragraphs and reading order
- Tabs that remember their page and zoom, plus session restore
- Edit text in place: change, delete or add lines with the original fonts
- Rotate pages, with undo and redo
- Draw or import signatures and place them on a page
- Safe saving: the original file is never damaged if a save fails
- No network use and no telemetry

See [CHANGELOG.md](CHANGELOG.md) for the full list.

## Download

Get the installer from the [Releases](../../releases) page. Windows may show "Windows protected your PC" because the installer is not code-signed yet. Click **More info**, then **Run anyway**.

## Run from source

Requires [Node.js](https://nodejs.org/).

```
npm install
npm start
```

Run the tests with `npm test`. Build the installer with `npm run dist` (see [RELEASE.md](RELEASE.md)).

## License

[AGPL-3.0](LICENSE). Folio uses MuPDF.js, which is AGPL-licensed, so the source of Folio must stay public under the same license.
