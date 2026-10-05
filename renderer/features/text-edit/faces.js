import { readableFont } from './style.js';

// The document's fonts as the editor's font list offers them: one face per
// name people know ("Calibri" covers Calibri, Calibri-Bold and so on).
// fonts is what the engine's documentFonts gives: [{ id, family, bold, italic }].
// A line's own font is added when the list lacks it.
// Returns label -> { label, family, fonts }.
export function documentFaces(fonts, line) {
  const all = line && !fonts.some((font) => font.id === line.font.id) ? [...fonts, line.font] : fonts;
  const faces = new Map();
  for (const font of all) {
    const label = readableFont(font.id);
    if (!faces.has(label)) faces.set(label, { label, family: font.family, fonts: [] });
    faces.get(label).fonts.push(font);
  }
  return faces;
}

// The file's fonts to try for a style, best first: the line's own font while
// its style is kept, then the others of the face with the same bold and italic.
export function fontsToReuse(face, style, line) {
  const ids = face.fonts.filter((font) => font.bold === style.bold && font.italic === style.italic).map((font) => font.id);
  const own = line && readableFont(line.font.id) === face.label
    && line.font.bold === style.bold && line.font.italic === style.italic;
  return own ? [line.font.id, ...ids.filter((id) => id !== line.font.id)] : ids;
}
