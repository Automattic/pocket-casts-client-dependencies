// Colour from cover art (motion/…/reference/COLOUR.md): a cover's pixels to the colour
// ramp a cover-driven document (behind the cover, colour grabbing) is drawn in.
//
// Creative Lab's own palette code (reference/source/palette.js, inlined unchanged in
// the deliverables), adapted to take raw RGBA pixels so it runs anywhere: Oklab, a
// k-means of 8 with k-means++ seeding from an RNG seeded by the pixels, duplicates
// merged, the three moods, light to dark, and the ramp resampled in polar Oklab to the
// eight stops the documents' gradients hold. The handoff puts no constraint on reusing
// it; only Pattern refraction's shader is clean-room. Deterministic: the same pixels
// always give the same ramp.
//
// Reading the pixels is the caller's (ui/palette.js draws the cover into a canvas). Only
// one cover at a time is needed so far, so the blending of two covers' ramps (COLOUR.md
// §6–8) is not here yet.

const srgb2lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lin2srgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

export function rgb2oklab(r, g, b) {
  r = srgb2lin(r); g = srgb2lin(g); b = srgb2lin(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

export function oklab2rgb(L, A, B) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
  const cl = (v) => Math.max(0, Math.min(1, v));
  return [
    cl(lin2srgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    cl(lin2srgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    cl(lin2srgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)),
  ];
}

const chromaOf = (c) => Math.hypot(c[1], c[2]);
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** The long edge covers are read at. */
export const SAMPLE_SIZE = 128;

/** The size to draw an image at before reading it: 128 px on its long edge, never larger. */
export function sampleSize(width, height) {
  const k = Math.min(1, SAMPLE_SIZE / Math.max(width, height));
  return [Math.max(1, Math.round(width * k)), Math.max(1, Math.round(height * k))];
}

/**
 * RGBA pixels to Oklab points (opaque pixels only) and the seed they hash to. A
 * generator, like `kmeans`: it pauses (yields) every few thousand pixels, so a caller can
 * spread the work over several tasks (`extractPaletteAsync`).
 */
function* samples(data, width, height) {
  const pts = [];
  let seed = (width * 73856093) ^ (height * 19349663);
  for (let i = 0; i < data.length; i += 4) {
    if (i % 16384 === 0) yield;
    if (data[i + 3] < 128) continue;
    pts.push(rgb2oklab(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255));
    seed = (seed * 31 + data[i] + data[i + 1] * 7 + data[i + 2] * 13) | 0;
  }
  return { pts, seed: Math.abs(seed) || 1 };
}

/** k-means, pausing (yielding) after each centre it seeds and each pass it makes. */
function* kmeans(pts, k, seed) {
  const rand = rng(seed);
  if (pts.length <= k) return pts.map((p) => ({ c: p, w: 1 / Math.max(1, pts.length) }));
  const cen = [pts[Math.floor(rand() * pts.length)]];
  const near = pts.map((p) => dist2(p, cen[0]));
  while (cen.length < k) {
    yield;
    let sum = 0;
    for (const d of near) sum += d;
    if (sum <= 0) break;
    let target = rand() * sum, i = 0;
    while (i < near.length - 1 && (target -= near[i]) > 0) i++;
    cen.push(pts[i]);
    for (let j = 0; j < pts.length; j++) near[j] = Math.min(near[j], dist2(pts[j], cen[cen.length - 1]));
  }
  const owner = new Int32Array(pts.length);
  for (let iter = 0; iter < 20; iter++) {
    yield;
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      let best = 0, bd = Infinity;
      for (let j = 0; j < cen.length; j++) {
        const d = dist2(pts[i], cen[j]);
        if (d < bd) { bd = d; best = j; }
      }
      if (owner[i] !== best) { owner[i] = best; moved = true; }
    }
    const sum = cen.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < pts.length; i++) {
      const s = sum[owner[i]];
      s[0] += pts[i][0]; s[1] += pts[i][1]; s[2] += pts[i][2]; s[3]++;
    }
    for (let j = 0; j < cen.length; j++) if (sum[j][3]) cen[j] = [sum[j][0] / sum[j][3], sum[j][1] / sum[j][3], sum[j][2] / sum[j][3]];
    if (!moved) break;
  }
  const count = cen.map(() => 0);
  for (const o of owner) count[o]++;
  return cen.map((c, j) => ({ c, w: count[j] / pts.length })).filter((x) => x.w > 0);
}

const MERGE = 0.055;
function dedupe(cl) {
  const out = [];
  for (const x of cl.slice().sort((a, b) => b.w - a.w)) {
    const near = out.find((o) => Math.sqrt(dist2(o.c, x.c)) < MERGE);
    if (near) near.w += x.w;
    else out.push({ c: x.c.slice(), w: x.w });
  }
  return out;
}

