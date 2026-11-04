// Thermal: type, softened, coloured by a drifting cyclic ramp, shown only in a zone
// around itself.
//
// Adapted from Creative Lab's Thermal effect (motion/…/reference/source/effect-thermal.js
// and shaders-thermal.js, identical in meaning to the copy inlined in 06), itself lifted
// from the author's Shader Lab. Unlike Pattern refraction, the handoff puts no constraint
// on reusing this code, so the passes, the constants and the font are theirs. What
// changed is the plumbing: this engine's conventions (canvas pixels y down, the fitted
// reference frame, one full-screen triangle per pass, targets allocated on first use)
// instead of their player's.
//
//   1 source    the string, repeated down the frame, rasterised by Canvas2D: only its
//               ALPHA is read (coverage)
//   2 pyramid   level 0 is the type with the Softness blur in it; levels 1–4 each a blur
//               of the one before at half the size (only built when a pin blurs)
//   3 field     which level each pixel reads, an inverse-distance blend of four pins
//   4 matte     the same type stroked wider (Grow) and blurred (Mask Blur), as alpha
//   5 ramp      coverage at the chosen level onto a cyclic ramp (`fx.cycle`):
//               coverage × Cycles + Phase − Drift × t, times the matte
//
// The source, the pyramid and the matte are built once and rebuilt only when the text,
// the layout or the canvas changes; a frame is the one final pass.
//
// The text is the document's (`fx.text`) unless the page gives its own (`text`: the
// user's number). A longer one is drawn smaller, so it takes no more room across than
// the document's own did (its size and line gap scale together, in the same font).
// Drift is a rate: it runs on the entry's own clock (`clock`), never wrapping with the
// document, so the colour never jumps however long the page shows.

/** Parameter defaults, for documents that leave a parameter out (Creative Lab's). */
export const DEFAULTS = {
  mask: 0, maskGrow: 1, maskBlur: 2, maskShow: 0,
  cycles: 1.6, speed: 0.3, phase: 0,
  amount: 0.5, blend: 3.4, showMap: 0,
  pin0V: 1, pin1V: 1, pin2V: 0, pin3V: 0,
  soft: 1.2,
  textSize: 27, rows: 4, lineGap: 31, textX: 50, textY: 50, tracking: 0,
};

/** The pipeline, in order, for the rig's stage viewer. */
export const STAGES = [
  { id: 'text', label: '1 · Source', note: 'The string rasterised by Canvas2D. Only its alpha (coverage) is read.' },
  { id: 'lv0', label: '2 · Pyramid level 0', note: 'The type with the Softness blur in it.' },
  { id: 'lv2', label: '3 · Pyramid level 2', note: 'Two halvings down: the blur radius doubles per level.' },
  { id: 'lv4', label: '4 · Pyramid level 4', note: 'The softest level. Built only when a pin is set to Blurred.' },
  { id: 'field', label: '5 · Blur field', note: 'Which level each pixel reads, from the four pins (black where every pin is Sharp).' },
  { id: 'matte', label: '6 · Mask', note: 'The type stroked wider and blurred: where the effect exists at all.' },
  { id: 'ramp', label: '7 · Colour ramp (final)', note: '' },
];

/** Creative Lab's typeface for the type: Helvetica Neue where the system has it. */
export const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const WEIGHT = 900;
const LEVELS = 5;
const PINS = 4;
const MAX_STOPS = 8;
// The ramp and the pins when a layer brings none: Creative Lab's defaults (the fire ramp).
const DEFAULT_CYCLE = [[0.0, 0.039, 0.016, 0.0], [0.1, 0.541, 0.118, 0.0], [0.3, 0.878, 0.282, 0.0], [0.5, 1.0, 0.478, 0.071], [0.62, 1.0, 0.706, 0.306], [0.72, 1.0, 0.949, 0.839], [0.84, 0.941, 0.533, 0.118], [0.96, 0.322, 0.071, 0.0]];
const DEFAULT_PINS = [[0.13, 0.51], [0.9, 0.5], [0.5, 0.3], [0.5, 0.84]];
const DEFAULT_TEXT = '40,400';

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

