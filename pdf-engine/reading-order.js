// MuPDF lists text in the order it was drawn, which can put a footer before the
// body. This puts the lines in the order a person reads: top to bottom, and left
// to right for blocks that sit on the same row. Lines of one block stay together.
export function inReadingOrder(lines) {
  const blocks = new Map();
  for (const line of lines) {
    if (!blocks.has(line.block)) blocks.set(line.block, { top: line.y, left: line.x, size: line.size, lines: [] });
    const block = blocks.get(line.block);
    block.top = Math.min(block.top, line.y);
    block.left = Math.min(block.left, line.x);
    block.lines.push(line);
  }

  const byTop = [...blocks.values()].sort((a, b) => a.top - b.top);
  const ordered = [];
  // Blocks whose tops are within half a line of each other count as one row.
  for (let i = 0; i < byTop.length;) {
    const row = [byTop[i++]];
    while (i < byTop.length && byTop[i].top - row[0].top < row[0].size / 2) row.push(byTop[i++]);
    row.sort((a, b) => a.left - b.left);
    for (const block of row) ordered.push(...block.lines);
  }
  return ordered;
}