/**
 * A cover's colours: RGBA pixels (already drawn at `sampleSize`) to clusters
 * `{rgb, w, L, chroma}`, the same shape the deliverables keep on their cover layers.
 */
export function extractPalette(data, width, height, k = 8) {
  const steps = paletteSteps(data, width, height, k);
  for (;;) {
    const { done, value } = steps.next();
    if (done) return value;
  }
}

/**
 * The same as `extractPalette`, the same clusters, spread over tasks of about `sliceMs`
 * each: a cover read as a page comes in costs that page no frames.
 */
export async function extractPaletteAsync(data, width, height, { k = 8, sliceMs = 4 } = {}) {
  const steps = paletteSteps(data, width, height, k);
  let slice = performance.now();
  for (;;) {
    const { done, value } = steps.next();
    if (done) return value;
    if (performance.now() - slice > sliceMs) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      slice = performance.now();
    }
  }
}

function* paletteSteps(data, width, height, k) {
  const { pts, seed } = yield* samples(data, width, height);
  if (!pts.length) return [];
  return dedupe(yield* kmeans(pts, k, seed)).map((x) => ({ rgb: oklab2rgb(x.c[0], x.c[1], x.c[2]), w: x.w, L: x.c[0], chroma: chromaOf(x.c) }));
}

function split(clusters) {
  let maxC = 0;
  for (const c of clusters) if (c.chroma > maxC) maxC = c.chroma;
  const cut = Math.max(0.045, maxC * 0.45);
  return { accent: clusters.filter((c) => c.chroma >= cut), ground: clusters.filter((c) => c.chroma < cut) };
}

const MOODS = {
  vibrant: (cl) => { const a = split(cl).accent; return (a.length >= 2 ? a : cl).slice().sort((x, y) => y.chroma * Math.sqrt(y.w) - x.chroma * Math.sqrt(x.w)); },
  muted: (cl) => { const g = split(cl).ground; return (g.length >= 2 ? g : cl).slice().sort((x, y) => y.w - x.w); },
  full: (cl) => cl.slice().sort((x, y) => y.w * (1 + 3 * y.chroma) - x.w * (1 + 3 * x.chroma)),
};
/** `coverMood` in a document: 0 vibrant, 1 muted, 2 full. */
export const MOOD_NAMES = ['vibrant', 'muted', 'full'];

function mood(clusters, name, n = 6) {
  const rank = MOODS[name] || MOODS.vibrant;
  return rank(clusters).slice(0, Math.max(2, n)).sort((a, b) => b.L - a.L).map((c) => c.rgb);
}

function mixOklab(c1, c2, u) {
  const a = rgb2oklab(c1[0], c1[1], c1[2]), b = rgb2oklab(c2[0], c2[1], c2[2]);
  const ca = Math.hypot(a[1], a[2]), cb = Math.hypot(b[1], b[2]);
  let ha = Math.atan2(a[2], a[1]), hb = Math.atan2(b[2], b[1]);
  if (ca < 1e-4) ha = hb;
  if (cb < 1e-4) hb = ha;
  let d = hb - ha;
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  const L = a[0] + (b[0] - a[0]) * u, C = ca + (cb - ca) * u, h = ha + d * u;
  return oklab2rgb(L, C * Math.cos(h), C * Math.sin(h));
}

function sampleAt(g, pos) {
  const first = g[0], last = g[g.length - 1];
  if (pos <= first[0]) return first.slice(1);
  if (pos >= last[0]) return last.slice(1);
  for (let i = 0; i < g.length - 1; i++) {
    if (pos >= g[i][0] && pos <= g[i + 1][0]) {
      const u = (pos - g[i][0]) / Math.max(1e-6, g[i + 1][0] - g[i][0]);
      return mixOklab(g[i].slice(1), g[i + 1].slice(1), u);
    }
  }
  return last.slice(1);
}

const hex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');

/**
 * The ramp a document draws a cover in: its `mood` (a name, or `coverMood`'s index)
 * light to dark, evenly spaced, resampled to `stops` (the documents hold 8) in polar
 * Oklab. `[{position, color: '#rrggbb'}]`, what the backdrop's `ramp` takes; null
 * without colours.
 */
export function coverRamp(clusters, moodName = 'full', stops = 8) {
  if (!clusters?.length) return null;
  const name = typeof moodName === 'number' ? MOOD_NAMES[Math.round(moodName)] ?? 'vibrant' : moodName;
  const rgbs = mood(clusters, name);
  const g = rgbs.map((c, i) => [rgbs.length === 1 ? 0 : i / (rgbs.length - 1), ...c]);
  return Array.from({ length: stops }, (_, i) => {
    const p = stops === 1 ? 0 : i / (stops - 1);
    return { position: p, color: hex(sampleAt(g, p)) };
  });
}
