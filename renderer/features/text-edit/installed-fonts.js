// The fonts installed on this computer that match a PDF font's name, asked of
// the main process once per name and style. Each answer is
// { key, family, bytes, index }, or null when no installed font fits.
const found = new Map();

export function installedFont(name, { bold, italic }) {
  const id = `${name}|${bold}|${italic}`;
  if (!found.has(id)) found.set(id, folio.findFont({ name, bold, italic }).catch(() => null));
  return found.get(id);
}