// ── a separable Gaussian, for the Softness blur, the pyramid and the matte ─────────
// The tap count is fixed and spread over 3 sigma, so a large radius is preceded by a
// small one (see blurInto) or a hard edge convolves into a staircase.
const FS_BLUR = HEADER + `
uniform sampler2D uTex;
uniform float uSigma;      // pixels of the target
uniform int uVertical;
const int TAPS = 24;
void main() {
  vec2 uv = fbuv(canvasUv());
  if (uSigma < 0.35) { frag = texture(uTex, uv); return; }
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

// ── the final pass: the pins pick a level, the coverage there indexes the ramp ─────
const FS_THERMAL = HEADER + `
uniform sampler2D uL0, uL1, uL2, uL3, uL4, uMask;
uniform vec2 uPin[4];
uniform float uPinV[4];
uniform float uBlend, uAmt, uCycles, uPhase, uOpacity;
uniform vec4 uFrame;       // the reference frame on the canvas: origin and size, uv
uniform int uUseMask, uShow;   // uShow: 0 the effect, 1 the blur field, 2 the matte
uniform vec4 uCycC[8];
uniform float uCycP[8];
uniform int uCycN;

// The ramp is a wheel: the last stop runs back into the first, so the drift never
// snaps however far the phase travels.
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

// How much to blur here: an inverse-distance weighted average of the pins' values,
// laid out on the reference frame (x scaled by its aspect). uBlend is the fall-off.
float field(vec2 p) {
  float aspect = uFrame.z / uFrame.w * uRes.x / uRes.y;
  vec2 q = vec2(p.x * aspect, p.y);
  float num = 0.0, den = 0.0;
  for (int i = 0; i < 4; i++) {
    float w = 1.0 / (pow(distance(q, vec2(uPin[i].x * aspect, uPin[i].y)), uBlend) + 1e-3);
    num += w * uPinV[i];
    den += w;
  }
  return num / den;
}

