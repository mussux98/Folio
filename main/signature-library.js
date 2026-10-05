const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const MAX_SIGNATURES = 30;
const ID_PATTERN = /^[0-9a-f]{32}$/;

// The saved signatures: one PNG per file in a folder of the user data
// (rule 22: the caller passes in app.getPath('userData')). The file's age orders the list.
function createSignatureLibrary(folder) {
  const fileOf = (id) => path.join(folder, `${id}.png`);

  async function list() {
    let names;
    try {
      names = (await fs.readdir(folder)).filter((name) => ID_PATTERN.test(name.slice(0, -4)) && name.endsWith('.png'));
    } catch {
      return [];
    }
    const found = [];
    for (const name of names) {
      try {
        const file = path.join(folder, name);
        const [bytes, stat] = await Promise.all([fs.readFile(file), fs.stat(file)]);
        found.push({ id: name.slice(0, -4), png: new Uint8Array(bytes), time: stat.mtimeMs });
      } catch {
        // A file that vanished or can't be read is just left out (rule 23).
      }
    }
    return found.sort((a, b) => a.time - b.time).map(({ id, png }) => ({ id, png }));
  }

  // Returns the new id, or null when the library is full.
  async function add(png) {
    if ((await list()).length >= MAX_SIGNATURES) return null;
    await fs.mkdir(folder, { recursive: true });
    const id = crypto.randomBytes(16).toString('hex');
    const temp = `${fileOf(id)}.tmp`;
    await fs.writeFile(temp, png);
    await fs.rename(temp, fileOf(id));
    return id;
  }

  async function remove(id) {
    if (!ID_PATTERN.test(id)) return false;
    await fs.rm(fileOf(id), { force: true });
    return true;
  }

  return { list, add, remove };
}

module.exports = { createSignatureLibrary, MAX_SIGNATURES };
