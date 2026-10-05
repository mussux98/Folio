import { toCss } from './colors.js';

const NS = 'http://www.w3.org/2000/svg';
const STAMP_NAMES = { NotApproved: 'NOT APPROVED', ForComment: 'FOR COMMENT' };

function svgEl(tag, attrs) {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}

const pathData = (points) => points.map(({ x, y }, i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');

// The two short strokes of an open arrowhead at the end of a line.
function arrowHead([a, b], width) {
  const size = Math.max(6, width * 3);
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const wing = (turn) => ({ x: b.x - size * Math.cos(angle + turn), y: b.y - size * Math.sin(angle + turn) });
  return pathData([wing(Math.PI / 6), b, wing(-Math.PI / 6)]);
}

// A drawing of the shape over the page while it is drawn or dragged, in page
// points like the layer it sits in. The real shape is drawn by the engine.
export function shapeSvg(spec, width, height) {
  const svg = svgEl('svg', { class: 'anno-preview', width, height, viewBox: `0 0 ${width} ${height}` });
  const color = toCss(spec.color);
  const stroke = { fill: 'none', stroke: color, 'stroke-width': spec.width ?? 1, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  if (spec.type === 'Ink') {
    for (const path of spec.paths) svg.append(svgEl('path', { ...stroke, d: pathData(path) }));
  } else if (spec.type === 'Line') {
    svg.append(svgEl('path', { ...stroke, d: pathData(spec.points) }));
    if (spec.arrow) svg.append(svgEl('path', { ...stroke, d: arrowHead(spec.points, spec.width ?? 1) }));
  } else {
    const { x, y, w, h } = spec.rects[0];
    if (spec.type === 'Square') svg.append(svgEl('rect', { ...stroke, x, y, width: w, height: h }));
    if (spec.type === 'Circle') svg.append(svgEl('ellipse', { ...stroke, cx: x + w / 2, cy: y + h / 2, rx: w / 2, ry: h / 2 }));
    if (spec.type === 'Stamp') {
      svg.append(svgEl('rect', { ...stroke, 'stroke-width': 1.5, x, y, width: w, height: h, rx: 3 }));
      const text = svgEl('text', { x: x + w / 2, y: y + h / 2, fill: color, 'font-family': 'Times New Roman, serif', 'font-size': h * 0.55, 'font-weight': 'bold', 'text-anchor': 'middle', 'dominant-baseline': 'central', textLength: w * 0.85, lengthAdjust: 'spacingAndGlyphs' });
      text.textContent = STAMP_NAMES[spec.icon] ?? spec.icon.toUpperCase();
      svg.append(text);
    }
  }
  return svg;
}
