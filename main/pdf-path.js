const fs = require('fs/promises');
const path = require('path');

const HEADER_BYTES = 1024;
// The engine keeps a copy in WebAssembly memory, so very large files are refused.
const MAX_READ_BYTES = 1024 * 1024 * 1024;

// Checks a path before Folio treats it as a PDF. Returns { path, name, size }
// or throws an Error whose message can be shown to the user.
// Only the first bytes are read and the handle is closed right away (rule 13).
async function checkPdfPath(filePath) {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
    throw new Error('Not a valid file path.');
  }
  if (path.extname(filePath).toLowerCase() !== '.pdf') {
    throw new Error('Only PDF files can be opened.');
  }

  let handle;
  try {
    handle = await fs.open(filePath, 'r');
    const { size } = await handle.stat();
    const head = Buffer.alloc(Math.min(HEADER_BYTES, size));
    await handle.read(head, 0, head.length, 0);
    if (!head.includes('%PDF-')) throw new Error('This file is not a valid PDF.');
    return { path: filePath, name: path.basename(filePath), size };
  } catch (err) {
    if (err.code === 'ENOENT') throw Object.assign(new Error('The file no longer exists.'), { missing: true });
    if (err.code === 'EACCES' || err.code === 'EPERM') throw new Error('Folio has no permission to read this file.');
    if (err.code === 'EISDIR') throw new Error('Not a valid file path.');
    throw err;
  } finally {
    await handle?.close();
  }
}

// Reads a whole PDF into memory; the handle is closed before this returns (rule 13).
async function readPdf(filePath) {
  const info = await checkPdfPath(filePath);
  if (info.size > MAX_READ_BYTES) throw new Error('This file is too large for Folio to open.');
  return fs.readFile(info.path);
}

// PDF paths from a command line, resolved against the folder it was started in.
// Skips flags and the Electron/app entries that come first in a dev run.
function pdfPathsFromArgv(argv, workingDir) {
  return argv
    .filter((arg) => !arg.startsWith('-') && arg.toLowerCase().endsWith('.pdf'))
    .map((arg) => path.resolve(workingDir, arg));
}

module.exports = { checkPdfPath, readPdf, pdfPathsFromArgv, MAX_READ_BYTES };
