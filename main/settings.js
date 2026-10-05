const fs = require('fs');
const path = require('path');

const MAX_RECENT = 10;
const MAX_VIEWS = 200;
const SAVE_DELAY_MS = 300;

const DEFAULTS = () => ({
  window: { width: 1200, height: 800, maximized: false },
  recent: [],
  views: {},
  session: { paths: [], active: null },
});

// Small JSON store in the user data folder. Reads once, writes a moment after
// the last change, and never throws on a missing or damaged file (rule 23).
class Settings {
  constructor(file) {
    this.file = file;
    this.data = this.load();
    this.timer = null;
  }

  load() {
    try {
      const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return { ...DEFAULTS(), ...saved };
    } catch {
      return DEFAULTS();
    }
  }

  // Temp file + rename so a crash can't leave half a settings file.
  flush() {
    clearTimeout(this.timer);
    this.timer = null;
    const temp = `${this.file}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(temp, JSON.stringify(this.data, null, 2));
      fs.renameSync(temp, this.file);
    } catch (err) {
      console.error('Could not save settings:', err.message);
    }
  }

  save() {
    if (!this.timer) this.timer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
  }

  get windowState() {
    return this.data.window;
  }

  setWindowState(state) {
    this.data.window = state;
    this.save();
  }

  get recent() {
    return this.data.recent;
  }

  addRecent(filePath) {
    const rest = this.data.recent.filter((p) => p !== filePath);
    this.data.recent = [filePath, ...rest].slice(0, MAX_RECENT);
    this.save();
  }

  removeRecent(filePath) {
    this.data.recent = this.data.recent.filter((p) => p !== filePath);
    this.save();
  }

  clearRecent() {
    this.data.recent = [];
    this.save();
  }

  getView(filePath) {
    return this.data.views[filePath] ?? { page: 1, zoom: 1, fit: 'width' };
  }

  // Newest entries go last; the oldest are dropped past the limit.
  setView(filePath, { page, zoom, fit }) {
    delete this.data.views[filePath];
    this.data.views[filePath] = fit ? { page, zoom, fit } : { page, zoom };
    const paths = Object.keys(this.data.views);
    for (const old of paths.slice(0, Math.max(0, paths.length - MAX_VIEWS))) {
      delete this.data.views[old];
    }
    this.save();
  }

  get session() {
    return this.data.session;
  }

  setSession(session) {
    this.data.session = session;
    this.save();
  }
}

module.exports = { Settings, MAX_RECENT, MAX_VIEWS };
