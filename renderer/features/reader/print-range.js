// Turns "1-3, 7, 10-" into page indexes (0-based, ascending, no repeats).
// An empty text means every page. Returns null if the text can't be read or
// names a page the file doesn't have.
export function parsePrintRange(text, count) {
  const source = text.trim();
  if (!source) return Array.from({ length: count }, (_, i) => i);
  const picked = new Set();
  for (const part of source.split(',')) {
    const match = /^\s*(\d*)\s*(-)?\s*(\d*)\s*$/.exec(part);
    if (!match || (!match[1] && !match[3])) return null;
    const first = match[1] ? Number(match[1]) : 1;
    const last = match[2] ? (match[3] ? Number(match[3]) : count) : first;
    if (first < 1 || last > count || first > last) return null;
    for (let page = first; page <= last; page++) picked.add(page - 1);
  }
  return [...picked].sort((a, b) => a - b);
}