void main() {
  vec2 uv = canvasUv();
  float m = field((uv - uFrame.xy) / uFrame.zw);
  if (uShow == 1) { frag = vec4(vec3(m), 1.0); return; }
  vec2 tc = fbuv(uv);
  float L = clamp(m * uAmt * 4.0, 0.0, 4.0);
  float c;
  if (L <= 0.0) c = texture(uL0, tc).a;
  else if (L < 1.0) c = mix(texture(uL0, tc).a, texture(uL1, tc).a, L);
  else if (L < 2.0) c = mix(texture(uL1, tc).a, texture(uL2, tc).a, L - 1.0);
  else if (L < 3.0) c = mix(texture(uL2, tc).a, texture(uL3, tc).a, L - 2.0);
  else c = mix(texture(uL3, tc).a, texture(uL4, tc).a, L - 3.0);
  // Unmasked, coverage 0 lands on the ramp too and the whole field takes its colour;
  // the matte confines the effect to a zone around the type.
  float a = uUseMask == 1 ? clamp(texture(uMask, tc).a, 0.0, 1.0) : 1.0;
  if (uShow == 2) { frag = vec4(vec3(a), 1.0); return; }
  a *= uOpacity;
  frag = vec4(cycleAt(c * uCycles + uPhase) * a, a);
}`;

// The stage viewer's window onto one buffer's coverage, opaque.
const FS_BLIT = HEADER + `
uniform sampler2D uTex;
void main() { frag = vec4(vec3(texture(uTex, fbuv(canvasUv())).a), 1.0); }`;

export function createThermalEffect(kit) {
  const { gl } = kit;
  const P = {
    blur: kit.program(FS_BLUR, 'thermal/blur'),
    main: kit.program(FS_THERMAL, 'thermal/main'),
    blit: kit.program(FS_BLIT, 'thermal/blit'),
  };
  const cycC = new Float32Array(MAX_STOPS * 4), cycP = new Float32Array(MAX_STOPS);
  const pins = new Float32Array(PINS * 2), pinV = new Float32Array(PINS);
  let W = 0, H = 0, wanted = [0, 0];
  let lv = [], tmp = [], mk = null, mkT = null, srcTex = null, maskTex = null, raster = null;
  let pyramidKey = '', levels = 0, maskKey = '';

  // Targets follow the canvas but are only allocated when a layer is drawn.
  function resize(w, h) {
    wanted = [w, h];
  }
  function allocate() {
    const [w, h] = wanted;
    if (w === W && h === H && lv.length) return;
    W = w; H = h;
    for (const rt of [...lv, ...tmp, mk, mkT]) rt?.dispose();
    lv = []; tmp = [];
    let lw = w, lh = h;
    for (let i = 0; i < LEVELS; i++) {
      lw = Math.max(2, lw); lh = Math.max(2, lh);
      lv.push(kit.target(lw, lh));
      tmp.push(kit.target(lw, lh));
      lw >>= 1; lh >>= 1;
    }
    // The matte is one long soft ramp: 8 bits of it visibly step once the blur is large.
    mk = kit.target(w, h, { float: true });
    mkT = kit.target(w, h, { float: true });
    pyramidKey = ''; maskKey = ''; levels = 0;
  }

  /** The layout of the type on the frame: font size and line gap in buffer pixels, the scale a longer text needs. */
  function layout(v, F, text, own) {
    const ctx = canvas2d();
    const size = (v.textSize / 100) * F.S;
    // A text longer than the document's own is drawn smaller, to take no more room.
    const k = text === own ? 1 : Math.min(1, measure(ctx, own, size, v.tracking) / Math.max(1e-6, measure(ctx, text, size, v.tracking)));
    return { size: size * k, gap: (v.lineGap / 100) * F.S * k, k };
  }

  function canvas2d() {
    // An element, not an OffscreenCanvas: iOS 16's web views before 16.4 have none.
    if (!raster) raster = typeof document === 'object' ? document.createElement('canvas') : new OffscreenCanvas(2, 2);
    return raster.getContext('2d');
  }

  function measure(ctx, text, size, tracking) {
    font(ctx, size, tracking);
    return ctx.measureText(text).width;
  }

  function font(ctx, size, tracking) {
    ctx.font = `${WEIGHT} ${size}px ${FONT}`;
    // letterSpacing is not in every engine; without it the type keeps its own tracking.
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${((tracking / 100) * size).toFixed(2)}px`;
  }

  /**
   * The string, repeated down the frame, white on transparent (alpha is coverage), into
   * `tex`. `grow` strokes it that many pixels wider (the matte): growing the letterforms
   * keeps the counters and the comma, where dilating a bitmap would smear them.
   */
  function drawText(tex, v, F, text, lay, grow = 0) {
    const ctx = canvas2d();
    if (raster.width !== W || raster.height !== H) { raster.width = W; raster.height = H; }
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1e-3, grow * 2);
    ctx.lineJoin = 'round';     // no spike on the comma
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    font(ctx, lay.size, v.tracking);
    const rows = Math.max(1, Math.round(v.rows));
    const x = F.x(v.textX), first = F.y(v.textY) - (lay.gap * (rows - 1)) / 2;
    for (let i = 0; i < rows; i++) {
      if (grow > 0) ctx.strokeText(text, x, first + i * lay.gap);
      ctx.fillText(text, x, first + i * lay.gap);
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    kit.upload(tex, raster);
  }

  /** One separable Gaussian of `sigma` target pixels, in two stages (radii compose as sqrt(s1² + s2²)). */
  function blurInto(dst, scratch, src, sigma) {
    const s1 = sigma > 0 ? Math.min(sigma, Math.max(1.2, sigma / 8)) : 0;
    const s2 = Math.sqrt(Math.max(0, sigma * sigma - s1 * s1));
    for (const [to, from, vertical, s] of [[scratch, src, 0, s1], [dst, scratch.tex, 1, s1], [scratch, dst.tex, 0, s2], [dst, scratch.tex, 1, s2]]) {
      kit.pass(P.blur, to, (loc, bind) => {
        bind('uTex', from);
        gl.uniform2f(loc('uRes'), to.w, to.h);
        gl.uniform1f(loc('uSigma'), s);
        gl.uniform1i(loc('uVertical'), vertical);
      });
    }
  }

  const geometry = (F) => [F.width, F.height, F.ox, F.oy, F.w, F.h].map((n) => n.toFixed(3)).join(',');

  /** The source and level 0 (and the coarser levels up to `need`), rebuilt when the text, the layout or the canvas changes. */
  function ensurePyramid(v, F, text, lay, need) {
    const key = [text, lay.size, lay.gap, v.rows, v.textX, v.textY, v.tracking, v.soft, W, H, geometry(F)].join('|');
    if (key !== pyramidKey) {
      pyramidKey = key;
      levels = 0;
      srcTex ??= kit.texture();
      drawText(srcTex, v, F, text, lay);
      blurInto(lv[0], tmp[0], srcTex, (v.soft / 100) * F.S);
      levels = 1;
    }
    for (; levels <= need; levels++) blurInto(lv[levels], tmp[levels], lv[levels - 1].tex, 2.2);
  }

  /** The matte: the type stroked wider and blurred. Its own key, so dialling Grow keeps the pyramid. */
  function ensureMask(v, F, text, lay) {
    const key = [text, lay.size, lay.gap, v.rows, v.textX, v.textY, v.tracking, v.maskGrow, v.maskBlur, W, H, geometry(F)].join('|');
    if (key === maskKey) return;
    maskKey = key;
    maskTex ??= kit.texture();
    drawText(maskTex, v, F, text, lay, (v.maskGrow / 100) * F.S);
    blurInto(mk, mkT, maskTex, (v.maskBlur / 100) * F.S);
  }

  /**
   * Draw one layer over whatever is on the canvas, premultiplied.
   * @param {object} values  the layer's parameters at this moment
   * @param {object} o       {F: fitted frame, layer: for `fx`, text: the page's own
   *   text over the document's, clock: the entry's own unbounded time (Drift is a rate),
   *   stage, opacity: the whole layer's, target: where to draw (the canvas by default)}
   */
  function render(values, { F, layer = null, text = null, clock = 0, stage = null, opacity = 1, target = null }) {
    allocate();
    const v = { ...DEFAULTS, ...values };
    const own = typeof layer?.fx?.text === 'string' ? layer.fx.text : DEFAULT_TEXT;
    const shown = typeof text === 'string' && text ? text : own;
    const lay = layout(v, F, shown, own);
    const pinRows = layer?.fx?.pins?.length === PINS ? layer.fx.pins : DEFAULT_PINS;
    const blurred = pinRows.map((_, i) => (Math.round(v[`pin${i}V`]) === 1 ? 1 : 0));
    // The coarser levels only matter where a pin blurs (all of 06's are Sharp).
    const reach = Math.min(LEVELS - 1, Math.ceil(Math.max(...blurred) * v.amount * 4));
    const need = stage === 'lv2' ? Math.max(reach, 2) : stage === 'lv4' ? LEVELS - 1 : reach;
    ensurePyramid(v, F, shown, lay, need);
    const showMask = Math.round(v.maskShow) === 1 || stage === 'matte';
    const useMask = Math.round(v.mask) === 1 || showMask;
    if (useMask) ensureMask(v, F, shown, lay);

    if (stage === 'text') return blit(srcTex);
    if (stage === 'lv0') return blit(lv[0].tex);
    if (stage === 'lv2') return blit(lv[2].tex);
    if (stage === 'lv4') return blit(lv[LEVELS - 1].tex);

    const n = packCycle(layer?.fx?.cycle);
    pinRows.forEach((p, i) => { pins[i * 2] = p[0]; pins[i * 2 + 1] = p[1]; pinV[i] = blurred[i]; });
    const show = stage === 'field' || Math.round(v.showMap) === 1 ? 1 : showMask ? 2 : 0;
    kit.pass(P.main, target, (loc, bind) => {
      for (let i = 0; i < LEVELS; i++) bind(`uL${i}`, lv[Math.min(i, levels - 1)].tex);
      // Bound even when unused: a sampler left pointing at nothing is a warning on some drivers.
      bind('uMask', useMask ? mk.tex : lv[0].tex);
      gl.uniform2f(loc('uRes'), W, H);
      gl.uniform4f(loc('uFrame'), F.ox / W, F.oy / H, F.w / W, F.h / H);
      gl.uniform2fv(loc('uPin'), pins);
      gl.uniform1fv(loc('uPinV'), pinV);
      gl.uniform1f(loc('uBlend'), v.blend);
      gl.uniform1f(loc('uAmt'), v.amount);
      gl.uniform1f(loc('uCycles'), v.cycles);
      gl.uniform1f(loc('uPhase'), v.phase / 100 - v.speed * clock);
      gl.uniform1i(loc('uUseMask'), useMask ? 1 : 0);
      gl.uniform1i(loc('uShow'), show);
      gl.uniform1f(loc('uOpacity'), show ? 1 : opacity);
      gl.uniform4fv(loc('uCycC'), cycC);
      gl.uniform1fv(loc('uCycP'), cycP);
      gl.uniform1i(loc('uCycN'), n);
    }, { blend: !show });
  }

  /** The layer's cycle (or the default) into the final pass's uniforms; returns the stop count. */
  function packCycle(cycle) {
    let rows = cycle?.length >= 2 ? cycle : DEFAULT_CYCLE;
    rows = rows.slice(0, MAX_STOPS);
    rows.forEach((r, i) => {
      cycP[i] = r[0];
      cycC.set([r[1], r[2], r[3], 1], i * 4);
    });
    return rows.length;
  }

  function blit(tex) {
    kit.pass(P.blit, null, (loc, bind) => {
      bind('uTex', tex);
      gl.uniform2f(loc('uRes'), W, H);
    });
  }

  function dispose() {
    for (const rt of [...lv, ...tmp, mk, mkT]) rt?.dispose();
    for (const t of [srcTex, maskTex]) if (t) gl.deleteTexture(t);
    for (const p of Object.values(P)) gl.deleteProgram(p.p);
  }

  return { resize, render, dispose };
}
