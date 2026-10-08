// What was copied last, so that Ctrl+V pastes that: pages (from the thumbnails) or a
// signature. Each feature keeps its own copy; this only says which one is newer.
let last = null;

export const markCopied = (kind) => { last = kind; };
export const lastCopied = () => last;
