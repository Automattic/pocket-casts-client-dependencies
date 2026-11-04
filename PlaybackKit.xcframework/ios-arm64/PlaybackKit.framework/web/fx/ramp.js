// Colour ramps: a few stops along [0, 1].
//
// The colouring wraps its index into (0, 1] (Repeats cycles the ramp across the
// relief), but the ramp itself does not loop: before the first stop and past the last
// it holds their colours, as Creative Lab's runtime does, so where a document's stops
// fall short of the ends a wrap shows as an edge. A ramp is baked into a strip of
// RAMP_SIZE texels sampled with clamping.

export const RAMP_SIZE = 1024;

/**
 * Accepts the document form `[{position, color: {r, g, b}}]` (channels 0..1) or the host
 * form `[{position, color: '#rrggbb'}]`. Returns sorted stops `{p, c: [r, g, b]}`, or
 * null when there is nothing usable.
 */
export function normaliseRamp(stops) {
  if (!Array.isArray(stops)) return null;
  const out = [];
  for (const s of stops) {
    const p = Number(s?.position);
    const c = toRgb(s?.color);
    if (!Number.isFinite(p) || !c) continue;
    out.push({ p: Math.max(0, Math.min(1, p)), c });
  }
  if (!out.length) return null;
  return out.sort((a, b) => a.p - b.p);
}

/** The colour at position x, channels 0..1; the end stops hold beyond the ends. */
export function sampleRamp(stops, x) {
  const n = stops.length;
  if (x <= stops[0].p) return stops[0].c.slice();
  if (x >= stops[n - 1].p) return stops[n - 1].c.slice();
  let i = 0;
  while (stops[i + 1].p <= x) i++;
  const a = stops[i], b = stops[i + 1];
  const u = b.p - a.p > 1e-6 ? (x - a.p) / (b.p - a.p) : 0;
  return [0, 1, 2].map((k) => a.c[k] + (b.c[k] - a.c[k]) * u);
}

/** RGBA8 texels: texel i holds the colour at (i + 0.5) / RAMP_SIZE. */
export function bakeRamp(stops) {
  const px = new Uint8Array(RAMP_SIZE * 4);
  for (let i = 0; i < RAMP_SIZE; i++) {
    const c = sampleRamp(stops, (i + 0.5) / RAMP_SIZE);
    px[i * 4] = Math.round(c[0] * 255);
    px[i * 4 + 1] = Math.round(c[1] * 255);
    px[i * 4 + 2] = Math.round(c[2] * 255);
    px[i * 4 + 3] = 255;
  }
  return px;
}

function toRgb(c) {
  if (typeof c === 'string') {
    const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }
  if (c && typeof c === 'object' && [c.r, c.g, c.b].every((v) => Number.isFinite(Number(v)))) {
    return [c.r, c.g, c.b].map((v) => Math.max(0, Math.min(1, Number(v))));
  }
  return null;
}
