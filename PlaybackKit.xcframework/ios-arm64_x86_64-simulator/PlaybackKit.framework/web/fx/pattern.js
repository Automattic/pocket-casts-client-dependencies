// Pattern refraction: a filled shape seen through ridged glass, coloured by a lit
// noise field read through a gradient.
//
// Built from the behavioural specification (motion/…/reference/pattern-spec/
// PATTERN-BEHAVIOUR.md), its contact sheets and renders of the deliverables, not from
// the tool's GLSL, which is a port of Figma's shader and is not ours to ship. Every
// constant below was chosen here and calibrated against Creative Lab's runtime,
// driven black-box (and the noise lattice's random values were read back from it:
// lattice.js); see docs/effects.md for what was measured and how to compare.
//
//   1 shape      coverage only, in alpha (plus the Contain boundary in red)
//   2 refraction the coverage read back through a repeating relief, supersampled
//   3 edge       a separable Gaussian of the refracted coverage
//   4 colouring  a noise landscape plus the edge bevel, mapped through the ramp
//
// Coordinates in the shaders are canvas pixels, y down, like the documents. Every
// texture is stored bottom-up (render targets are, and uploads are flipped to match),
// so going from a canvas pixel to a texture coordinate always flips v.

import { RAMP_SIZE, bakeRamp, normaliseRamp } from './ramp.js';
import { LATTICE, LATTICE_COLUMNS, LATTICE_ROWS, LATTICE_ROW0 } from './lattice.js';
import { drawCustomShape, drawSolidRing, rasterCache } from './outline.js';

/** Parameter defaults, for documents that leave a parameter out. */
export const DEFAULTS = {
  fxSpace: 0, patternType: 0, amount: 100, seamlessness: 0, frost: 0, iorDispersion: 4, pixelWrapMode: 0,
  cx: 50, cy: 50, radius: 9.91, angle: 45,
  mRounding: 10, mDepth: 200, mRough: 100, mSplit: 3, mScale: 125, mStretch: 341, mAngle: 18, mRepeats: 1,
  mOffset: 15, mPhase: 0, mEvolution: 0,
  shape: 0, shapeSmooth: 78, shapeFill: 0, shapeAlpha: 100, shapeFade: 45, shapeFillSize: 100, shapeFillA: 0,
  contain: 0, containSoft: 40, shapeSize: 80, shapeW: 100, shapeH: 100, shapeRot: 0, ringInner: 50, ringOuter: 100,
  shapeX: 50, shapeY: 50, mask: 0, maskSoft: 40,
};

/** The pipeline, in order, for the rig's stage viewer. */
export const STAGES = [
  { id: 'shape', label: '1 · Source shape', note: 'Coverage only: the colour of the shape is never read.' },
  { id: 'refract', label: '2 · Refraction', note: 'The coverage read through the relief, supersampled. Dispersion is shown here only: the colouring reads a single channel, so it never reaches the final frame.' },
  { id: 'edge', label: '3 · Edge', note: 'A Gaussian of the refracted coverage. The colouring uses it as a bevel, which is what makes slices read as solid.' },
  { id: 'colour', label: '4 · Colouring (final)', note: '' },
];

const SHAPES = { circle: 0, rounded: 1, square: 2, custom: 3, ring: 4 };

const HEADER = `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uRes;
out vec4 frag;
// The canvas pixel this fragment covers, y down.
vec2 canvasPx() { return vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y); }
// A canvas pixel position to a (bottom-up) texture coordinate.
vec2 texAt(vec2 p) { return vec2(p.x, uRes.y - p.y) / uRes; }
uint pcg(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v.x ^ v.y ^ v.z;
}
float rand(uvec3 v) { return float(pcg(v) >> 8u) * (1.0 / 16777216.0); }
`;

// ── 1 · shape ──────────────────────────────────────────────────────────────────
// Analytic shapes are signed distances, anti-aliased over one pixel. The Contain
// boundary is the same silhouette blurred: a Gaussian across an edge is the normal
// CDF of the distance to it, which is exact for a straight edge and close enough for
// any shape much larger than the blur.
const FS_SHAPE = HEADER + `
uniform int uKind;
uniform vec2 uCentre;
uniform float uDiam;
uniform vec2 uScale;
uniform float uRot;
uniform vec2 uRing;
uniform float uOpacity;
uniform int uFill;
uniform float uReach, uFade;
uniform vec2 uFillDir;
uniform float uBoundSoft;
uniform bool uCustom;
uniform sampler2D uCustomCov, uCustomBound;
// Clamped first: some drivers build tanh from exponentials, and a large argument is
// then inf/inf, a NaN that blacks out the inside of every contained shape.
float normalCdf(float x) { x = clamp(x, -6.0, 6.0); return 0.5 + 0.5 * tanh(0.7978846 * (x + 0.044715 * x * x * x)); }
float sdShape(vec2 p) {
  vec2 q = p - uCentre;
  float c = cos(uRot), s = sin(uRot);
  vec2 l = vec2(c * q.x + s * q.y, -s * q.x + c * q.y) / uScale;
  float k = min(uScale.x, uScale.y);
  float r = uDiam * 0.5;
  if (uKind == 0) return (length(l) - r) * k;
  if (uKind == 4) {
    float d = length(l);
    float sd = d - uRing.y;
    if (uRing.x > 0.01) sd = max(sd, uRing.x - d);
    return sd * k;
  }
  float rad = uKind == 1 ? 0.22 * uDiam : 0.0;
  vec2 b = abs(l) - vec2(r - rad);
  return (length(max(b, 0.0)) + min(max(b.x, b.y), 0.0) - rad) * k;
}
float fillAlpha(vec2 p) {
  vec2 q = p - uCentre;
  if (uFill == 1) {
    float r0 = uReach * uFade;
    return 1.0 - clamp((length(q) - r0) / max(uReach - r0, 1e-3), 0.0, 1.0);
  }
  if (uFill == 2) {
    float t = (dot(q, uFillDir) + uReach) / (2.0 * uReach);
    float f = min(uFade, 0.999);
    return 1.0 - clamp((t - f) / (1.0 - f), 0.0, 1.0);
  }
  return 1.0;
}
void main() {
  vec2 p = canvasPx();
  float cov, bound;
  if (uCustom) {
    vec2 uv = gl_FragCoord.xy / uRes;
    cov = textureLod(uCustomCov, uv, 0.0).a;
    bound = textureLod(uCustomBound, uv, 0.0).r;
  } else {
    float sd = sdShape(p);
    cov = clamp(0.5 - sd, 0.0, 1.0) * fillAlpha(p) * uOpacity;
    bound = uBoundSoft > 0.5 ? normalCdf(-sd / uBoundSoft) : clamp(0.5 - sd, 0.0, 1.0);
  }
  frag = vec4(bound, 0.0, 0.0, cov);
}`;

