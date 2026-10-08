// What was copied last, so that Ctrl+V pastes that: pages (from the thumbnails) or a
// signature. Pages keep their own copy in the page tools; a signature's picture and box
// are kept here, so a signature stamp and a picture of the page can both be pasted.
let last = null;
let item = null;

export const markCopied = (kind, data = null) => {
  last = kind;
  item = data;
};
export const lastCopied = () => last;
// { png, rect, tabId, index } of the copied signature, or null.
export const copiedSignature = () => (last === 'signature' ? item : null);
