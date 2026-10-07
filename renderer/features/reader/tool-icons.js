// Line icons for the tool strip, drawn on a 24 x 24 grid. Each value is the inside of an <svg>.
export const ICONS = {
  highlight: '<path d="M4 20h7"/><path d="M14.5 4.5l5 5-8 8H6.5v-5z"/>',
  underline: '<path d="M7 4v7a5 5 0 0 0 10 0V4"/><path d="M5 20h14"/>',
  strike: '<path d="M4 12h16"/><path d="M16.5 7.5C16 5.8 14.3 5 12 5c-2.6 0-4.5 1.2-4.5 3.2 0 3.6 9 2.2 9 6.6 0 2.1-2 3.2-4.5 3.2-2.5 0-4.5-.900-5-3"/>',
  note: '<path d="M5 4h14v12l-5 5H5z"/><path d="M14 21v-5h5"/><path d="M8 9h8M8 13h5"/>',
  pen: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="M14.5 6.5l3 3"/>',
  shapes: '<rect x="3" y="11" width="9" height="9" rx="1"/><circle cx="15.5" cy="8.5" r="5"/>',
  stamp: '<path d="M9 4h6v6l3 4v2H6v-2l3-4z"/><path d="M5 20h14"/>',
  text: '<path d="M5 6V4h14v2"/><path d="M12 4v16"/><path d="M9 20h6"/>',
  redact: '<rect x="3" y="9" width="18" height="7" fill="currentColor"/><path d="M3 5h10M3 20h14"/>',
  images: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-9 9"/>',
  sign: '<path d="M3 17c3-6 5-9 6-9s-3 8-1 8 4-6 5-6-1 5 0 5 3-3 4-3"/><path d="M3 21h18"/>',
};

export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name];
  return svg;
}