// ── 2 · refraction ─────────────────────────────────────────────────────────────
// A repeating relief over the plane. Across each period (u in -0.5..0.5, the lens
// centred on 0) the relief's slope pushes the read outward from the lens centre, so a
// period shows a wider strip of the shape squeezed into it: a circle becomes a row of
// lens-shaped slices. Each period is a ridge of glass whose cross-section is close to
// flat-topped and steep at its walls, and a read is pushed along the ray refracted
// through it (index 2.5): close to linear across the lens, climbing steeply towards
// the walls (which throws the thin outer slivers far out), and not pushed at all right
// at a wall, where the ray would be totally internally reflected. The ridge is a fixed
// height, so the steeper a short period's walls, the wider that unpushed zone: what
// keeps the seams between slices shallow. All measured (see docs/effects.md).
// Smoothness takes the top off the walls, steepens the centre to keep the slices'
// size, and at the top of its range eases the wall down so the relief becomes a
// continuous wave.
//
// The walls are where it is hard to draw. Just short of reflecting, a ray is thrown
// hundreds of pixels, out of the shape, so each wall has a dark seam a few thousandths
// of a period wide: under a pixel once the frame is drawn smaller than authored (the
// intro's sphere is about half). A fixed grid of samples then catches a seam in one
// frame and misses it in the next as the relief slides, and the edge blur and Depth turn
// that into dark lines that flash. So a pixel that reaches a wall takes uWallSamples
// across the ridges (about six per authored pixel, as dense as Creative Lab's own
// supersampling); the rest keep the plain grid.
const FS_REFRACT = HEADER + `
uniform sampler2D uSrc;
uniform int uType, uWrap, uSamples, uWallSamples;
uniform vec2 uCentre, uAxis, uLens;
uniform float uPeriod, uAmount, uSmooth, uFrost, uDispersion, uWallGap;
uniform bool uSpectral;
uniform vec4 uBounds;
bool outside(vec2 p) { return any(lessThan(p, uBounds.xy)) || any(greaterThan(p, uBounds.zw)); }
float profile(float u) {
  float a = abs(u);
  float q = 1.0 - pow(min(2.0 * a, 1.0), 13.0);
  if (q <= 0.0 || a > 0.5 - uWallGap) return 0.0;
  // The surface's slope (uLens.x is the ridge's height over the period), then the
  // straight-down ray refracted through it.
  float s = uLens.x * 2.0 * u * inversesqrt(q);
  float nz = inversesqrt(1.0 + s * s), nx = s * nz;
  float k = 1.0 - 6.25 * (1.0 - nz * nz);
  if (k < 0.0) return 0.0;
  float f = 2.5 * nz - sqrt(k);
  float g = uLens.y * f * nx / (2.5 - f * nz) * (1.0 + 1.1 * pow(uSmooth, 0.8));
  if (uSmooth > 0.0) {
    float cap = 0.43 + 0.02 / uSmooth;
    g /= pow(1.0 + pow(abs(g) / cap, 4.0), 0.25);
    g *= 1.0 - 0.9 * smoothstep(0.5, 1.0, uSmooth) * smoothstep(0.44, 0.5, a);
  }
  return g;
}
// Where canvas point p falls across the ridges, in periods, and the direction of
// steepest climb: lenticular, then the same ridges kinked or undulating along their
// length (the ridge line displaced by a triangle or sine wave of the distance along it).
const float LAMBDA = 6.56, AMP = 0.6;
float ridge(vec2 p, out vec2 grad) {
  vec2 q = p - uCentre;
  vec2 across = uAxis, along = vec2(-uAxis.y, uAxis.x);
  float u = dot(q, across) / uPeriod, v = dot(q, along) / uPeriod;
  grad = across;
  if (uType == 1) {
    float w = fract(v / LAMBDA + 0.5) - 0.5;
    u -= 0.357 * abs(w) * LAMBDA;
    grad -= along * 0.357 * sign(w);
  } else if (uType == 2) {
    float ph = 6.2831853 * v / LAMBDA;
    u += AMP * sin(ph);
    grad += along * AMP * 6.2831853 / LAMBDA * cos(ph);
  }
  return u;
}
// Whether the pixel at p reaches into the steep band at a ridge's wall.
bool nearWall(vec2 p) {
  vec2 grad;
  float a = abs(fract(ridge(p, grad)) - 0.5);
  // The pixel's half-diagonal across the ridges, and how far Frost can move a read.
  float reach = 0.71 * length(grad) / uPeriod + 0.15 * uFrost;
  return a > 0.46 - reach;
}
// The push at canvas point p, in pixels.
vec2 displacement(vec2 p, float jitter) {
  if (uType <= 2) {
    vec2 grad;
    float u = ridge(p, grad);
    return grad * uAmount * profile(fract(u + jitter) - 0.5);
  }
  vec2 q = p - uCentre;
  vec2 across = uAxis, along = vec2(-uAxis.y, uAxis.x);
  float u = dot(q, across) / uPeriod, v = dot(q, along) / uPeriod;
  // Lattices: one lens per square cell, round, rounded-square or hard-square.
  vec2 c = fract(vec2(u, v) + jitter) - 0.5;
  vec2 m = abs(c);
  float r;
  vec2 dir;
  if (uType == 3) { r = length(c); dir = c / max(r, 1e-5); }
  else if (uType == 4) {
    vec2 c4 = m * m * m * m;
    r = pow(c4.x + c4.y, 0.25);
    dir = sign(c) * m * m * m / max(pow(r, 3.0), 1e-5);
    dir /= max(length(dir), 1e-5);
  } else {
    r = max(m.x, m.y);
    dir = m.x > m.y ? vec2(sign(c.x), 0.0) : vec2(0.0, sign(c.y));
  }
  // Beyond r = 0.5 (the corners between round lenses) the wall is at its steepest.
  vec2 d = dir * profile(min(r, 0.5));
  return (across * d.x + along * d.y) * uAmount;
}
float coverage(vec2 p) {
  if (outside(p)) return 0.0;
  vec2 uv = texAt(p);
  if (uWrap == 0) { if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 0.0; }
  else if (uWrap == 2) uv = fract(uv);
  else if (uWrap == 3) uv = 1.0 - abs(fract(uv * 0.5) * 2.0 - 1.0);
  // Level 0 explicitly: a displaced read has steep derivatives, and letting the GPU
  // pick a mip level from them would blur exactly where the relief is sharpest.
  return textureLod(uSrc, uv, 0.0).a;
}
void main() {
  vec2 p0 = canvasPx();
  // A layer in a box of its own draws nothing outside it, and reads there are empty.
  if (outside(p0)) { frag = vec4(0.0); return; }
  ivec2 n = ivec2(uSamples);
  if (uType <= 2 && uWallSamples > uSamples && nearWall(p0)) {
    if (abs(uAxis.x) >= abs(uAxis.y)) n.x = uWallSamples; else n.y = uWallSamples;
  }
  vec3 acc = vec3(0.0);
  for (int j = 0; j < n.y; j++) {
    for (int i = 0; i < n.x; i++) {
      vec2 p = p0 + (vec2(float(i), float(j)) + 0.5) / vec2(n) - 0.5;
      float jitter = 0.0;
      if (uFrost > 0.0) {
        // Keyed by the plain grid's cell, so the extra samples at a wall share its frost.
        uvec2 cell = uvec2(ivec2(i, j) * uSamples / n);
        uvec3 key = uvec3(uvec2(gl_FragCoord.xy) * uint(uSamples) + cell, 3u);
        jitter = (rand(key) - 0.5) * 0.3 * uFrost;
      }
      vec2 d = displacement(p, jitter);
      if (uSpectral) {
        acc += vec3(coverage(p + d * (1.0 - 0.15 * uDispersion)), coverage(p + d), coverage(p + d * (1.0 + 0.15 * uDispersion)));
      } else {
        acc.g += coverage(p + d);
      }
    }
  }
  acc /= float(n.x * n.y);
  frag = uSpectral ? vec4(acc, acc.g) : vec4(0.0, 0.0, 0.0, acc.g);
}`;

