const test = require('node:test');
const assert = require('node:assert');

const ink = () => import('../renderer/features/signatures/ink.js');
const background = () => import('../renderer/features/signatures/background.js');

const point = (x, y, p = 0.5) => ({ x, y, p });

test('smoothing keeps the ends and pulls a jagged line toward its middle', async () => {
  const { smoothStroke } = await ink();
  const jagged = [point(0, 0), point(10, 10), point(20, 0), point(30, 10)];
  const smooth = smoothStroke(jagged);
  assert.deepStrictEqual([smooth[0], smooth.at(-1)], [jagged[0], jagged.at(-1)]);
  assert.ok(smooth.length > jagged.length);
  const inner = smooth.slice(1, -1).map((p) => p.y);
  assert.ok(Math.min(...inner) > 0 && Math.max(...inner) < 10, 'the sharp peaks are cut');
});

test('a dot or a straight two-point stroke is left alone', async () => {
  const { smoothStroke } = await ink();
  assert.deepStrictEqual(smoothStroke([point(1, 1)]), [point(1, 1)]);
  assert.deepStrictEqual(smoothStroke([point(1, 1), point(5, 5)]), [point(1, 1), point(5, 5)]);
});

test('pressure changes the line width and 0.5 gives the base width', async () => {
  const { widthAt } = await ink();
  assert.strictEqual(widthAt(0.5, 4), 4);
  assert.ok(widthAt(0.1, 4) < 4 && widthAt(1, 4) > 4);
});

test('content bounds find the inked area and ignore faint noise', async () => {
  const { contentBounds } = await ink();
  const pixels = new Uint8ClampedArray(10 * 8 * 4);
  const set = (x, y, alpha) => { pixels[(y * 10 + x) * 4 + 3] = alpha; };
  set(2, 3, 255);
  set(6, 5, 200);
  set(0, 0, 5);
  assert.deepStrictEqual(contentBounds(pixels, 10, 8), { x: 2, y: 3, w: 5, h: 3 });
  assert.strictEqual(contentBounds(new Uint8ClampedArray(40), 5, 2), null);
});

test('white becomes transparent, dark ink stays, grey fades', async () => {
  const { whiteToTransparent } = await background();
  const pixels = new Uint8ClampedArray([
    255, 255, 255, 255, // paper
    20, 20, 60, 255, // ink
    200, 200, 200, 255, // soft edge
    255, 255, 255, 0, // already clear
  ]);
  whiteToTransparent(pixels);
  assert.strictEqual(pixels[3], 0);
  assert.strictEqual(pixels[7], 255);
  assert.ok(pixels[11] > 0 && pixels[11] < 255);
  assert.strictEqual(pixels[15], 0);
  assert.deepStrictEqual([...pixels.slice(4, 7)], [20, 20, 60], 'ink colour is untouched');
});
