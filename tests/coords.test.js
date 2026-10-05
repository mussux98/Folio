const test = require('node:test');
const assert = require('node:assert');

const load = async () => {
  const coords = await import('../pdf-engine/coords.js');
  const { createEngine } = await import('../pdf-engine/engine.js');
  const { makePdf } = await import('./fixtures/make-pdf.mjs');
  return { ...coords, engine: createEngine(), makePdf };
};

const near = (actual, expected) => {
  assert.ok(Math.abs(actual.x - expected.x) < 1e-6 && Math.abs(actual.y - expected.y) < 1e-6,
    `${JSON.stringify(actual)} should be ${JSON.stringify(expected)}`);
};

// One 300 x 400 page per case; the crop box is 200 x 300.
async function pages() {
  const c = await load();
  const crop = [50, 60, 250, 360];
  const { id } = c.engine.openDocument(c.makePdf([
    { text: 'plain' },
    { text: 'turned', rotate: 90 },
    { text: 'cropped', crop },
    { text: 'both', rotate: 90, crop },
    { text: 'upside down', rotate: 180 },
    { text: 'left', rotate: 270, crop },
  ]));
  const transform = (i) => c.engine.pageTransform(id, i);
  return { ...c, id, transform };
}

test('the top-left corner of the visible page is the page origin', async () => {
  const { transform, pdfToPage } = await pages();
  near(pdfToPage(transform(0), { x: 0, y: 400 }), { x: 0, y: 0 });
  near(pdfToPage(transform(0), { x: 20, y: 350 }), { x: 20, y: 50 });
  near(pdfToPage(transform(2), { x: 50, y: 360 }), { x: 0, y: 0 });
  near(pdfToPage(transform(2), { x: 250, y: 60 }), { x: 200, y: 300 });
});

test('rotated pages turn clockwise', async () => {
  const { transform, pdfToPage } = await pages();
  // Turned 90 degrees: the left edge of the file's page is now the top edge.
  near(pdfToPage(transform(1), { x: 0, y: 0 }), { x: 0, y: 0 });
  near(pdfToPage(transform(1), { x: 0, y: 400 }), { x: 400, y: 0 });
  near(pdfToPage(transform(4), { x: 300, y: 0 }), { x: 0, y: 0 });
  near(pdfToPage(transform(3), { x: 50, y: 60 }), { x: 0, y: 0 });
  near(pdfToPage(transform(3), { x: 50, y: 360 }), { x: 300, y: 0 });
  near(pdfToPage(transform(5), { x: 250, y: 360 }), { x: 0, y: 0 });
});

test('points survive a round trip on every kind of page', async () => {
  const { transform, pdfToPage, pageToPdf } = await pages();
  for (let i = 0; i < 6; i++) {
    for (const point of [{ x: 0, y: 0 }, { x: 13.5, y: 77 }, { x: 199, y: 299 }]) {
      near(pdfToPage(transform(i), pageToPdf(transform(i), point)), point);
    }
  }
});

test('rects keep their size and stay inside the crop box', async () => {
  const { transform, pageRectToPdf, pdfRectToPage } = await pages();
  const whole = { x: 0, y: 0, w: 300, h: 200 };
  assert.deepStrictEqual(pageRectToPdf(transform(3), whole).map(Math.round), [50, 60, 250, 360]);
  const back = pdfRectToPage(transform(3), [50, 60, 250, 360]);
  assert.deepStrictEqual([back.x, back.y, back.w, back.h].map(Math.round), [0, 0, 300, 200]);
});

test('text found on a turned page maps back to where the file draws it', async () => {
  const { engine, id, transform, pageRectToPdf } = await pages();
  // The fixture starts its text at x 20 on the baseline y 350.
  const [line] = engine.getText(id, 1);
  const [x0, y0, x1, y1] = pageRectToPdf(transform(1), line);
  assert.ok(Math.abs(x0 - 20) < 2, `starts at ${x0}`);
  assert.ok(y0 < 350 && y1 > 350, `${y0}..${y1} holds the baseline`);
  assert.ok(x1 > x0);
});

test('screen pixels are page points times the zoom', async () => {
  const { pageToScreen, screenToPage } = await load();
  near(pageToScreen({ x: 10, y: 20 }, 1.5), { x: 15, y: 30 });
  near(screenToPage({ x: 15, y: 30 }, 1.5), { x: 10, y: 20 });
});
