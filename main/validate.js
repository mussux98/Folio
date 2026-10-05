const path = require('path');

const MAX_SESSION_TABS = 100;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
const FIT_MODES = ['width', 'page'];
const MAX_LINK_LENGTH = 4096;
const MAX_NAMES = 100;
const MAX_NAME_LENGTH = 260;
const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const MAX_WRITE_BYTES = 2 * 1024 * 1024 * 1024;

const LINK_PROTOCOLS = ['http:', 'https:', 'mailto:'];

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
  const { page, zoom, fit } = value;
  if (!Number.isInteger(page) || page < 1) return null;
  if (typeof zoom !== 'number' || !(zoom >= MIN_ZOOM && zoom <= MAX_ZOOM)) return null;
  const clean = { path: value.path, page, zoom };
  if (FIT_MODES.includes(fit)) clean.fit = fit;
  return clean;
}

// Rule 4: only these kinds of links ever leave Folio. Returns the URL or null.
function parseExternalLink(value) {
  if (typeof value !== 'string' || value.length > MAX_LINK_LENGTH) return null;
  try {
    const url = new URL(value);
    return LINK_PROTOCOLS.includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

// Tab names for the "Save changes?" question.
function parseNames(value) {
  if (!Array.isArray(value) || value.length > MAX_NAMES) return null;
  const ok = value.every((name) => typeof name === 'string' && name.length > 0 && name.length <= MAX_NAME_LENGTH);
  return ok ? [...value] : null;
}

// A save request: a .pdf path and bytes that look like a PDF.
function parseWrite(filePath, bytes) {
  if (!isPath(filePath) || path.extname(filePath).toLowerCase() !== '.pdf') return null;
  if (!(bytes instanceof Uint8Array) || bytes.length < 5 || bytes.length > MAX_WRITE_BYTES) return null;
  if (Buffer.from(bytes.buffer, bytes.byteOffset, 5).toString('latin1') !== '%PDF-') return null;
  return { filePath, bytes };
}

// A signature picture: bytes that start like a PNG, small enough to keep.
function parseSignaturePng(value) {
  if (!(value instanceof Uint8Array) || value.length < 8 || value.length > MAX_SIGNATURE_BYTES) return null;
  return PNG_MAGIC.every((byte, i) => value[i] === byte) ? value : null;
}

module.exports = { parseSignaturePng, parseSession, parseView, parseExternalLink, parseNames, parseWrite };
