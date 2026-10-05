// Rules for putting the lines of a paragraph back together when text is copied.

const HYPHEN_AT_END = /\p{L}[-­]$/u;
const STARTS_LOWERCASE = /^\p{Ll}/u;

// True when a word was split with a hyphen at the end of this line and
// continues on the next one. A capital after the hyphen is left alone, since
// that is more likely a real dash than a split word.
export function splitsWord(line, next) {
  if (!next || next.block !== line.block) return false;
  return HYPHEN_AT_END.test(line.text.trimEnd()) && STARTS_LOWERCASE.test(next.text.trimStart());
}

// The text to show for a line, and what to put after it.
// After is '' (a split word), ' ' (same paragraph), or '\n' (new paragraph).
export function joinLine(line, next) {
  if (splitsWord(line, next)) return { text: line.text.trimEnd().slice(0, -1), after: '' };
  if (next && next.block === line.block) return { text: line.text, after: /\s$/.test(line.text) ? '' : ' ' };
  return { text: line.text, after: '\n' };
}
