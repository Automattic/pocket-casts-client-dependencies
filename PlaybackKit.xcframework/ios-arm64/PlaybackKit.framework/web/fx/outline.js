// Outlines that are drawn by hand rather than described by a formula: the Custom
// shape (`pts`) and the Reveal mask (`pts2`). Each is a closed ring of points in
// fractions of the reference frame, `[x, y, smooth]`, traced as a Catmull-Rom curve
// through every point (smooth = 0 makes that one point a corner). The analytic shapes
// (circle, squares, ring) are drawn on the GPU instead; see pattern.js.
//
// Rasterised with Canvas2D into a canvas the size of the render buffer, then uploaded.
// Results are cached by everything that affects the pixels, so a static outline is
// drawn once, not once a frame.

const DEFAULT_RING = [[0.5, 0.1, 1], [0.9, 0.5, 1], [0.5, 0.9, 1], [0.1, 0.5, 1]];

export function ringOf(v, id) {
  const pts = v[id];
  return Array.isArray(pts) && pts.length >= 3 ? pts : DEFAULT_RING;
}

/**
 * Where a ring point lands in canvas pixels. Points are fractions of the frame placed
 * about its centre, scaled by Size about the shape's own centre and moved with it, so
 * Size, X and Y mean for a custom outline what they mean for every other shape.
 */
export function ringPlacer(F, v) {
  const k = (v.shapeSize ?? 100) / 100;
  const cx = F.x(v.shapeX ?? 50), cy = F.y(v.shapeY ?? 50);
  return {
    x: (u) => cx + (u - 0.5) * F.w * k,
    y: (u) => cy + (u - 0.5) * F.h * k,
  };
}

/** Trace the ring as cubic beziers (Catmull-Rom with tension `smooth`, 0..1). */
export function traceRing(c, pts, place, smooth) {
  const n = pts.length, k = Math.max(0, Math.min(1, smooth)) / 6;
  const P = (i) => pts[((i % n) + n) % n];
  const X = (i) => place.x(P(i)[0]), Y = (i) => place.y(P(i)[1]);
  const soft = (i) => (P(i)[2] === 0 ? 0 : 1);
  c.beginPath();
  c.moveTo(X(0), Y(0));
  for (let i = 0; i < n; i++) {
    const t1 = k * soft(i), t2 = k * soft(i + 1);
    c.bezierCurveTo(
      X(i) + (X(i + 1) - X(i - 1)) * t1, Y(i) + (Y(i + 1) - Y(i - 1)) * t1,
      X(i + 1) - (X(i + 2) - X(i)) * t2, Y(i + 1) - (Y(i + 2) - Y(i)) * t2,
      X(i + 1), Y(i + 1),
    );
  }
  c.closePath();
}

/**
 * How far a custom outline's alpha gradient reaches from the shape centre: to the
 * furthest bezier control point, which bounds the curve, scaled by Alpha size.
 */
export function ringReach(pts, place, cx, cy, smooth) {
  const n = pts.length, k = Math.max(0, Math.min(1, smooth)) / 6;
  const P = (i) => pts[((i % n) + n) % n];
  let r = 0;
  const reach = (x, y) => { r = Math.max(r, Math.hypot(x - cx, y - cy)); };
  for (let i = 0; i < n; i++) {
    const x = place.x(P(i)[0]), y = place.y(P(i)[1]);
    const t = k * (P(i)[2] === 0 ? 0 : 1);
    const ax = (place.x(P(i + 1)[0]) - place.x(P(i - 1)[0])) * t;
    const ay = (place.y(P(i + 1)[1]) - place.y(P(i - 1)[1])) * t;
    reach(x, y); reach(x + ax, y + ay); reach(x - ax, y - ay);
  }
  return Math.max(1, r);
}

/** A reusable 2D canvas plus the key of what is currently drawn on it. */
export function rasterCache(width, height) {
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : Object.assign(document.createElement('canvas'), { width, height });
  return { canvas, ctx: canvas.getContext('2d'), key: '' };
}

/**
 * The custom shape's coverage: the ring filled with its alpha (solid, radial or linear
 * fall-off), times Opacity. Only alpha is ever read.
 */
export function drawCustomShape(cache, F, v) {
  const pts = ringOf(v, 'pts');
  const smooth = (v.shapeSmooth ?? 70) / 100;
  const key = ['shape', cache.canvas.width, cache.canvas.height, F.unit, v.shapeSize, v.shapeX, v.shapeY, smooth, v.shapeFill, v.shapeAlpha, v.shapeFade, v.shapeFillSize, v.shapeFillA, JSON.stringify(pts)].join();
  if (cache.key === key) return false;
  const { ctx: c, canvas } = cache;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, canvas.width, canvas.height);
  const place = ringPlacer(F, v);
  const cx = F.x(v.shapeX ?? 50), cy = F.y(v.shapeY ?? 50);
  const opacity = Math.max(0, Math.min(1, (v.shapeAlpha ?? 100) / 100));
  const fade = Math.max(0, Math.min(1, (v.shapeFade ?? 45) / 100));
  const reach = ringReach(pts, place, cx, cy, smooth) * ((v.shapeFillSize ?? 100) / 100);
  const ink = (a) => `rgba(255,255,255,${(opacity * a).toFixed(4)})`;
  const fill = Math.round(v.shapeFill || 0);
  if (fill === 1) {
    const g = c.createRadialGradient(cx, cy, reach * fade, cx, cy, reach);
    g.addColorStop(0, ink(1)); g.addColorStop(1, ink(0));
    c.fillStyle = g;
  } else if (fill === 2) {
    const a = ((v.shapeFillA || 0) * Math.PI) / 180, dx = Math.cos(a) * reach, dy = Math.sin(a) * reach;
    const g = c.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    g.addColorStop(0, ink(1)); g.addColorStop(Math.min(0.999, fade), ink(1)); g.addColorStop(1, ink(0));
    c.fillStyle = g;
  } else {
    c.fillStyle = ink(1);
  }
  traceRing(c, pts, place, smooth);
  c.fill();
  cache.key = key;
  return true;
}

/**
 * A ring drawn solid, to be blurred on the GPU: the custom shape's Contain boundary
 * (`grow` 0: the blur straddles the outline) or the Reveal mask (`grow` > 0: the ring
 * is first grown outward by that many pixels, so the blur's fall-off lands outside
 * the outline and a copy of the shape starts out hiding nothing). The blur is the
 * pipeline's own rather than Canvas2D's `filter`, which older WebKit does not have.
 */
export function drawSolidRing(cache, F, v, id, grow) {
  const pts = ringOf(v, id);
  const smooth = (v.shapeSmooth ?? 70) / 100;
  const key = [id, cache.canvas.width, cache.canvas.height, F.unit, v.shapeSize, v.shapeX, v.shapeY, smooth, grow.toFixed(2), JSON.stringify(pts)].join();
  if (cache.key === key) return false;
  const { ctx: c, canvas } = cache;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#fff';
  c.strokeStyle = '#fff';
  traceRing(c, pts, ringPlacer(F, v), smooth);
  c.fill();
  if (grow > 0.5) {
    c.lineJoin = 'round';
    c.lineWidth = grow * 2;
    c.stroke();
  }
  cache.key = key;
  return true;
}
