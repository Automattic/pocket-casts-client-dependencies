// Wave: a gradient bar, blurred, warped by two travelling waves, mirrored, recoloured
// through a cyclic ramp, then stretched by a mesh.
//
// Adapted from Creative Lab's Wave effect (motion/…/reference/source/effect-wave.js
// and shaders-wave.js), itself rebuilt from an After Effects comp. Unlike Pattern
// refraction, the handoff puts no constraint on reusing this code, so the passes, the
// constants and the measured behaviour (Semicircle waves, one period per two Wave
// Widths, Colorama reading the premultiplied image) are theirs. What changed is the
// plumbing: this engine's conventions (canvas pixels y down, the fitted reference
// frame, one full-screen triangle per pass) instead of their player's.
//
//   1 bar       a rectangle filled with the layer's gradient
//   2 blur      a separable Gaussian, in two stages, BEFORE the waves
//   3 warp      wave 2, wave 1 and the mirror as one backwards lookup, supersampled
//   4 colour    Colorama: brightness read around a cyclic ramp (the layer's `fx.cycle`)
//   5 mesh      a Coons patch through nine pins (`fx.mesh`, `fx.tan`), real geometry
//   6 ripple    concentric rings bending the finished layer (only when Amount > 0)
//
// Ripple is in the deliverables' runtime but not in `reference/source/`, which is older;
// the deliverables win (play again is the one that uses it).
//
// Render order is that list. Creative Lab's panel lists it as a layer stack with the
// bar at the bottom, so it reads in reverse there.

import { normaliseRamp } from './ramp.js';

/** Parameter defaults, for documents that leave a parameter out. */
export const DEFAULTS = {
  mirrorOn: 1, mirrorX: 50, mirrorY: 50, mirrorAngle: 180,
  w1On: 1, w1Height: 9, w1Width: 16, w1Dir: 180, w1Speed: 0.1, w1Phase: 0,
  w2On: 1, w2Height: 18, w2Width: 17.7, w2Dir: 180, w2Speed: 0.2, w2Phase: 0,
  blur: 8, srcW: 40, srcH: 57.5, srcX: 43.9, srcY: 71.5, gradAngle: 90,
  colorOn: 1, colorFill: 1, colorPhase: -100, colorRepeat: 1, colorBlend: 0,
  meshOn: 1,
  rippleAmt: 0, rippleScale: 1, ripplePhase: 0, rippleX: 50, rippleY: 50,
};

/** The pipeline, in order, for the rig's stage viewer. */
export const STAGES = [
  { id: 'bar', label: '1 · Gradient bar' },
  { id: 'blur', label: '2 · Blur' },
  { id: 'warp', label: '3 · Waves + mirror' },
  { id: 'colour', label: '4 · Colorama' },
  { id: 'mesh', label: '5 · Mesh warp' },
  { id: 'ripple', label: '6 · Ripple (final)' },
];

// Colorama's output cycle when a layer brings none: Creative Lab's signed-off default.
// [position, r, g, b], channels 0..1.
const DEFAULT_CYCLE = [[0.0037135, 0.2705882, 0.0078431, 0.0352941], [0.5326382, 1, 0, 0.6470588], [0.7456601, 0.9647059, 0, 0.0745098]];
// The signed-off mesh pose, for a layer without one: nine pins row-major from the top
// left and their tangent handles (pin * 4 + right, left, down, up), in frame fractions.
const DEFAULT_MESH = [[-0.2157554, -0.1627686], [0.6161951, -0.1806025], [1.3209971, 0.0970551], [-0.038618, 0.3227171], [0.5516254, 0.4219033], [1.0596926, 0.7876861], [-0.187999, 1.1792522], [0.4196555, 1.117713], [1.0580529, 1.0422761]];
const DEFAULT_TAN = [[0.2472897, 0.0728201], [0, 0], [0, 0.1666667], [0, 0], [0.2085439, 0.0967233], [-0.2416877, -0.092886], [-0.1956222, 0.1555357], [0, 0], [0, 0], [-0.1666667, 0], [0, 0.1666667], [0, 0], [0.2157856, -0.0239582], [0, 0], [0.0271903, 0.1582405], [0, -0.1666667], [0.2977779, 0.1720563], [-0.2948027, -0.1811201], [-0.0353231, 0.3514735], [0.0005496, -0.4076797], [0, 0], [-0.2923009, 0.1118383], [0, 0.1666667], [0, -0.1666667], [0.1666667, 0], [0, 0], [0, 0], [0.0785846, -0.1379877], [0.3669819, 0.068697], [-0.2132676, -0.0433974], [0, 0], [-0.1917964, -0.4177783], [0, 0], [-0.1666667, 0], [0, 0], [-0.0415175, -0.0807805]];
const MAX_STOPS = 8;
/** Lattice steps across the reference frame for the mesh. */
const MESH_STEPS = 48;

