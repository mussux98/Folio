const test = require('node:test');
const assert = require('node:assert');

// What Tesseract gives for one line, in pixels at 2 pixels a point.
const line = (words) => ({
  bbox: { x0: 0, y0: 80, x1: 400, y1: 120 },
  baseline: { x0: 0, y0: 110, x1: 400, y1: 118 },
  rowAttributes: { rowHeight: 30 },
  words,
});
const word = (text, x0, confidence = 90) => ({ text, confidence, bbox: { x0, y0: 90, x1: x0 + 60, y1: 112 } });

test('words come out in page points on their baseline, and specks are dropped', async () => {
  const { wordsFrom } = await import('../pdf-engine/ocr-words.js');
  const blocks = [{ paragraphs: [{ lines: [line([word('Hola', 0), word('~', 100, 10), word(' ', 150), word('mundo', 200)])] }] }];
  assert.deepStrictEqual(wordsFrom(blocks, 2), [
    { text: 'Hola', x: 0, y: 55, w: 30, size: 15 },
    { text: 'mundo', x: 100, y: 57, w: 30, size: 15 },
  ]);
  assert.deepStrictEqual(wordsFrom(null, 2), []);
});

test('OCR text on several pages is one undo step', async () => {
  const { addOcrText } = await import('../renderer/commands/ocr.js');
  const calls = [];
  let next = 1;
  const engine = {
    addOcrText: async (_id, index, words) => { calls.push(['add', index]); return words.length ? next++ : null; },
    swapOcrText: async (_id, key, which) => { calls.push([which, key]); },
  };
  const command = addOcrText({ engine, docId: 7 }, [{ index: 0, words: [{}] }, { index: 2, words: [] }, { index: 3, words: [{}] }]);
  assert.deepStrictEqual(command.pages, [0, 2, 3]);
  await command.execute();
  await command.undo();
  await command.execute();
  assert.deepStrictEqual(calls, [['add', 0], ['add', 2], ['add', 3], ['before', 2], ['before', 1], ['after', 1], ['after', 2]]);
});
