// Motion documents: the parameter files Creative Lab's tool exports, read and evaluated.
//
// A document is a sequence of screens; a screen has a duration and a stack of layers,
// bottom first; an effect layer has `statics` (one value per parameter) and `tracks`
// (keyframes per parameter). See motion/…/reference/README.md, "The model".
//
// Pure: no DOM, no GL, no clock. Every value is a function of (layer, t) and nothing
// else, which is what makes a frame at t = 5.0 s the same however it was reached.

const loaded = new WeakSet();

/**
 * Normalise a document (as exported, or as bundled by web/scripts/import-motion.mjs).
 * Idempotent: a document that has already been loaded is returned as is.
 */
export function loadDocument(doc) {
  if (loaded.has(doc)) return doc;
  if (!doc || typeof doc !== 'object') throw new Error('motion document: not an object');
  const screens = (doc.screens?.length ? doc.screens : [{ name: 'Screen 1', duration: doc.duration, layers: doc.layers || [] }])
    .map((sc) => ({
      name: sc.name || '',
      duration: positive(sc.duration) || positive(doc.duration) || 3,
      layers: (sc.layers || []).filter((L) => L.visible !== false).map((L) => normaliseLayer(L, doc)),
    }));
  const duration = screens.reduce((a, sc) => a + sc.duration, 0);
  const refWidth = positive(doc.refWidth) || positive(doc.width) || 432;
  const refHeight = positive(doc.refHeight) || positive(doc.height) || 768;
  const out = {
    id: doc.id || doc.name || '',
    name: doc.name || '',
    loop: doc.loop !== false,
    duration,
    screens,
    refWidth,
    refHeight,
    // The preview canvas the document was authored in. Not the canvas we render: the
    // app's viewport is. Kept so a document can be rendered exactly as exported.
    width: positive(doc.width) || refWidth,
    height: positive(doc.height) || refHeight,
    playbackFps: Math.max(0, Number(doc.playbackFps) || 0),
    msaa: clampInt(doc.msaa ?? 3, 1, 6),
    background: doc.background?.color || '#000000',
  };
  loaded.add(out);
  return out;
}

function normaliseLayer(L, doc) {
  const type = L.type === 'image' || L.type === 'solid' || L.type === 'comp' ? L.type : 'effect';
  const effect = type === 'effect' ? (L.effect || doc.effect || 'pattern-refraction') : null;
  const spec = (effect && doc.effects?.[effect]) || {};
  const tracks = {};
  for (const [id, keys] of Object.entries(L.tracks || {})) {
    if (!Array.isArray(keys) || !keys.length) continue;
    tracks[id] = keys.map((k) => ({ t: Number(k.t) || 0, v: k.v, bezier: k.bezier || [0.42, 0, 0.58, 1] })).sort((a, b) => a.t - b.t);
  }
  return {
    name: L.name || '',
    type,
    effect,
    statics: { ...(L.statics || {}) },
    tracks,
    stepped: new Set(spec.stepped || doc.stepped || []),
    gradient: (L.gradient || []).map((s) => ({ position: Number(s.position) || 0, color: { r: +s.color.r, g: +s.color.g, b: +s.color.b } })),
    color: L.color,
    opacity: L.opacity,
    // What an effect keeps on the layer rather than in its parameters (Wave: the mesh
    // pose and Colorama's output cycle). Posed once, never keyframed.
    fx: L.fx || null,
  };
}

/** Wrap (or clamp) a time in seconds into the document's timeline. */
export function documentTime(doc, t) {
  if (!(t > 0)) return 0;
  if (doc.loop) return t % doc.duration;
  return Math.min(t, doc.duration);
}

/**
 * Play to `b`, then keep moving between `a` and `b` (back, forth, back...): a document
 * held on a stretch that does not loop on its own, with no jump. Time before `b` is
 * left alone, so the entrance plays as authored.
 */
export function holdTime(t, [a, b]) {
  if (!(t > b) || !(b > a)) return t;
  const span = b - a;
  const k = (t - b) % (2 * span);
  return k < span ? b - k : a + (k - span);
}

/**
 * An entry's opacity at its own time `t` from its fade, `[a, b, level, start, ease]`:
 * `start` until `a`, `level` from `b`, between them along `ease` (a cubic-bezier's
 * four numbers; linear without it). No fade is full opacity.
 */