const HEADER = `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uRes;
out vec4 frag;
// The canvas position this fragment covers, 0..1, y down.
vec2 canvasUv() { return vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes; }
// A canvas position to a (bottom-up) texture coordinate.
vec2 fbuv(vec2 uv) { return vec2(uv.x, 1.0 - uv.y); }
`;

// ── 1 · the bar: a rectangle with a linear gradient, premultiplied ─────────────────
const FS_BAR = HEADER + `
uniform vec2 uCentre;      // uv
uniform vec2 uHalf;        // uv
uniform float uGradAngle;  // radians, inside the rectangle
uniform vec4 uGradC[8];
uniform float uGradP[8];
uniform int uGradN;
vec3 ramp(float x) {
  vec3 c = uGradC[0].rgb;
  for (int i = 0; i < 7; i++) {
    if (i + 1 >= uGradN) break;
    float span = max(uGradP[i + 1] - uGradP[i], 1e-5);
    c = mix(c, uGradC[i + 1].rgb, clamp((x - uGradP[i]) / span, 0.0, 1.0));
  }
  return c;
}
void main() {
  vec2 uv = canvasUv();
  vec2 d = abs(uv - uCentre);
  // A one-pixel edge at any size, so it is clean before the blur sees it.
  vec2 e = fwidth(uv) * 0.5;
  float a = (1.0 - smoothstep(uHalf.x - e.x, uHalf.x + e.x, d.x)) * (1.0 - smoothstep(uHalf.y - e.y, uHalf.y + e.y, d.y));
  vec2 rel = (uv - uCentre) / max(uHalf, vec2(1e-5));
  float g = dot(rel, vec2(cos(uGradAngle), sin(uGradAngle))) * 0.5 + 0.5;
  frag = vec4(ramp(clamp(g, 0.0, 1.0)) * a, a);
}`;

// ── 2 · blur ───────────────────────────────────────────────────────────────────────
// AE's Fast Box Blur at 3 iterations is close to a Gaussian with sigma ≈ the radius.
// The tap count is fixed and spread over 3 sigma, so a large radius is preceded by a
// small one (see render()) or a hard edge convolves into a staircase.
const FS_BLUR = HEADER + `
uniform sampler2D uTex;
uniform float uSigma;      // pixels
uniform int uVertical;
const int TAPS = 24;
void main() {
  vec2 uv = fbuv(canvasUv());
  if (uSigma < 0.5) { frag = texture(uTex, uv); return; }
  vec2 dir = uVertical == 1 ? vec2(0.0, 1.0 / uRes.y) : vec2(1.0 / uRes.x, 0.0);
  float stepPx = 3.0 * uSigma / float(TAPS);
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int i = -TAPS; i <= TAPS; i++) {
    float o = float(i) * stepPx;
    float w = exp(-0.5 * o * o / (uSigma * uSigma));
    acc += texture(uTex, uv + dir * o) * w;
    wsum += w;
  }
  frag = acc / wsum;
}`;