// ── 3 · edge ───────────────────────────────────────────────────────────────────
// A separable Gaussian, written at a reduced resolution, so the taps are never more than
// a pixel apart: spreading a fixed tap count over a large radius staircases hard edges.
// The Gaussian does the reducing itself, reading every pixel of its source at full
// resolution, with weights taken at each one's true distance. Reading a reduced copy
// instead (a box-filtered mip level) puts all of a thin feature in its block's centre,
// so a seam sliding across the blocks moves the blur a block at a time: the silhouette,
// cut at half of it, swells and shrinks at the slide's pace over the block (the top show's
// notches by 3 pt at 15 Hz, at 30 fps a shimmer from frame to frame), where the full
// read slides it smoothly, as Creative Lab's does. Pairs of taps are read through the
// bilinear filter, one fetch each. The edge blur is cut off 32 authored pixels out, as
// measured: past a Rounding of about 20 the bevel stops widening and flattens towards
// a straight ramp. Writes red.
const FS_BLUR = HEADER + `
uniform sampler2D uSrc;
uniform float uSigma, uReach;
uniform vec2 uDir, uSrcSize;
uniform int uChannel;
float weight(float d) {
  return exp(-0.5 * d * d / (uSigma * uSigma)) * clamp(uReach - abs(d) + 0.5, 0.0, 1.0);
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  // This pixel's centre along the blur, in source texels (texel j's centre is at j).
  float n = dot(uSrcSize, uDir), c = dot(uv, uDir) * n - 0.5;
  int r = int(ceil(min(3.0 * uSigma, uReach)));
  int j0 = int(floor(c)) - r, j1 = int(ceil(c)) + r;
  float acc = 0.0, wsum = 0.0;
  for (int j = j0; j <= j1; j += 2) {
    float w0 = weight(float(j) - c), w1 = j < j1 ? weight(float(j + 1) - c) : 0.0, w = w0 + w1;
    if (w <= 0.0) continue;
    // Across the blur, this pixel sits on a source texel's centre: the read is linear
    // between j and j + 1 only.
    float at = (float(j) + 0.5 + w1 / w) / n;
    vec4 t = textureLod(uSrc, uDir.x > 0.5 ? vec2(at, uv.y) : vec2(uv.x, at), 0.0);
    acc += w * (uChannel == 3 ? t.a : t.r);
    wsum += w;
  }
  frag = vec4(acc / max(wsum, 1e-6), 0.0, 0.0, 1.0);
}`;

