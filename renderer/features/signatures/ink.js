// Turning pen strokes into a picture. A stroke is a list of { x, y, p } points
// (p is the pressure, 0.5 for a mouse).

const PASSES = 2;

// Chaikin corner cutting: each pass replaces every corner with two points a
// quarter of the way along its sides. Hand tremor fades, the ends stay put.
export function smoothStroke(points) {
  let current = points;
  for (let pass = 0; pass < PASSES && current.length > 2; pass++) {
    const next = [current[0]];
    for (let i = 0; i < current.length - 1; i++) {
      const a = current[i];
      const b = current[i + 1];
      next.push(mix(a, b, 0.25), mix(a, b, 0.75));
    }
    next.push(current.at(-1));
    current = next;
  }
  return current;
}

function mix(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, p: a.p + (b.p - a.p) * t };
}

// Lighter pressure draws a thinner line, harder a thicker one; 0.5 gives the base width.
export const widthAt = (pressure, base) => base * (0.4 + pressure * 1.2);

export function drawStrokes(ctx, strokes, { color, width, scale = 1 }) {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const stroke of strokes) {
    const points = smoothStroke(stroke);
    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, widthAt(points[0].p, width) / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    for (let i = 1; i < points.length; i++) {
      ctx.lineWidth = widthAt((points[i - 1].p + points[i].p) / 2, width);
      ctx.beginPath();
      ctx.moveTo(points[i - 1].x, points[i - 1].y);
      ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// The smallest box around everything that isn't transparent, or null for a blank picture.
export function contentBounds(pixels, width, height, threshold = 8) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] <= threshold) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      bottom = y;
    }
  }
  return right < 0 ? null : { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}