// ── 3 · the two wave warps and the mirror, one lookup walked backwards ─────────────
// AE's Semicircle wave, as Creative Lab measured it off a reference render: every lobe
// is an arc bulging the same way, joined at cusps; one period spans TWO Wave Widths;
// Wave Height is the peak, so the swing is ± height. Anchored at the frame's centre,
// so a wider canvas does not slide the phase. Anything pulled in from outside the
// canvas is transparent, and that is what carves the scallops.
const FS_WARP = HEADER + `
uniform sampler2D uTex;
uniform int uSamples;
uniform vec3 uWave1;       // peak px, period px, phase in periods
uniform float uDir1;       // radians
uniform vec3 uWave2;
uniform float uDir2;
uniform int uMirror;
uniform vec2 uMirrorC;     // canvas px
uniform vec2 uFrameC;      // the frame's centre, canvas px
uniform float uMirrorA;    // radians
float waveVal(float p, float amp, float lambda) {
  float x = fract(p / lambda + 0.5) * 2.0 - 1.0;
  return amp * (1.0 - 2.0 * sqrt(max(0.0, 1.0 - x * x)));
}
vec2 waveOffset(vec2 p, vec3 wv, float dir) {
  if (wv.y < 0.5 || wv.x == 0.0) return vec2(0.0);
  vec2 a = vec2(cos(dir), sin(dir));
  vec2 n = vec2(-a.y, a.x);
  return a * waveVal(dot(p - uFrameC, n) + wv.z * wv.y, wv.x, wv.y);
}
void main() {
  vec2 px = canvasUv() * uRes;
  int M = max(uSamples, 1);
  vec4 acc = vec4(0.0);
  for (int sy = 0; sy < 6; sy++) {
    if (sy >= M) break;
    for (int sx = 0; sx < 6; sx++) {
      if (sx >= M) break;
      vec2 q = px + (vec2(float(sx), float(sy)) + 0.5) / float(M) - 0.5;
      if (uMirror == 1) {
        vec2 nrm = vec2(cos(uMirrorA), sin(uMirrorA));
        float d = dot(q - uMirrorC, nrm);
        if (d > 0.0) q -= 2.0 * d * nrm;
      }
      // The last undone is the first applied: wave 2, then wave 1, then the mirror.
      q += waveOffset(q, uWave1, uDir1);
      q += waveOffset(q, uWave2, uDir2);
      vec2 suv = q / uRes;
      float inside = step(0.0, suv.x) * step(suv.x, 1.0) * step(0.0, suv.y) * step(suv.y, 1.0);
      acc += texture(uTex, fbuv(suv)) * inside;
    }
  }
  frag = acc / float(M * M);
}`;

// ── 4 · Colorama ───────────────────────────────────────────────────────────────────
// Brightness read around a colour WHEEL: past the last stop it blends back to the
// first. "Fill frame" reads the premultiplied image, so a transparent pixel lands on
// the start of the ramp and the result is opaque edge to edge (what the reference
// does); "Keep alpha" recolours the straight colour and keeps the holes.
const FS_COLOUR = HEADER + `
uniform sampler2D uTex;
uniform int uColorOn;
uniform int uColorFill;
uniform vec4 uCycC[8];
uniform float uCycP[8];
uniform int uCycN;
uniform float uPhase;      // turns
uniform float uRepeat;
uniform float uBlend;      // 0 all Colorama, 1 all original
uniform float uOpacity;    // the layer's, when this pass draws onto the canvas
vec3 cycleAt(float x) {
  x = fract(x);
  int n = uCycN;
  float p0 = uCycP[n - 1] - 1.0, p1 = uCycP[0];
  vec3 c0 = uCycC[n - 1].rgb, c1 = uCycC[0].rgb;
  if (x > uCycP[n - 1]) { p0 = uCycP[n - 1]; p1 = uCycP[0] + 1.0; }
  for (int i = 0; i < 7; i++) {
    if (i + 1 >= n) break;
    if (x >= uCycP[i] && x <= uCycP[i + 1]) {
      p0 = uCycP[i]; p1 = uCycP[i + 1];
      c0 = uCycC[i].rgb; c1 = uCycC[i + 1].rgb;
    }
  }
  return mix(c0, c1, clamp((x - p0) / max(p1 - p0, 1e-5), 0.0, 1.0));
}
void main() {
  vec4 c = texture(uTex, fbuv(canvasUv()));
  if (uColorOn == 1) {
    const vec3 LW = vec3(0.2126, 0.7152, 0.0722);
    if (uColorFill == 1) {
      c = vec4(mix(cycleAt(dot(c.rgb, LW) * uRepeat + uPhase), c.rgb, uBlend), 1.0);
    } else if (c.a > 0.0) {
      vec3 straight = c.rgb / c.a;
      c = vec4(mix(cycleAt(dot(straight, LW) * uRepeat + uPhase), straight, uBlend) * c.a, c.a);
    }
  }
  frag = c * uOpacity;
}`;

