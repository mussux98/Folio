const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const RETRIES = 5;
const RETRY_MS = 200;
// Windows reports a file another program holds open with any of these.
const BUSY = ['EBUSY', 'EPERM', 'EACCES'];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function explain(err) {
  if (err.code === 'ENOSPC') return new Error('There is not enough space on the disk.');
  if (err.code === 'EACCES' || err.code === 'EPERM' || err.code === 'EROFS') {
    return new Error('Folio has no permission to save in this folder.');
  }
  if (err.code === 'ENOENT') return new Error('The folder no longer exists.');
  return err;
}

async function refuseReadOnly(filePath) {
  try {
    const { mode } = await fs.stat(filePath);
    if (!(mode & 0o200)) throw new Error('The file is read-only.');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

async function writeTemp(temp, bytes) {
  const handle = await fs.open(temp, 'wx');
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

// Rule 14: the bytes go to a temp file in the same folder, which then replaces
// the original in one step. The original is never written to directly, so a
// failure at any point leaves it as it was. rename and retryMs are for the tests.
async function writeFileAtomic(filePath, bytes, { rename = fs.rename, retryMs = RETRY_MS } = {}) {
  await refuseReadOnly(filePath);
  const temp = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${crypto.randomBytes(4).toString('hex')}.tmp`);
  try {
    await writeTemp(temp, bytes);
  } catch (err) {
    await fs.rm(temp, { force: true });
    throw explain(err);
  }
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(temp, filePath);
      return;
    } catch (err) {
      const busy = BUSY.includes(err.code);
      if (busy && attempt < RETRIES) {
        await wait(retryMs);
        continue;
      }
      await fs.rm(temp, { force: true });
      throw busy ? new Error('The file is in use by another program.') : explain(err);
    }
  }
}

module.exports = { writeFileAtomic };