// ── 4 · colouring ──────────────────────────────────────────────────────────────
// The ramp index is a height: a smooth value-noise landscape plus a per-pixel grain
// (Roughness), scaled by the blurred coverage so it sinks towards the edges (the
// bevel), and clamped so peaks and troughs flatten into plateaus. Depth scales the
// relief. Repeats multiplies
// the whole height, so the ramp cycles across it, and Offset slides the result; the
// index wraps, and the ramp holds its end colours rather than looping (where it wraps
// the two ends dissolve into each other, pixel by pixel). RGB split
// pushes red up and blue down the ramp where the landscape is steep.
//
// The landscape is laid out on the frame, not in pixels: a cell is Scale/100 of the
// frame's width across and of its height down (twice as tall as wide on a phone
// frame), from the frame's top-left corner, or in Shape space scaled about the shape's
// centre by its Size. Angle turns it about that centre in cells, Stretch then divides
// its rows, Phase slides it along x and Evolution walks a third axis, 8 cells per 100
// each. The random values on the lattice are Creative Lab's own, read back from their
// runtime (lattice.js); x and the third axis repeat every 8, so Phase and Evolution
// loop on whole units of 100. All of it is measured; see docs/effects.md.
const FS_COLOUR = HEADER + `
uniform sampler2D uCoverage, uShape, uEdge, uMask, uRamp, uLattice;
uniform bool uHasEdge;
uniform float uDepth, uRepeats, uOffset, uRough, uSplit;
uniform vec4 uFrame;
uniform vec2 uAnchor, uRot;
uniform float uSize, uCells, uStretch, uPhase, uSlice;
uniform float uContain, uReveal, uLayerAlpha;
float lattice(vec3 c) {
  vec3 m = mod(c + vec3(0.0, ${-LATTICE_ROW0}.0, 0.0), vec3(8.0, ${LATTICE_ROWS}.0, 8.0));
  return texelFetch(uLattice, ivec2(int(m.x) + 8 * int(m.z), int(m.y)), 0).r;
}
// The landscape at p (in cells) and its slope across the cells, for the split.
vec3 valueNoise(vec3 p) {
  vec3 i = floor(p), f = p - i;
  vec3 s = f * f * (3.0 - 2.0 * f), ds = 6.0 * f * (1.0 - f);
  vec3 r[2];
  for (int k = 0; k < 2; k++) {
    vec3 c = i + vec3(0.0, 0.0, float(k));
    float a = lattice(c), b = lattice(c + vec3(1, 0, 0)), e = lattice(c + vec3(0, 1, 0)), d = lattice(c + vec3(1, 1, 0));
    float top = mix(a, b, s.x), bottom = mix(e, d, s.x);
    r[k] = vec3(mix(top, bottom, s.y), ds.x * mix(b - a, d - e, s.y), ds.y * (bottom - top));
  }
  return mix(r[0], r[1], s.z);
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  // The silhouette is the edge blur cut at half: slices closer than the blur merge
  // like droplets, and slivers thinner than it fall away. That is what Rounding rounds.
  // Contain lowers the blur before the cut (only the cut: the bevel still follows the
  // blur), by up to 0.56 where its boundary is empty: it trims strokes cleanly at its
  // outline, but a stroke well clear of it survives outside, and a soft boundary thins
  // every slice near it rather than fading them, as measured. Reveal is a second
  // boundary, its outline's, lowering the same cut the same way: slices thin out towards
  // it, the thinner first, and end crisply rather than fade (measured the same way).
  float edge = uHasEdge ? textureLod(uEdge, uv, 0.0).r : textureLod(uCoverage, uv, 0.0).a;
  float bound = 1.0;
  if (uContain > 0.0) bound = mix(1.0, textureLod(uShape, uv, 0.0).r, uContain);
  if (uReveal > 0.0) bound *= mix(1.0, textureLod(uMask, uv, 0.0).r, uReveal);
  float cut = max(0.0, edge - 0.56 * (1.0 - bound));
  float alpha = uHasEdge ? smoothstep(0.45, 0.55, cut) : cut;
  alpha *= uLayerAlpha;
  // A pixel outside the layer can only stop early with the rest of its 2×2 block: the
  // ramp's mip level needs every pixel of a block that draws to reach the derivatives
  // below. The cut never lets a blur of 0.45 or less through.
  vec2 corner = (floor(gl_FragCoord.xy * 0.5) * 2.0 + 0.5) / uRes, px1 = 1.0 / uRes;
  float most = 0.0;
  for (int k = 0; k < 4; k++) {
    vec2 at = corner + px1 * vec2(k & 1, k >> 1);
    most = max(most, uHasEdge ? textureLod(uEdge, at, 0.0).r : textureLod(uCoverage, at, 0.0).a);
  }
  if (most <= (uHasEdge ? 0.45 : 0.0)) { frag = vec4(0.0); return; }
  vec2 onFrame = (canvasPx() - uFrame.xy) / uFrame.zw;
  vec2 d = ((onFrame - uAnchor) / uSize + 0.5) * uCells - 0.5 * uCells;
  d = vec2(uRot.x * d.x - uRot.y * d.y, uRot.y * d.x + uRot.x * d.y) + 0.5 * uCells;
  // Their field sits 0.0015 of a frame (or shape) past the lattice on both axes.
  vec3 n = valueNoise(vec3(d.x + uPhase, d.y / uStretch, uSlice) + vec3(0.0015 * uCells, 0.0015 * uCells, 0.0));
  // Two uniforms summed: a bell flatter than a triangle, as measured.
  uvec2 px = uvec2(gl_FragCoord.xy);
  float grain = ((rand(uvec3(px, 11u)) - 0.5) * 0.0683 + (rand(uvec3(px, 12u)) - 0.5) * 0.0297) * uRough;
  // The landscape, grain and all, sinks with the blurred coverage: that is the bevel.
  float h = (uDepth * n.x + grain) * edge - 0.5 * uDepth;
  float split = 0.097 * length(n.yz) * uDepth * uSplit;
  // One clamp over everything: where the landscape is already flat at a plateau the
  // bevel, the grain and the split flatten into it too.
  vec3 hs = h + vec3(split, 0.0, -split);
  vec3 raw = uRepeats * (0.5 + clamp(hs, -0.5, 0.5)) + uOffset;
  // Wrapped into (0, 1]: a whole number reads the end of the ramp, not its start.
  vec3 idx = raw - ceil(raw) + 1.0;
  // The ramp is read through its mip chain at the footprint of the index across the
  // pixel, as theirs is: where the grain makes the index jump between neighbours the
  // colour averages over the stretch of ramp the jump spans. Measured: 0.7 of the
  // footprint. The footprint is the unwrapped index's: a wrap is not a jump.
  vec3 ix = 0.7 * dFdx(raw), iy = 0.7 * dFdy(raw);
  vec3 at = clamp(idx, 0.5 / ${RAMP_SIZE}.0, 1.0 - 0.5 / ${RAMP_SIZE}.0);
  vec3 rgb = vec3(
    textureGrad(uRamp, vec2(at.r, 0.5), vec2(ix.r, 0.0), vec2(iy.r, 0.0)).r,
    textureGrad(uRamp, vec2(at.g, 0.5), vec2(ix.g, 0.0), vec2(iy.g, 0.0)).g,
    textureGrad(uRamp, vec2(at.b, 0.5), vec2(ix.b, 0.0), vec2(iy.b, 0.0)).b);
  // Near a wrap a pixel takes some of the colour across it (the ramp's other end), by
  // an amount of its own: half at the wrap, fading over a band 0.185 of the height
  // wide at full Roughness. Each pixel's share is offset by a random of its own
  // (Laplace, for the long tail of stray pixels theirs has), so the band is a soft
  // dissolve of every shade between the two ends, as measured. Band and offset are
  // heights, so the clamp flattens them like the grain: a plateau never takes any.
  float g = uRough * edge;
  float r = rand(uvec3(px, 13u)) * 2.0 - 1.0;
  float t = -sign(r) * log(max(1.0 - abs(r), 1e-7));
  vec3 shifted = uRepeats * (0.5 + clamp(hs + 0.0364 * t * g, -0.5, 0.5)) + uOffset;
  vec3 band = uRepeats * (clamp(hs + 0.0925 * g, -0.5, 0.5) - clamp(hs - 0.0925 * g, -0.5, 0.5));
  // The whole number this pixel is nearest, and how far the offset carries it past.
  vec3 before = step(0.5, idx), wrap = raw + mix(-idx, 1.0 - idx, before);
  vec3 m = clamp(0.5 + (shifted - wrap) * (2.0 * before - 1.0) / max(band, 1e-5), 0.0, 1.0) * step(1e-4, band);
  vec3 start = texelFetch(uRamp, ivec2(0), 0).rgb, end = texelFetch(uRamp, ivec2(${RAMP_SIZE - 1}, 0), 0).rgb;
  rgb = mix(rgb, mix(end, start, before), m);
  frag = alpha > 0.0 ? vec4(rgb * alpha, alpha) : vec4(0.0);
}`;