// ── 5 · mesh warp ──────────────────────────────────────────────────────────────────
// A FORWARD map, drawn as geometry: a lattice laid out on the reference frame (and
// extended to cover the canvas) is moved by a Coons patch through nine pins, and the
// coloured buffer is stretched across it. Each patch boundary is a cubic Bezier using
// the facing tangent handles. Outside the frame the mapping carries on rigidly from
// the boundary, so the surround travels with the edge it is attached to. An untouched
// grid is an exact identity.
const VS_MESH = `#version 300 es
in vec2 aGrid;             // canvas uv, y down
uniform vec2 uPin[9];
uniform vec2 uTan[36];
uniform vec2 uRefO, uRefS; // the frame in canvas uv
out vec2 vUv;
vec2 bez(vec2 a, vec2 b, vec2 c, vec2 d, float t) {
  float m = 1.0 - t;
  return m * m * m * a + 3.0 * m * m * t * b + 3.0 * m * t * t * c + t * t * t * d;
}
vec2 hCurve(int i, int j, float t) {
  int a = j * 3 + i, b = a + 1;
  return bez(uPin[a], uPin[a] + uTan[a * 4], uPin[b] + uTan[b * 4 + 1], uPin[b], t);
}
vec2 vCurve(int i, int j, float t) {
  int a = j * 3 + i, b = a + 3;
  return bez(uPin[a], uPin[a] + uTan[a * 4 + 2], uPin[b] + uTan[b * 4 + 3], uPin[b], t);
}
void main() {
  vec2 g = (aGrid - uRefO) / uRefS;
  vec2 gc = clamp(g, 0.0, 1.0);
  float gx = gc.x * 2.0, gy = gc.y * 2.0;
  int ci = int(min(floor(gx), 1.0)), cj = int(min(floor(gy), 1.0));
  float u = gx - float(ci), v = gy - float(cj);
  vec2 Ct = hCurve(ci, cj, u), Cb = hCurve(ci, cj + 1, u);
  vec2 Cl = vCurve(ci, cj, v), Cr = vCurve(ci + 1, cj, v);
  vec2 P00 = uPin[cj * 3 + ci], P10 = uPin[cj * 3 + ci + 1];
  vec2 P01 = uPin[(cj + 1) * 3 + ci], P11 = uPin[(cj + 1) * 3 + ci + 1];
  vec2 p = (1.0 - v) * Ct + v * Cb + (1.0 - u) * Cl + u * Cr
         - ((1.0 - u) * (1.0 - v) * P00 + u * (1.0 - v) * P10 + (1.0 - u) * v * P01 + u * v * P11);
  p += g - gc;
  vec2 q = uRefO + p * uRefS;
  vUv = aGrid;
  gl_Position = vec4(q.x * 2.0 - 1.0, 1.0 - q.y * 2.0, 0.0, 1.0);
}`;