export function fadeLevel(fade, t) {
  if (!fade) return 1;
  const [a, b, level = 0, start = 1, ease] = fade;
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  const k = ease ? cubicBezier(ease[0], ease[1], ease[2], ease[3], x) : x;
  return Math.max(0, Math.min(1, start + (level - start) * k));
}

/**
 * A placed entry's scale at its own time `t` from its `size`, `[a, b, start, ease]`:
 * `start` until `a`, whole from `b`, between them along `ease` (linear without it). No
 * size is whole.
 */
export function sizeLevel(size, t) {
  if (!size) return 1;
  const [a, b, start = 1, ease] = size;
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  const k = ease ? cubicBezier(ease[0], ease[1], ease[2], ease[3], x) : x;
  return start + (1 - start) * k;
}

/**
 * A scrubbed entry's document time at its own time `t` from its `scrub`, `[a, b, from,
 * to, ease]`: `from` until `a`, `to` from `b`, between them along `ease` (linear without
 * it). No scrub is `t` itself.
 */
export function scrubTime(scrub, t) {
  if (!scrub) return t;
  const [a, b, from, to, ease] = scrub;
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  const k = ease ? cubicBezier(ease[0], ease[1], ease[2], ease[3], x) : x;
  return from + (to - from) * k;
}

/** The screen a moment of the sequence falls in, and the time inside that screen. */
export function screenAt(doc, t) {
  let acc = 0;
  const last = doc.screens[doc.screens.length - 1];
  for (const sc of doc.screens) {
    if (t < acc + sc.duration || sc === last) return { screen: sc, local: Math.max(0, Math.min(sc.duration, t - acc)) };
    acc += sc.duration;
  }
  return { screen: doc.screens[0], local: 0 };
}

/** Every parameter of a layer at local time t: statics, overridden by tracks. */
export function valuesAt(layer, t) {
  const v = { ...layer.statics };
  for (const id of Object.keys(layer.tracks)) v[id] = trackValue(layer, id, t);
  return v;
}

export function trackValue(layer, id, t) {
  const ks = layer.tracks[id];
  if (!ks?.length) return layer.statics[id];
  if (ks.length === 1 || t <= ks[0].t) return ks[0].v;
  const last = ks[ks.length - 1];
  if (t >= last.t) return last.v;
  let i = 0;
  while (i < ks.length - 2 && ks[i + 1].t <= t) i++;
  const a = ks[i], b = ks[i + 1];
  if (layer.stepped.has(id)) return a.v;
  // The curve between two keys leaves along the first key's out-handle and arrives
  // along the second key's in-handle.
  const e = cubicBezier(a.bezier[0], a.bezier[1], b.bezier[2], b.bezier[3], (t - a.t) / Math.max(b.t - a.t, 1e-6));
  if (Array.isArray(a.v)) {
    // An outline is a ring of [x, y, smooth] points: it blends point by point. Keys
    // with different counts cannot be paired, so the earlier key holds.
    if (!Array.isArray(b.v) || b.v.length !== a.v.length) return a.v;
    return a.v.map((p, j) => [p[0] + (b.v[j][0] - p[0]) * e, p[1] + (b.v[j][1] - p[1]) * e, p[2]]);
  }
  return a.v + (b.v - a.v) * e;
}

/**
 * CSS-style cubic-bezier easing: the curve from (0,0) to (1,1) with control points
 * (x1,y1) and (x2,y2), evaluated at x. Newton's method, with bisection when the slope
 * is too flat for it, so it converges for every handle the tool can produce.
 */
export function cubicBezier(x1, y1, x2, y2, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sampleX = (s) => ((ax * s + bx) * s + cx) * s;
  const slopeX = (s) => (3 * ax * s + 2 * bx) * s + cx;
  let s = x;
  for (let i = 0; i < 8; i++) {
    const err = sampleX(s) - x;
    if (Math.abs(err) < 1e-7) return ((ay * s + by) * s + cy) * s;
    const d = slopeX(s);
    if (Math.abs(d) < 1e-6) break;
    s -= err / d;
  }
  let lo = 0, hi = 1;
  s = x;
  for (let i = 0; i < 40; i++) {
    const v = sampleX(s);
    if (Math.abs(v - x) < 1e-7) break;
    if (v < x) lo = s; else hi = s;
    s = (lo + hi) / 2;
  }
  return ((ay * s + by) * s + cy) * s;
}

function positive(n) {
  n = Number(n);
  return n > 0 ? n : 0;
}

function clampInt(n, lo, hi) {
  return Math.max(lo, Math.min(hi, Math.round(Number(n) || lo)));
}