// The stage viewer's window onto one buffer, opaque.
const FS_BLIT = HEADER + `
uniform sampler2D uSrc;
uniform int uMode;
void main() {
  vec4 t = textureLod(uSrc, gl_FragCoord.xy / uRes, 0.0);
  frag = vec4(uMode == 1 ? vec3(t.a) : uMode == 2 ? vec3(t.r) : t.rgb, 1.0);
}`;

/** Its blurs' coarsest level: their reduced copies are 2^level times smaller (fx/backdrop.js BOX_GRID). */
export const MAX_BLUR_LEVEL = 4;

/**
 * `shared` is another instance's programs and lattice (from its `fork()`): an
 * instance with its own targets, for a layer drawn in its own box (fx/backdrop.js).
 */
export function createPatternEffect(kit, shared = null) {
  const { gl } = kit;
  const P = shared?.P ?? {
    shape: kit.program(FS_SHAPE, 'pattern/shape'),
    refract: kit.program(FS_REFRACT, 'pattern/refract'),
    blur: kit.program(FS_BLUR, 'pattern/blur'),
    colour: kit.program(FS_COLOUR, 'pattern/colour'),
    blit: kit.program(FS_BLIT, 'pattern/blit'),
  };
  const rampTex = kit.texture();
  const blank = kit.texture();
  // The landscape's random values: read texel by texel, never filtered.
  let latticeTex = shared?.latticeTex;
  if (!latticeTex) {
    latticeTex = kit.texture();
    gl.bindTexture(gl.TEXTURE_2D, latticeTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, LATTICE_COLUMNS, LATTICE_ROWS, 0, gl.RED, gl.FLOAT, LATTICE);
  }
  let rampKey = '', rampStops = null;
  // `levels`: how many times the canvas can be halved, plus one (what a blur can reduce to).
  let W = 0, H = 0, levels = 1;
  let shapeRT = null, refractRT = null;
  const blurRTs = new Map();
  const rasters = {};
  const uploads = {};

  // Targets follow the canvas, but are only (re)allocated when a layer is drawn, so a
  // session that never shows this effect never pays for them.
  let wanted = [0, 0];
  function resize(w, h) {
    wanted = [w, h];
  }
  function allocate() {
    const [w, h] = wanted;
    if (w === W && h === H && shapeRT) return;
    W = w; H = h;
    shapeRT?.dispose(); refractRT?.dispose();
    for (const rt of blurRTs.values()) rt.dispose();
    blurRTs.clear();
    for (const k of Object.keys(rasters)) delete rasters[k];
    levels = Math.min(MAX_BLUR_LEVEL + 1, Math.floor(Math.log2(Math.max(w, h))) + 1);
    shapeRT = kit.target(w, h);
    refractRT = kit.target(w, h);
  }

  // A blur at `level` writes its first pass at that level's width but the source's full
  // height (its rows on the source's rows), and its second at that level.
  function blurTarget(use, level, pass) {
    const key = `${use}:${level}:${pass}`;
    let rt = blurRTs.get(key);
    if (!rt) {
      const h = pass === 0 ? H : Math.ceil(H / 2 ** level);
      rt = kit.target(Math.max(1, Math.ceil(W / 2 ** level)), Math.max(1, h));
      blurRTs.set(key, rt);
    }
    return rt;
  }

  /**
   * Gaussian blur of one channel of a texture of the canvas's size, cut off `reach` pixels
   * out; returns the target holding it (red), `level` times halved.
   */
  function blur(use, src, sigma, channel, reach = Infinity) {
    let level = Math.max(1, Math.min(MAX_BLUR_LEVEL, levels - 1, Math.ceil(Math.log2(Math.max(sigma, 1) / 3))));
    // Fine enough that the cut-off falls at least 8 taps out.
    if (Number.isFinite(reach)) level = Math.max(1, Math.min(level, Math.floor(Math.log2(reach / 8))));
    const cut = Number.isFinite(reach) ? reach : 1e6;
    const a = blurTarget(use, level, 0), b = blurTarget(use, level, 1);
    kit.pass(P.blur, a, (loc, bind) => {
      bind('uSrc', src);
      gl.uniform2f(loc('uRes'), a.w, a.h);
      gl.uniform1f(loc('uSigma'), Math.max(sigma, 0.05));
      gl.uniform1f(loc('uReach'), cut);
      gl.uniform2f(loc('uDir'), 1, 0);
      gl.uniform2f(loc('uSrcSize'), W, H);
      gl.uniform1i(loc('uChannel'), channel);
    });
    kit.pass(P.blur, b, (loc, bind) => {
      bind('uSrc', a.tex);
      gl.uniform2f(loc('uRes'), b.w, b.h);
      gl.uniform1f(loc('uSigma'), Math.max(sigma, 0.05));
      gl.uniform1f(loc('uReach'), cut);
      gl.uniform2f(loc('uDir'), 0, 1);
      gl.uniform2f(loc('uSrcSize'), a.w, a.h);
      gl.uniform1i(loc('uChannel'), 0);
    });
    return b;
  }

  /** Upload a Canvas2D raster (when it changed). */
  function uploadRaster(name, draw) {
    const cache = (rasters[name] ||= rasterCache(W, H));
    const tex = (uploads[name] ||= kit.texture());
    if (draw(cache)) kit.upload(tex, cache.canvas);
    return tex;
  }

  function setRamp(stops) {
    // The same stops as last time (a layer's own gradient, a cover's ramp): nothing to do,
    // without normalising and comparing them at every layer of every frame.
    if (stops && stops === rampStops) return;
    rampStops = stops;
    const ramp = normaliseRamp(stops) || normaliseRamp([{ position: 0, color: '#ffffff' }]);
    const key = JSON.stringify(ramp);
    if (key === rampKey) return;
    rampKey = key;
    gl.bindTexture(gl.TEXTURE_2D, rampTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, RAMP_SIZE, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, bakeRamp(ramp));
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  }

  /**
   * Draw one layer over whatever is on the canvas, premultiplied.
   * @param {object} values  the layer's parameters at this moment
   * @param {object} o       {F: fitted frame, samples: supersampling per axis, ramp, stage,
   *                          opacity: of the finished layer, a fade that changes nothing
   *                          else, target: where to draw it (default the canvas), bounds:
   *                          [x0, y0, x1, y1] pixels of it the layer is confined to (its
   *                          box: nothing refracts outside it or from outside it, so the
   *                          edge blur rounds what meets it)}
   */
  function render(values, { F, samples = 3, ramp, stage = null, opacity = 1, target = null, bounds = null }) {
    const v = { ...DEFAULTS, ...values };
    // Nothing to draw: no size, no opacity, or a ring opened all the way.
    if (!(v.shapeSize > 0) || !(v.shapeAlpha > 0) || !(opacity > 0) || (Math.round(v.shape) === SHAPES.ring && v.ringInner >= v.ringOuter)) return;
    allocate();
    const u = F.unit;
    const shapeSpace = Math.round(v.fxSpace) === 1;
    const k = shapeSpace ? v.shapeSize / 100 : 1;
    const d = F.S * v.shapeSize / 100;
    const centre = [F.x(v.shapeX), F.y(v.shapeY)];
    const kind = Math.round(v.shape);
    setRamp(ramp);

    // 1 · shape
    const custom = kind === SHAPES.custom;
    // The Contain boundary is the shape blurred by a Gaussian of Softness authored px.
    const containSoft = Math.max(0, v.containSoft) * u;
    let customCov = blank, customBound = blank;
    if (custom) {
      customCov = uploadRaster('custom', (c) => drawCustomShape(c, F, v));
      if (v.contain > 0) {
        const solid = uploadRaster('customBound', (c) => drawSolidRing(c, F, v, 'pts', 0));
        customBound = containSoft > 0.5 ? blur('bound', solid, containSoft, 3).tex : solid;
      }
    }
    const sx = Math.max(0.01, v.shapeW / 100), sy = Math.max(0.01, v.shapeH / 100);
    const outer = (d / 2) * clamp01(v.ringOuter / 100);
    const reachBase = kind === SHAPES.ring ? (d / 2) * Math.max(0.01, v.ringOuter / 100) : kind === SHAPES.circle ? d / 2 : d * Math.SQRT1_2;
    const fillAngle = (v.shapeFillA * Math.PI) / 180;
    kit.pass(P.shape, shapeRT, (loc, bind) => {
      gl.uniform2f(loc('uRes'), W, H);
      gl.uniform1i(loc('uKind'), kind);
      gl.uniform2f(loc('uCentre'), centre[0], centre[1]);
      gl.uniform1f(loc('uDiam'), d);
      gl.uniform2f(loc('uScale'), sx, sy);
      gl.uniform1f(loc('uRot'), (v.shapeRot * Math.PI) / 180);
      gl.uniform2f(loc('uRing'), Math.min(outer, (d / 2) * clamp01(v.ringInner / 100)), outer);
      gl.uniform1f(loc('uOpacity'), clamp01(v.shapeAlpha / 100));
      gl.uniform1i(loc('uFill'), Math.round(v.shapeFill));
      gl.uniform1f(loc('uReach'), Math.max(1, reachBase * Math.max(sx, sy) * (v.shapeFillSize / 100)));
      gl.uniform1f(loc('uFade'), clamp01(v.shapeFade / 100));
      gl.uniform2f(loc('uFillDir'), Math.cos(fillAngle), Math.sin(fillAngle));
      gl.uniform1f(loc('uBoundSoft'), containSoft);
      gl.uniform1i(loc('uCustom'), custom ? 1 : 0);
      bind('uCustomCov', customCov);
      bind('uCustomBound', customBound);
    });
    if (stage === 'shape') return blit(shapeRT.tex, 1);

    // 2 · refraction
    const period = Math.max(1, (20 + 9.8 * v.radius) * k * u);
    const angle = (v.angle * Math.PI) / 180;
    const patternCentre = shapeSpace
      ? [centre[0] + ((v.cx - 50) / 100) * d, centre[1] + ((v.cy - 50) / 100) * d]
      : [F.x(v.cx), F.y(v.cy)];
    kit.pass(P.refract, refractRT, (loc, bind) => {
      bind('uSrc', shapeRT.tex);
      gl.uniform2f(loc('uRes'), W, H);
      gl.uniform1i(loc('uType'), Math.round(v.patternType));
      gl.uniform1i(loc('uWrap'), Math.round(v.pixelWrapMode));
      // At Strength 0 the relief pushes nothing: every sample would read the same pixel.
      const grid = v.amount === 0 ? 1 : Math.max(1, Math.min(6, Math.round(samples)));
      gl.uniform1i(loc('uSamples'), grid);
      // Across a wall, about six samples per authored pixel, however small it is drawn.
      gl.uniform1i(loc('uWallSamples'), grid > 1 ? Math.max(grid, Math.min(16, Math.ceil(6 / u))) : grid);
      gl.uniform2f(loc('uCentre'), patternCentre[0], patternCentre[1]);
      gl.uniform2f(loc('uAxis'), Math.cos(angle), Math.sin(angle));
      gl.uniform1f(loc('uPeriod'), period);
      // The ridge is 9.35 authored pixels high whatever the period; the second term puts
      // the refracted push in the units uAmount scales (a push of 8.47 px per unit of
      // Strength, along the bent ray).
      const authoredPeriod = Math.max(1, 20 + 9.8 * v.radius);
      gl.uniform2f(loc('uLens'), 9.35 / authoredPeriod, (8.47 * authoredPeriod) / 230);
      // The unpushed zone at a wall, a little wider than reflection alone gives (so
      // seams come out as deep as theirs): 0.004 of a period at Radius 6, falling with
      // the square of the period.
      gl.uniform1f(loc('uWallGap'), 0.004 * (78.8 / authoredPeriod) ** 2);
      // Strength is a push in pixels that grows with the relief's slope, and the
      // slope of a relief of fixed depth falls as its period grows.
      gl.uniform1f(loc('uAmount'), (230 * v.amount * k * k * u * u) / period);
      gl.uniform1f(loc('uSmooth'), clamp01(v.seamlessness / 100));
      gl.uniform1f(loc('uFrost'), clamp01(v.frost / 100));
      gl.uniform1f(loc('uDispersion'), v.iorDispersion / 100);
      gl.uniform1i(loc('uSpectral'), stage === 'refract' ? 1 : 0);
      gl.uniform4f(loc('uBounds'), ...(bounds ?? [-1e9, -1e9, 1e9, 1e9]));
    });
    if (stage === 'refract') return blit(refractRT.tex, 0);

    // 3 · edge
    const sigma = Math.max(0, v.mRounding) * k * u;
    const edge = sigma >= 0.75 ? blur('edge', refractRT.tex, sigma, 3, 32 * u) : null;
    if (stage === 'edge') return blit(edge ? edge.tex : refractRT.tex, edge ? 2 : 1);

    // Reveal: a second outline, a boundary as Contain's is. As measured: the outline
    // grown by 2 × softness and blurred by a Gaussian of softness, so a fresh copy of the
    // shape hides nothing.
    let mask = blank;
    if (v.mask > 0) {
      const soft = Math.max(0, v.maskSoft) * u;
      const solid = uploadRaster('reveal', (c) => drawSolidRing(c, F, v, 'pts2', soft * 2));
      mask = soft > 0.5 ? blur('reveal', solid, soft, 3).tex : solid;
    }

    // 4 · colouring, onto the canvas
    const noiseAngle = (v.mAngle * Math.PI) / 180;
    kit.pass(P.colour, target, (loc, bind) => {
      bind('uCoverage', refractRT.tex);
      bind('uShape', shapeRT.tex);
      bind('uEdge', edge ? edge.tex : blank);
      bind('uMask', mask);
      bind('uRamp', rampTex);
      gl.uniform2f(loc('uRes'), W, H);
      gl.uniform1i(loc('uHasEdge'), edge ? 1 : 0);
      bind('uLattice', latticeTex);
      gl.uniform1f(loc('uOffset'), v.mOffset / 100);
      gl.uniform1f(loc('uDepth'), Math.max(0, v.mDepth) / 100);
      gl.uniform1f(loc('uRepeats'), Math.max(1, v.mRepeats));
      gl.uniform1f(loc('uRough'), clamp01(v.mRough / 100));
      gl.uniform1f(loc('uSplit'), Math.max(0, v.mSplit) / 100);
      gl.uniform4f(loc('uFrame'), F.ox, F.oy, F.w, F.h);
      gl.uniform2f(loc('uAnchor'), shapeSpace ? v.shapeX / 100 : 0.5, shapeSpace ? v.shapeY / 100 : 0.5);
      gl.uniform1f(loc('uSize'), Math.max(1e-3, k));
      gl.uniform2f(loc('uRot'), Math.cos(noiseAngle), Math.sin(noiseAngle));
      // A cell is Scale/100 of the frame (or the shape) on each axis.
      gl.uniform1f(loc('uCells'), 100 / Math.max(1e-3, v.mScale));
      gl.uniform1f(loc('uStretch'), Math.max(0.01, v.mStretch / 100));
      gl.uniform1f(loc('uPhase'), (v.mPhase / 100) * 8);
      // Slices fall 0.37 of a slice past Evolution 0.
      gl.uniform1f(loc('uSlice'), (v.mEvolution / 100) * 8 + 0.37);
      gl.uniform1f(loc('uContain'), clamp01(v.contain / 100));
      gl.uniform1f(loc('uReveal'), clamp01(v.mask / 100));
      gl.uniform1f(loc('uLayerAlpha'), stage ? 1 : clamp01(opacity));
    }, { blend: true });
  }

  function blit(tex, mode) {
    kit.pass(P.blit, null, (loc, bind) => {
      bind('uSrc', tex);
      gl.uniform2f(loc('uRes'), W, H);
      gl.uniform1i(loc('uMode'), mode);
    });
  }

  function dispose() {
    shapeRT?.dispose(); refractRT?.dispose();
    for (const rt of blurRTs.values()) rt.dispose();
    for (const t of [rampTex, blank, ...Object.values(uploads)]) gl.deleteTexture(t);
    if (shared) return;
    gl.deleteTexture(latticeTex);
    for (const p of Object.values(P)) gl.deleteProgram(p.p);
  }

  return { resize, render, dispose, fork: () => createPatternEffect(kit, { P, latticeTex }) };
}

function clamp01(x) {
  return Math.max(0, Math.min(1, Number(x) || 0));
}
