// The layers that sit on top of a page's picture. They are built in PDF points
// and scaled together by the --z variable on the page surface, so they follow
// the zoom without being rebuilt.

import { joinLine } from './text-join.js';

const ruler = document.createElement('canvas').getContext('2d');

function layer(className, width, height) {
  const el = document.createElement('div');
  el.className = className;
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  return el;
}

// What a copied selection gets after a line (see text-join.js): nothing for a
// split word, a space inside a paragraph, a break between paragraphs.
function lineEnd(after) {
  if (after === '\n') return document.createElement('br');
  const space = document.createElement('span');
  space.className = 'line-space';
  space.textContent = after;
  return space;
}

// Invisible text, one block per line, stretched to the width the PDF gives it,
// so the browser can select and copy it. A split word loses its hyphen in the
// copy, so the line is stretched as if it were still there.
export function buildTextLayer(lines, width, height) {
  const el = layer('text-layer', width, height);
  lines.forEach((line, i) => {
    const { text, after } = joinLine(line, lines[i + 1]);
    const row = document.createElement('div');
    row.className = 'text-line';
    row.textContent = text;
    row.style.left = `${line.x}px`;
    row.style.top = `${line.y}px`;
    row.style.height = `${line.h}px`;
    row.style.lineHeight = `${line.h}px`;
    row.style.fontSize = `${line.size}px`;
    ruler.font = `${line.size}px sans-serif`;
    const natural = ruler.measureText(line.text).width;
    if (natural > 0) row.style.transform = `scaleX(${line.w / natural})`;
    el.append(row, lineEnd(after));
  });
  return el;
}

// Clickable areas for links. Internal ones go to a page, external ones are
// handed to the main process, which decides whether they may open (rule 4).
export function buildLinkLayer(links, width, height, { goToPage, openLink }) {
  const el = layer('link-layer', width, height);
  for (const link of links) {
    const area = document.createElement('a');
    area.className = 'link-area';
    area.style.left = `${link.x}px`;
    area.style.top = `${link.y}px`;
    area.style.width = `${link.w}px`;
    area.style.height = `${link.h}px`;
    area.title = link.uri ?? `Go to page ${link.page + 1}`;
    area.addEventListener('click', (event) => {
      event.preventDefault();
      if (link.uri) openLink(link.uri);
      else goToPage(link.page + 1);
    });
    el.append(area);
  }
  return el;
}

// marks: [{ rects, current }], one per search match on this page.
export function buildHighlightLayer(marks, width, height) {
  const el = layer('highlight-layer', width, height);
  for (const mark of marks) {
    for (const rect of mark.rects) {
      const box = document.createElement('div');
      box.className = mark.current ? 'highlight current' : 'highlight';
      box.style.left = `${rect.x}px`;
      box.style.top = `${rect.y}px`;
      box.style.width = `${rect.w}px`;
      box.style.height = `${rect.h}px`;
      el.append(box);
    }
  }
  return el;
}
