const path = require('path');

const MAX_SESSION_TABS = 100;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

const isPath = (value) => typeof value === 'string' && path.isAbsolute(value);

// Rule 5: everything the renderer sends is checked here. Both functions return
// a clean copy, or null when the payload isn't usable.
function parseSession(value) {
  if (!value || !Array.isArray(value.paths)) return null;
  const paths = value.paths.filter(isPath).slice(0, MAX_SESSION_TABS);
  const active = isPath(value.active) && paths.includes(value.active) ? value.active : null;
  return { paths, active };
}

function parseView(value) {
  if (!value || !isPath(value.path)) return null;
  const { page, zoom } = value;
  if (!Number.isInteger(page) || page < 1) return null;
  if (typeof zoom !== 'number' || !(zoom >= MIN_ZOOM && zoom <= MAX_ZOOM)) return null;
  return { path: value.path, page, zoom };
}

module.exports = { parseSession, parseView };