const FS_MESH = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform float uOpacity;
in vec2 vUv;
out vec4 frag;
void main() { frag = texture(uTex, vec2(vUv.x, 1.0 - vUv.y)) * uOpacity; }`;

// ── 6 · ripple ────────────────────────────────────────────────────────────────────
// A sine displacement along the radius from a centre: rings. One turn of Phase is one
// ring, so a track from 0 to 1 sends them outward and lands where it started. Where
// the rings pinch, one pixel covers several of the source, so the warp's stretch
// decides an N×N grid of taps (1 to 6 a side): only the pinch pays. Distances are in
// the document's authored canvas, its shorter side 1, as Creative Lab's runtime
// measures them on that canvas: the rings are the same picture at any framing.
const FS_RIPPLE = HEADER + `
uniform sampler2D uTex;
uniform vec2 uAspect;      // the buffer's sides over the canvas's shorter side, so rings are round
uniform vec2 uCentre;      // canvas uv
uniform float uAmp;        // uv
uniform float uFreq;       // rings per unit distance
uniform float uPhase;      // turns
uniform float uOpacity;
vec2 rippleUv(vec2 uv) {
  vec2 rel = (uv - uCentre) * uAspect;
  float d = length(rel);
  if (d < 1e-5) return uv;
  return uv + (rel / d) / uAspect * uAmp * sin(6.2831853 * (uFreq * d - uPhase));
}
void main() {
  vec2 uv0 = canvasUv();
  vec2 texel = 1.0 / uRes;
  vec2 w0 = rippleUv(uv0);
  vec2 gx = (rippleUv(uv0 + vec2(texel.x, 0.0)) - w0) / texel;
  vec2 gy = (rippleUv(uv0 + vec2(0.0, texel.y)) - w0) / texel;
  int n = int(clamp(ceil(max(length(gx), length(gy))), 1.0, 6.0));
  float fn = float(n);
  vec4 sum = vec4(0.0);
  for (int j = 0; j < 6; j++) {
    if (j >= n) break;
    for (int i = 0; i < 6; i++) {
      if (i >= n) break;
      vec2 off = (vec2(float(i), float(j)) + 0.5) / fn - 0.5;
      sum += texture(uTex, fbuv(clamp(rippleUv(uv0 + off * texel), 0.0, 1.0)));
    }
  }
  frag = sum / (fn * fn) * uOpacity;
}`;

// The stage viewer's window onto one buffer, opaque.
const FS_BLIT = HEADER + `
uniform sampler2D uTex;
void main() { frag = vec4(texture(uTex, fbuv(canvasUv())).rgb, 1.0); }`;

/**
 * `shared` is another instance's programs (from its `fork()`): an instance with its own
 * targets, for a layer drawn in its own box (fx/backdrop.js: a summary card's).
 */
export function createWaveEffect(kit, shared = null) {
  const { gl } = kit;
  const P = shared?.P ?? {
    bar: kit.program(FS_BAR, 'wave/bar'),
    blur: kit.program(FS_BLUR, 'wave/blur'),
    warp: kit.program(FS_WARP, 'wave/warp'),
    colour: kit.program(FS_COLOUR, 'wave/colour'),
    mesh: kit.program(FS_MESH, 'wave/mesh', VS_MESH),
    ripple: kit.program(FS_RIPPLE, 'wave/ripple'),
    blit: kit.program(FS_BLIT, 'wave/blit'),
  };
  const gradC = new Float32Array(MAX_STOPS * 4), gradP = new Float32Array(MAX_STOPS);
  const cycC = new Float32Array(MAX_STOPS * 4), cycP = new Float32Array(MAX_STOPS);
  const pins = new Float32Array(18), tans = new Float32Array(72);
  let W = 0, H = 0, A = null, B = null, C = null;
  let meshVao = null, meshVbo = null, meshCount = 0, meshKey = '';

  // Targets follow the canvas but are only allocated when a layer is drawn, so a
  // session that never shows this effect never pays for them. 16 bits where the device
  // can: the bar is a smooth gradient that the blur flattens and the waves stretch.
  let wanted = [0, 0];
  function resize(w, h) {
    wanted = [w, h];
  }
  function allocate() {
    const [w, h] = wanted;
    if (w === W && h === H && A) return;
    W = w; H = h;
    for (const rt of [A, B, C]) rt?.dispose();
    A = kit.target(w, h, { float: true });
    B = kit.target(w, h, { float: true });
    C = kit.target(w, h, { float: true });
  }

  /** The lattice the mesh is drawn with: N steps across the frame, extended to the canvas. */
  function buildMesh(F) {
    const key = [W, H, F.ox, F.oy, F.w, F.h].map((n) => n.toFixed(3)).join(',');
    if (key === meshKey) return;
    meshKey = key;
    const N = MESH_STEPS;
    const ax = (k) => (F.ox + (k / N) * F.w) / W;
    const ay = (k) => (F.oy + (k / N) * F.h) / H;
    const i0 = Math.floor((-F.ox / F.w) * N), i1 = Math.ceil(((W - F.ox) / F.w) * N);
    const j0 = Math.floor((-F.oy / F.h) * N), j1 = Math.ceil(((H - F.oy) / F.h) * N);
    const v = new Float32Array((i1 - i0) * (j1 - j0) * 12);
    let k = 0;
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
      const x0 = ax(i), x1 = ax(i + 1), y0 = ay(j), y1 = ay(j + 1);
      for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x0, y1], [x1, y0], [x1, y1]]) {
        v[k++] = x;
        v[k++] = y;
      }
    }
    if (!meshVao) {
      meshVao = gl.createVertexArray();
      gl.bindVertexArray(meshVao);
      meshVbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, meshVbo);
      const a = gl.getAttribLocation(P.mesh.p, 'aGrid');
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 8, 0);
    } else {
      gl.bindVertexArray(meshVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, meshVbo);
    }
    gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    meshCount = k / 2;
  }

  /**
   * Draw one layer over whatever is on the canvas, premultiplied.
   * @param {object} values  the layer's parameters at this moment
   * @param {object} o       {F: fitted frame, samples: supersampling per axis, t: the
   *   layer's local time (the wave speeds are rates), layer: for `fx`, canvas: the
   *   document's authored canvas [w, h] (what the ripple's rings are measured on), override: a ramp
   *   replacing Colorama's output cycle (the colours seen), stage, opacity: the whole
   *   layer's, applied by the pass that draws onto the canvas, target: where to draw it
   *   (default the canvas; a box's own, sized as this instance)}
   */
  function render(values, { F, samples = 3, t = 0, layer = null, canvas = null, override = null, stage = null, opacity = 1, target = null }) {
    allocate();
    const v = { ...DEFAULTS, ...values };
    const S = F.S;

    // 1 · the bar
    const grad = packGradient(layer?.gradient);
    kit.pass(P.bar, A, (loc) => {
      gl.uniform2f(loc('uRes'), W, H);
      gl.uniform2f(loc('uCentre'), F.x(v.srcX) / W, F.y(v.srcY) / H);
      gl.uniform2f(loc('uHalf'), ((v.srcW / 100) / 2) * (F.w / W), ((v.srcH / 100) / 2) * (F.h / H));
      gl.uniform1f(loc('uGradAngle'), (v.gradAngle * Math.PI) / 180);
      gl.uniform4fv(loc('uGradC'), gradC);
      gl.uniform1fv(loc('uGradP'), gradP);
      gl.uniform1i(loc('uGradN'), grad);
    });
    if (stage === 'bar') return blit(A);

    // 2 · blur, on the unwarped bar. A small blur rounds the edge off to about the tap
    // spacing first; Gaussians compose by variance, so the two land on the radius asked.
    const sigma = (v.blur / 100) * S;
    const s1 = Math.min(sigma, Math.max(2, sigma / 8));
    const s2 = Math.sqrt(Math.max(0, sigma * sigma - s1 * s1));
    for (const [to, from, vertical, s] of [[B, A, 0, s1], [C, B, 1, s1], [B, C, 0, s2], [C, B, 1, s2]]) {
      kit.pass(P.blur, to, (loc, bind) => {
        bind('uTex', from.tex);
        gl.uniform2f(loc('uRes'), W, H);
        gl.uniform1f(loc('uSigma'), s);
        gl.uniform1i(loc('uVertical'), vertical);
      });
    }
    if (stage === 'blur') return blit(C);

    // 3 · waves and mirror. Phase runs against speed so a positive speed travels down.
    kit.pass(P.warp, B, (loc, bind) => {
      bind('uTex', C.tex);
      gl.uniform2f(loc('uRes'), W, H);
      gl.uniform1i(loc('uSamples'), Math.max(1, Math.min(6, Math.round(samples))));
      const on1 = Math.round(v.w1On) === 1 ? 1 : 0, on2 = Math.round(v.w2On) === 1 ? 1 : 0;
      gl.uniform3f(loc('uWave1'), (v.w1Height / 100) * S * on1, (v.w1Width / 100) * S * 2, v.w1Phase / 360 - v.w1Speed * t);
      gl.uniform1f(loc('uDir1'), ((v.w1Dir - 180) * Math.PI) / 180);
      gl.uniform3f(loc('uWave2'), (v.w2Height / 100) * S * on2, (v.w2Width / 100) * S * 2, v.w2Phase / 360 - v.w2Speed * t);
      gl.uniform1f(loc('uDir2'), ((v.w2Dir - 180) * Math.PI) / 180);
      gl.uniform1i(loc('uMirror'), Math.round(v.mirrorOn));
      gl.uniform2f(loc('uMirrorC'), F.x(v.mirrorX), F.y(v.mirrorY));
      gl.uniform2f(loc('uFrameC'), F.ox + F.w / 2, F.oy + F.h / 2);
      gl.uniform1f(loc('uMirrorA'), (v.mirrorAngle * Math.PI) / 180);
    });
    if (stage === 'warp') return blit(B);

    // 4 · Colorama: straight onto the canvas, or into a buffer for the mesh to stretch
    // or the ripple to bend.
    const meshOn = Math.round(v.meshOn) === 1;
    const ripple = v.rippleAmt > 0;
    const toBuffer = meshOn || ripple || stage === 'colour';
    const n = packCycle(override, layer?.fx?.cycle);
    kit.pass(P.colour, toBuffer ? A : target, (loc, bind) => {
      bind('uTex', B.tex);
      gl.uniform2f(loc('uRes'), W, H);
      gl.uniform1i(loc('uColorOn'), Math.round(v.colorOn));
      gl.uniform1i(loc('uColorFill'), Math.round(v.colorFill));
      gl.uniform4fv(loc('uCycC'), cycC);
      gl.uniform1fv(loc('uCycP'), cycP);
      gl.uniform1i(loc('uCycN'), n);
      gl.uniform1f(loc('uPhase'), v.colorPhase / 100);
      gl.uniform1f(loc('uRepeat'), v.colorRepeat);
      gl.uniform1f(loc('uBlend'), v.colorBlend / 100);
      gl.uniform1f(loc('uOpacity'), toBuffer ? 1 : opacity);
    }, { blend: !toBuffer });
    if (stage === 'colour') return blit(A);
    if (!meshOn) {
      if (ripple) rippleOnto(A, v, F, canvas, opacity, target);
      return;
    }

    // 5 · the mesh, over whatever earlier layers put down, or into a cleared buffer when
    // the ripple follows (it blends, so last frame's contents would accumulate).
    P.mesh.ready();
    buildMesh(F);
    const mesh = layer?.fx?.mesh?.length === 9 ? layer.fx.mesh : DEFAULT_MESH;
    const tan = layer?.fx?.tan?.length === 36 ? layer.fx.tan : DEFAULT_TAN;
    mesh.forEach((p, i) => { pins[i * 2] = p[0]; pins[i * 2 + 1] = p[1]; });
    tan.forEach((p, i) => { tans[i * 2] = p[0]; tans[i * 2 + 1] = p[1]; });
    gl.useProgram(P.mesh.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, ripple ? C.fbo : target ? target.fbo : null);
    gl.viewport(0, 0, W, H);
    if (ripple) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform2fv(P.mesh.loc('uPin'), pins);
    gl.uniform2fv(P.mesh.loc('uTan'), tans);
    gl.uniform2f(P.mesh.loc('uRefO'), F.ox / W, F.oy / H);
    gl.uniform2f(P.mesh.loc('uRefS'), F.w / W, F.h / H);
    gl.uniform1f(P.mesh.loc('uOpacity'), ripple ? 1 : opacity);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, A.tex);
    gl.uniform1i(P.mesh.loc('uTex'), 0);
    gl.bindVertexArray(meshVao);
    gl.drawArrays(gl.TRIANGLES, 0, meshCount);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    if (ripple) {
      if (stage === 'mesh') return blit(C);
      rippleOnto(C, v, F, canvas, opacity, target);
    }
  }

  /**
   * 6 · the finished layer onto the canvas, bent by the ripple. Its rings are measured on
   * the document's canvas (buffer px: its shorter side at the frame's scale), so a document
   * drawn larger than authored has larger rings, as a picture of Creative Lab's would.
   */
  function rippleOnto(src, v, F, canvas, opacity, target = null) {
    const side = canvas ? Math.min(canvas[0], canvas[1]) * F.unit : Math.min(W, H);
    kit.pass(P.ripple, target, (loc, bind) => {
      bind('uTex', src.tex);
      gl.uniform2f(loc('uRes'), W, H);
      gl.uniform2f(loc('uAspect'), W / side, H / side);
      gl.uniform2f(loc('uCentre'), F.x(v.rippleX) / W, F.y(v.rippleY) / H);
      // Amount reads 0–20 like Figma's Warp, and lands on the same displacement.
      gl.uniform1f(loc('uAmp'), (v.rippleAmt * 5) / 100);
      gl.uniform1f(loc('uFreq'), v.rippleScale * 2);
      gl.uniform1f(loc('uPhase'), v.ripplePhase / 100);
      gl.uniform1f(loc('uOpacity'), opacity);
    }, { blend: true });
  }

  /** The layer's gradient into the bar's uniforms; returns the stop count. */
  function packGradient(stops) {
    const g = (stops?.length ? stops : [{ position: 0, color: { r: 1, g: 1, b: 1 } }]).slice(0, MAX_STOPS);
    g.forEach((s, i) => {
      gradP[i] = s.position;
      gradC.set([s.color.r, s.color.g, s.color.b, 1], i * 4);
    });
    return g.length;
  }

  /** Colorama's cycle (an override first, then the layer's, then the default); returns the stop count. */
  function packCycle(override, cycle) {
    const ramp = normaliseRamp(override);
    let rows = ramp ? ramp.map((s) => [s.p, ...s.c]) : cycle?.length >= 2 ? cycle : DEFAULT_CYCLE;
    rows = rows.slice(0, MAX_STOPS);
    if (rows.length === 1) rows = [rows[0], rows[0]];
    rows.forEach((r, i) => {
      cycP[i] = r[0];
      cycC.set([r[1], r[2], r[3], 1], i * 4);
    });
    return rows.length;
  }

  function blit(rt) {
    kit.pass(P.blit, null, (loc, bind) => {
      bind('uTex', rt.tex);
      gl.uniform2f(loc('uRes'), W, H);
    });
  }

  function dispose() {
    for (const rt of [A, B, C]) rt?.dispose();
    if (meshVao) gl.deleteVertexArray(meshVao);
    if (meshVbo) gl.deleteBuffer(meshVbo);
    if (shared) return;
    for (const p of Object.values(P)) gl.deleteProgram(p.p);
  }

  return { resize, render, dispose, fork: () => createWaveEffect(kit, { P }) };
}
