// The backdrop: one WebGL2 canvas under the DOM, for the whole session.
//
// It plays one motion document at a time, or a stack of them on one clock (the intro's
// rings over the sphere they open onto). Changing page swaps the documents and their
// colour ramp, not the context: creating a context costs hundreds of milliseconds and
// a black frame, a document swap costs a few uniform writes. Render targets are
// allocated the first time an effect is drawn.
//
// Time is the document's own clock, in seconds. A frame is a pure function of that
// time (`renderAt(5)` draws the same picture however 5 s was reached), and playback
// only decides which times get drawn: at each document's cadence (`playbackFps`), on
// whole display intervals, so a 30 fps document draws every other vsync at 60 Hz and
// every fourth at 120 Hz instead of an uneven stagger. What decides is what shows: an
// entry not started yet, faded out or placed on nothing draws nothing and asks for no
// frames, and with nothing showing the canvas holds its last frame. An entry in a box of
// its own keeps what it drew between its frames, and is only put where its box is now,
// so a box on something that moves (a summary card) follows it every display frame
// while what is in it changes at its document's cadence.

import { createGL } from './gl.js';
import { createPatternEffect } from './pattern.js';
import { createWaveEffect } from './wave.js';
import { createThermalEffect } from './thermal.js';
import { loadDocument, documentTime, fadeLevel, holdTime, screenAt, scrubTime, sizeLevel, valuesAt } from './document.js';
import { fitFrame, placeFrame } from './frame.js';

const FS_SOLID = `#version 300 es
precision mediump float;
uniform vec4 uColor;
out vec4 frag;
void main() { frag = uColor; }`;

// A layer drawn in its own box (a shader on a Figma layer): the part of the box that
// was drawn, put on the canvas where the box is, turned with it.
const FS_PLACE = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uRes;
uniform vec2 uCentre;
uniform vec2 uHalf;
uniform vec2 uRot;
uniform vec4 uWin;
uniform bool uClip;
uniform float uRadius;
uniform vec4 uOuter;
uniform float uOuterRadius;
out vec4 frag;
// Signed distance to a box of half-size h with corners rounded by r, from its centre.
float roundBox(vec2 p, vec2 h, float r) {
  vec2 d = abs(p) - h + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}
void main() {
  vec2 c = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 p = c - uCentre;
  vec2 q = vec2(uRot.x * p.x + uRot.y * p.y, -uRot.y * p.x + uRot.x * p.y) + uHalf;
  vec2 w = (q - uWin.xy) / uWin.zw;
  if (any(lessThan(w, vec2(0.0))) || any(greaterThan(w, vec2(1.0)))) { frag = vec4(0.0); return; }
  // Clipped at the box's edge (its corners rounded by uRadius), anti-aliased over a pixel
  // (it can be turned), and within an outer box on the canvas when there is one (what it
  // is drawn on: a summary card's bubble, clipped to its card).
  float keep = uClip ? clamp(0.5 - roundBox(q - uHalf, uHalf, uRadius), 0.0, 1.0) : 1.0;
  if (uOuter.z > 0.0) keep *= clamp(0.5 - roundBox(c - uOuter.xy, uOuter.zw, uOuterRadius), 0.0, 1.0);
  frag = texture(uSrc, vec2(w.x, 1.0 - w.y)) * keep;
}`;

/**
 * Around the part of a box that shows, how much more of it is drawn (authored px), so
 * that what shows can refract from what does not.
 */
const BOX_MARGIN = 160;

/**
 * Past a clipped box's edge, how much is drawn (authored px), empty: the edge blur
 * reaches that far (fx/pattern.js), and reads the empty side there, so what meets the
 * edge is rounded off by it, as Figma's are, rather than cut.
 */
const EDGE_MARGIN = 32;

/**
 * Between its own frames, how far a box can have grown or shrunk (a share of its size)
 * for what was drawn into it to be put again, scaled: a box resizing with what it is
 * placed on (the top month's bubbles) follows it every display frame.
 */
const MAX_RESCALE = 0.1;

/** Effects this build can draw. Layers naming any other effect are skipped. */
export const SUPPORTED_EFFECTS = ['pattern-refraction', 'wave', 'thermal'];

export function supportsWebGL2() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

/**
 * @param {HTMLCanvasElement} canvas  sized by CSS; the buffer follows it
 * @param {object} [options]
 * @param {number} [options.resolution=1]  buffer pixels per CSS pixel. These are soft
 *   images: rendering near 1× and letting the compositor scale is the cheapest large
 *   saving there is (cost is linear in pixels), and very hard to see.
 * @param {number} [options.samples=3]  supersampling per axis, capped by the document's
 *   own setting. Cost grows with its square.
 * @param {number} [options.fps]  cadence override; 0 follows the display.
 * @param {number} [options.maxFps]  a ceiling on every cadence (the degrade ladder's); 0 none.
 * @param {[number, number]} [options.size]  a fixed buffer size instead of the canvas's
 *   CSS size times `resolution`.
 * @param {boolean} [options.authored]  lay the frame out as the document's own preview
 *   canvas did (1:1, cropped) instead of fitting it whole: the rig, to compare.
 * @param {boolean} [options.still]  draw one frame per document and never animate
 *   (reduced motion).
 * @param {(e: Error) => void} [options.onError]
 * @param {(msg: string) => void} [options.onWarning]
 */
export function createBackdrop(canvas, options = {}) {
  const opts = { resolution: 1, samples: 3, fps: undefined, still: false, ...options };
  const onError = opts.onError || ((e) => console.error(e));
  const onWarning = opts.onWarning || (() => {});
  const warned = new Set();
  let kit = null, effects = null, solid = null, placer = null;
  // Boxed entries' own targets and Pattern instances, by stack index, and what was last
  // drawn into each (`drawn`: the entry, its scale and the part of its box).
  const boxes = new Map();
  // What is showing: documents bottom first, each with when it starts on the shared
  // clock (`delay`), how its time runs (`hold`, `once`) and how it is framed.
  let stack = [], doc = null, ramp = null, ground = null, stage = null;
  let lost = false, destroyed = false;
  let playing = false, raf = 0, hidden = document.hidden;
  // The document clock: `base` seconds, plus wall time since `since` while playing and
  // visible.
  let base = 0, since = 0;
  let lastTick = 0, interval = 0;
  // Each cadence's beat: when its entries last drew (ms, by frame interval).
  const beats = new Map();
  let lastT = 0;
  // Which entries showed in the last frame drawn (their stack indices).
  let lastShown = '';
  const drawn = [];
  let cpuMs = 0;
  // The canvas's CSS size, kept by a ResizeObserver (below): read from layout at every
  // frame, it would force a layout whenever the DOM had changed since the last.
  let cssSize = null;

  function build() {
    kit = createGL(canvas);
    if (!kit) throw new Error('WebGL2 is not available');
    // The effects' programs are checked as they are first drawn (gl.js); these two small
    // ones now, so a context that cannot draw at all is no backdrop rather than an empty
    // one. First, so that waits on them alone, not on the effects' compiling after them.
    solid = kit.program(FS_SOLID, 'solid');
    placer = kit.program(FS_PLACE, 'place');
    solid.ready();
    placer.ready();
    effects = { 'pattern-refraction': createPatternEffect(kit), wave: createWaveEffect(kit), thermal: createThermalEffect(kit) };
    // Sent now, so the GPU compiles them while the intro's logo shows, before anything draws.
    kit.gl.flush();
    boxes.clear();
  }

  try {
    build();
  } catch (e) {
    onError(e);
    const none = () => {};
    return { ok: false, canvas, show: none, setRamp: none, redraw: none, renderAt: none, play: none, pause: none, playing: () => false, time: () => 0, clock: () => 0, motionTime: () => null, document: () => null, setQuality: none, setStage: none, stats: () => null, finish: none, destroy: none };
  }

  const onLost = (e) => {
    e.preventDefault();
    lost = true;
    cancelAnimationFrame(raf);
  };
  const onRestored = () => {
    lost = false;
    try {
      build();
    } catch (e) {
      onError(e);
      return;
    }
    if (playing) loop(); else if (doc) draw(lastT);
  };
  const sizer = typeof ResizeObserver === 'function' ? new ResizeObserver(([e]) => {
    const box = e.contentBoxSize?.[0];
    cssSize = box ? [box.inlineSize, box.blockSize] : [e.contentRect.width, e.contentRect.height];
  }) : null;
  sizer?.observe(canvas);
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  // A hidden page draws nothing; the clock stops too, so it resumes where it left off.
  // `hidden` is tracked here rather than read from the document: by the time the event
  // fires the document already says hidden, and the time until then would be lost.
  const onVisibility = () => {
    if (document.hidden === hidden) return;
    if (playing && document.hidden) {
      base = clock();
      cancelAnimationFrame(raf);
    }
    hidden = document.hidden;
    if (playing && !hidden) {
      since = performance.now();
      invalidate();
      loop();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  /** Playback time to an entry's document time, before the document's own loop. */
  function timeline(e, t) {
    if (e.scrub) return Math.min(scrubTime(e.scrub, t), e.doc.duration - 1e-3);
    if (e.hold) return holdTime(t, e.hold);
    // Just short of the end: at exactly `duration` a looping document is back at zero.
    return e.once ? Math.min(t, e.doc.duration - 1e-3) : t;
  }

  function clock() {
    return playing && !hidden ? base + (performance.now() - since) / 1000 : base;
  }

  /**
   * The canvas's CSS size, in whole pixels as clientWidth has it: as last observed, or
   * from layout while there is none (hidden until now).
   */
  function cssWidthHeight() {
    return cssSize?.[0] > 0 && cssSize[1] > 0 ? cssSize.map(Math.round) : [canvas.clientWidth, canvas.clientHeight];
  }

  /** Match the buffer to the canvas's CSS size. */
  function fit() {
    let w, h;
    if (opts.size) [w, h] = opts.size.map((n) => Math.max(2, Math.round(n)));
    else {
      const [cssW, cssH] = cssWidthHeight();
      const cw = cssW || canvas.width, ch = cssH || canvas.height;
      w = Math.max(2, Math.round(cw * opts.resolution));
      h = Math.max(2, Math.round(ch * opts.resolution));
    }
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    for (const e of Object.values(effects)) e.resize(w, h);
    return [w, h];
  }

  /**
   * An entry at playback time `t`: its own time, opacity and size, or null when it draws
   * nothing (not started, faded out, placed on nothing, or in a box of no size). One placed
   * on something that moves is placed where that is now.
   */
  function moment(e, t) {
    // A still (Reduced Motion) shows each document at its own still moment.
    if (!opts.still && t < e.delay) return null;   // not started yet
    // Placed on something that moves (a summary card on its carousel): where it is now.
    if (e.track) e.place = validPlace(e.track());
    if (e.track && !e.place) return null;
    const at = opts.still ? e.stillAt ?? stillTime(e.doc) : t - e.delay + e.from;
    const opacity = fadeLevel(e.fade, at);
    // A placed entry resizing with what it is placed on (its `size`); a still is whole.
    const k = opts.still ? 1 : sizeLevel(e.size, at);
    // A canvas that covers the screen is drawn whole in a box of its own (see draw).
    const boxed = !opts.authored && (e.cover || Boolean(e.place?.box));
    return opacity > 0 && (!boxed || k > 0) ? { at, opacity, k, boxed } : null;
  }

  /** A cadence (frames a second, 0 the display's) held to `maxFps`, the ladder's cap: a slower one stays. */
  function cappedFps(fps) {
    return opts.maxFps > 0 ? (fps > 0 ? Math.min(fps, opts.maxFps) : opts.maxFps) : fps;
  }

  /** An entry's frame interval (ms), from its document's cadence or the override; 0 is every display frame. */
  function capOf(e) {
    const fps = cappedFps(opts.fps ?? e.doc.playbackFps ?? 0);
    return fps > 0 ? 1000 / fps : 0;
  }

  /**
   * The frame intervals (see `capOf`) due a frame at `now` (ms), among the entries showing.
   * Every entry of one cadence draws on that cadence's beat, so entries that started on
   * different frames (the top month's bubbles, one after another) still draw on the same
   * ones, not on alternate frames each.
   */
  function beatsDue(now, shown) {
    const caps = new Set();
    for (const [i, e] of stack.entries()) {
      const cap = shown[i] ? capOf(e) : null;
      if (cap == null || caps.has(cap)) continue;
      // A cap can only land on whole display intervals, so "due" means "the next vsync
      // would overshoot it": allow half an interval of slack, measured, not assumed.
      const slack = interval ? interval / 2 : cap / 4;
      const last = beats.get(cap);
      if (!cap || !last || now - last >= cap - slack) caps.add(cap);
    }
    return caps;
  }

  /** Whether an entry is due a frame on `caps` (see `beatsDue`): on its beat, or never drawn. */
  const due = (e, caps) => !e.drawnAt || caps.has(capOf(e));

  /** Every entry drawn afresh at the next frame (what they are drawn with has changed). */
  function invalidate() {
    for (const e of stack) e.drawnAt = 0;
  }

  /**
   * Draw the moment `t`. `shown` is each entry's moment (see `moment`), when the caller has
   * them; `caps` (see `beatsDue`) puts a boxed entry that is not due a frame as it was last
   * drawn, where its box is now (otherwise each is drawn afresh); `now` is the frame's time.
   */
  function draw(t, { shown = null, caps = null, now = performance.now() } = {}) {
    if (lost || destroyed || !doc) return;
    const started = performance.now();
    lastT = t;
    shown ??= stack.map((e) => moment(e, t));
    const [w, h] = fit();
    const { gl } = kit;
    const bg = hexToRgb(ground || doc.background);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.clearColor(bg[0], bg[1], bg[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // Buffer pixels per CSS pixel, for entries placed in the page's coordinates.
    const px = w / (cssWidthHeight()[0] || w);
    for (const [i, e] of stack.entries()) {
      const m = shown[i];
      if (!m) continue;
      const { at, opacity, k } = m;
      const o = { opacity, phase: e.phase, clock: at + e.phase, ramp: e.ramp ?? ramp, drift: drifted(e, at), values: e.values, rates: e.rates, pixels: e.pixels, px, outline: e.outline, text: e.text };
      e.placedKey = placeKey(e.place);
      // A canvas that covers the screen is drawn whole in a box of its own, as Creative Lab's
      // runtime draws it (Wave's mesh and ripple read across all of it), and cut at the screen.
      if (m.boxed) {
        const place = e.cover ? coverPlace(e, w, h, px) : e.place;
        drawBoxed(i, e, place, at, o, w, h, px, k, !caps || due(e, caps) ? now : 0);
        continue;
      }
      const F = e.place && !opts.authored
        ? placeFrame(w, h, e.doc.refWidth, e.doc.refHeight, e.place.x * px, e.place.y * px, e.place.unit * px * k)
        : fitFrame(w, h, e.doc.refWidth, e.doc.refHeight, opts.authored ? e.doc.width : 0, e.fitCanvas ? [e.doc.width, e.doc.height] : null, opts.authored ? 1 : e.scale);
      const { screen, local } = screenAt(e.doc, documentTime(e.doc, timeline(e, at)));
      drawLayers(e.doc, screen, local, F, o);
      e.drawnAt = now;
    }
    lastShown = shownKey(shown);
    cpuMs = performance.now() - started;
    drawn.push(started);
    while (drawn.length && started - drawn[0] > 1000) drawn.shift();
  }

  /** How far an entry's `drift` has moved its relief at its own time `at`: [cx, cy] in % of the frame. */
  function drifted(e, at) {
    if (!e.drift || opts.still) return null;
    const s = Math.max(0, at - e.drift.since);
    return [e.drift.rate[0] * s, e.drift.rate[1] * s];
  }

  /**
   * Where a canvas that covers the screen is (`fit: 'cover'`): the document's authored
   * canvas in a box of its own, centred, as large as it takes to cover the screen (times
   * the entry's `scale`), drawn to its edge.
   */
  function coverPlace(e, w, h, px) {
    const unit = (Math.max(w / e.doc.width, h / e.doc.height) * e.scale) / px;
    return { x: w / 2 / px, y: h / 2 / px, unit, box: true, canvas: true, edge: 0 };
  }

  /**
   * A boxed entry: its frame drawn into a target of its own, as a shader draws on a
   * Figma layer (the box is what it can draw into, and reads outside it are empty), then
   * put on the canvas at its place, turned by `place.rotate` degrees (clockwise, as CSS
   * turns), at `k` of its placed size. Only the part of the box that can reach the canvas
   * is drawn, unless the box is the document's authored canvas (`place.canvas`, a canvas
   * that covers the screen): that is drawn whole, its frame in its middle, as Creative
   * Lab's runtime draws it.
   *
   * `refresh` (ms, the frame's time) draws the box afresh; 0 puts what was drawn into it
   * last where the box is now, as long as that is the same entry, at about the same scale,
   * and covers all of the box that can show now.
   */
  function drawBoxed(i, e, place, at, o, w, h, px, k, refresh) {
    const { gl } = kit;
    const unit = place.unit * px * k;
    const Bw = (place.canvas ? e.doc.width : e.doc.refWidth) * unit, Bh = (place.canvas ? e.doc.height : e.doc.refHeight) * unit;
    const cx = place.x * px, cy = place.y * px;
    const th = ((Number(place.rotate) || 0) * Math.PI) / 180, cos = Math.cos(th), sin = Math.sin(th);
    const inBox = ([x, y]) => [cos * (x - cx) + sin * (y - cy) + Bw / 2, -sin * (x - cx) + cos * (y - cy) + Bh / 2];
    const corners = [[0, 0], [w, 0], [0, h], [w, h]].map(inBox);
    const m = place.canvas ? Infinity : (Number.isFinite(place.margin) ? place.margin : BOX_MARGIN) * unit;
    // Clipped to the box, as Figma clips a layer's shader (drawn a little past it, empty,
    // for the edge blur), unless `clip: false` lets it spill out as far as the margin
    // (`place.margin` authored px, BOX_MARGIN by default).
    const clip = place.clip !== false;
    const spill = clip ? (Number.isFinite(place.edge) ? place.edge : EDGE_MARGIN) * unit : m;
    const x0 = Math.max(-spill, Math.floor(Math.min(...corners.map((q) => q[0])) - m));
    const y0 = Math.max(-spill, Math.floor(Math.min(...corners.map((q) => q[1])) - m));
    const x1 = Math.min(Math.ceil(Bw + spill), Math.ceil(Math.max(...corners.map((q) => q[0])) + m));
    const y1 = Math.min(Math.ceil(Bh + spill), Math.ceil(Math.max(...corners.map((q) => q[1])) + m));
    if (x1 - x0 < 1 || y1 - y0 < 1) return;
    let box = boxes.get(i);
    if (!box) boxes.set(i, (box = { fx: {}, rt: null, drawn: null }));
    // What was drawn into the box last, in its own pixels at its own scale (`unit`): the
    // part of the box it holds, now `r` times as large.
    const was = box.drawn;
    const r = was ? was.unit / unit : 1;
    const keep = !refresh && was?.entry === e && Math.abs(r - 1) < MAX_RESCALE
      && x0 * r >= was.x0 && y0 * r >= was.y0 && x1 * r <= was.x1 && y1 * r <= was.y1;
    if (!keep) {
      const bw = x1 - x0, bh = y1 - y0;
      const { screen, local } = screenAt(e.doc, documentTime(e.doc, timeline(e, at)));
      // An instance of each effect its layers use (Pattern's bubbles, Wave's cards), with
      // targets of the box's size.
      for (const L of screen.layers) if (L.type === 'effect' && !box.fx[L.effect] && effects[L.effect]?.fork) box.fx[L.effect] = effects[L.effect].fork();
      if (!box.rt || box.rt.w !== bw || box.rt.h !== bh) { box.rt?.dispose(); box.rt = kit.target(bw, bh); }
      for (const fx of Object.values(box.fx)) fx.resize(bw, bh);
      gl.bindFramebuffer(gl.FRAMEBUFFER, box.rt.fbo);
      gl.viewport(0, 0, bw, bh);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const F = placeFrame(bw, bh, e.doc.refWidth, e.doc.refHeight, Bw / 2 - x0, Bh / 2 - y0, unit);
      drawLayers(e.doc, screen, local, F, { ...o, into: box, bounds: clip ? [-x0, -y0, Bw - x0, Bh - y0] : null });
      box.drawn = { entry: e, unit, x0, y0, x1, y1 };
      e.drawnAt = refresh || performance.now();
    }
    // The part of the box it holds, in the box's pixels now.
    const s = keep ? r : 1, d = box.drawn;
    const win = [d.x0 / s, d.y0 / s, (d.x1 - d.x0) / s, (d.y1 - d.y0) / s];
    kit.pass(placer, null, (loc, bind) => {
      bind('uSrc', box.rt.tex);
      gl.uniform2f(loc('uRes'), w, h);
      gl.uniform2f(loc('uCentre'), cx, cy);
      gl.uniform2f(loc('uHalf'), Bw / 2, Bh / 2);
      gl.uniform2f(loc('uRot'), cos, sin);
      gl.uniform4f(loc('uWin'), ...win);
      gl.uniform1i(loc('uClip'), clip ? 1 : 0);
      gl.uniform1f(loc('uRadius'), Math.min((Number(place.radius) || 0) * px, Bw / 2, Bh / 2));
      const outer = place.within;
      if (outer) {
        gl.uniform4f(loc('uOuter'), outer.x * px, outer.y * px, (outer.w / 2) * px, (outer.h / 2) * px);
        gl.uniform1f(loc('uOuterRadius'), Math.min((Number(outer.radius) || 0) * px, (outer.w / 2) * px, (outer.h / 2) * px));
      } else {
        gl.uniform4f(loc('uOuter'), 0, 0, 0, 0);
        gl.uniform1f(loc('uOuterRadius'), 0);
      }
    }, { blend: true, scissor: placedRect(win, cx, cy, Bw / 2, Bh / 2, cos, sin, place.within, px, w, h) });
  }

  /**
   * A document's layers at one moment; `into` is a boxed entry's target and Pattern
   * instance, `bounds` the box in it. `values` set parameters over the document's, and
   * `pixels` set them in CSS pixels (`px` buffer pixels each), whatever the frame's scale.
   * `rates` move parameters on from there, that much a second of `clock`, the entry's own
   * time, unwrapped (a rate's: Thermal's drift, the comparison circles' colour), and `text`
   * the type a Thermal layer draws instead of its document's.
   */
  function drawLayers(d, screen, local, F, { opacity = 1, phase = 0, clock = local + phase, ramp = null, into = null, bounds = null, drift = null, values: set = null, rates = null, pixels = null, px = 1, outline = false, text = null } = {}) {
    const { gl } = kit;
    for (const L of screen.layers) {
      if (L.type === 'solid') {
        const [r, g, b] = hexToRgb(L.color || '#000000');
        const a = (L.opacity == null ? 1 : Math.max(0, Math.min(1, L.opacity / 100))) * opacity;
        kit.pass(solid, into?.rt ?? null, (loc) => gl.uniform4f(loc('uColor'), r * a, g * a, b * a, a), { blend: true });
        continue;
      }
      if (L.type !== 'effect') continue;   // covers and type are DOM, not pixels
      const effect = into ? into.fx[L.effect] : effects[L.effect];
      if (!effect) {
        if (!warned.has(L.effect)) { warned.add(L.effect); onWarning(`backdrop: effect "${L.effect}" is not implemented yet; layer skipped`); }
        continue;
      }
      try {
        const values = valuesAt(L, local);
        if (set) Object.assign(values, set);
        if (rates) for (const [id, r] of Object.entries(rates)) values[id] = (values[id] ?? 0) + r * clock;
        if (pixels) for (const [id, v] of Object.entries(pixels)) values[id] = (v * px) / F.unit;
        if (outline && Math.round(values.shape) === 0 && Math.round(values.fxSpace) !== 1 && values.mRounding > 0 && values.shapeSize > 0) {
          const r = (values.shapeSize / 100) * Math.min(d.refWidth, d.refHeight) / 2;
          values.shapeSize *= outlineRadius(r, values.mRounding) / r;
        }
        if (drift) { values.cx = (values.cx ?? 50) + drift[0]; values.cy = (values.cy ?? 50) + drift[1]; }
        effect.render(values, {
          F,
          samples: Math.min(opts.samples, d.msaa),
          ramp: ramp || L.gradient,
          override: ramp,
          layer: L,
          canvas: [d.width, d.height],
          t: local + phase,
          clock,
          text,
          stage: into ? null : stage,
          opacity,
          target: into?.rt ?? null,
          bounds,
        });
      } catch (e) {
        // Once: the same layer fails the same way at every frame.
        if (!warned.has(e.message)) { warned.add(e.message); onError(e); }
      }
    }
  }

  /** The cadence of what shows now (frames a second, 0 the display's), or null when nothing does. */
  function cadenceNow() {
    if (opts.fps !== undefined) return cappedFps(opts.fps);
    const t = clock();
    const fps = stack.filter((e) => moment(e, t)).map((e) => e.doc.playbackFps ?? 0);
    return fps.length ? cappedFps(fps.includes(0) ? 0 : Math.max(...fps)) : null;
  }

  function loop() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }

  function tick(now) {
    if (!playing || lost || destroyed) return;
    raf = requestAnimationFrame(tick);
    // The display's own interval, measured from the frame callback itself.
    if (lastTick) {
      const dt = now - lastTick;
      if (dt > 1 && dt < 100) interval = interval ? interval * 0.9 + dt * 0.1 : dt;
    }
    lastTick = now;
    // A frame when what shows has changed, when anything showing is due one at its own
    // cadence, or when something placed on what moves has moved. Otherwise the last
    // frame holds (and with nothing showing, nothing is drawn at all).
    const t = clock();
    const shown = stack.map((e) => moment(e, t));
    const caps = beatsDue(now, shown);
    let wanted = shownKey(shown) !== lastShown;
    for (const [i, e] of stack.entries()) {
      if (wanted) break;
      if (shown[i]) wanted = due(e, caps) || (Boolean(e.track) && placeKey(e.place) !== e.placedKey);
    }
    if (!wanted) return;
    for (const cap of caps) beats.set(cap, now);
    draw(t, { shown, caps, now });
  }

  const api = {
    ok: true,
    canvas,
    /**
     * Play a document from `at` seconds (default 0). `ramp` replaces every layer's own
     * gradient (colour from cover art); `ground` replaces the document's background.
     * `hold: [a, b]` plays to b, then moves back and forth between a and b instead of
     * looping: for a document whose stretch after its entrance is meant to last while
     * the page does. `loop: false` plays it once and holds the last frame. `fit: 'canvas'`
     * fits the document's authored canvas rather than its frame (see frame.js), and
     * `fit: 'cover'` draws that canvas whole, as Creative Lab's runtime does, as large as it
     * takes to cover the screen, cut at its sides (a document shown as the P2's videos show
     * Creative Lab's export). Pass null to show only the ground.
     *
     * `next` can also be a stack, bottom first: `[{document, delay, from, hold, loop,
     * fit, scale, place, fade, drift, phase, ramp, stillAt, text}]`, every entry on the same
     * clock, each starting `delay` seconds into it, `from` seconds into its own time.
     * `scale` draws an entry smaller or larger than its fit, about the centre; `place:
     * {x, y, unit}` instead centres its frame on a point of the canvas, in CSS pixels,
     * at `unit` CSS pixels per authored pixel (a shape behind something on the page).
     * `place.box` draws the frame into a target of its own first, as a shader draws on
     * a Figma layer (reads outside the box are empty and nothing draws outside it, so
     * what meets its edge is rounded off there, unless `place.clip` is false: then it is
     * drawn `place.margin` authored px past the box, BOX_MARGIN by default; clipped, it
     * is drawn `place.edge` px past it, EDGE_MARGIN by default, 0 for a Wave, whose box is all
     * field), `place.rotate` turns the box (degrees, clockwise as CSS turns), `place.radius`
     * rounds its corners (CSS px), and `place.within: {x, y, w, h, radius}` clips it to a box
     * on the canvas as well (CSS px: a bubble cut at its card's edge). A box draws whatever
     * effect its layers use (Pattern's bubbles, Wave's cards). `place.track`, a function
     * returning a place (or null, not drawn), places the entry afresh at every frame: what it
     * is placed on moves (a summary card on its carousel). `fade: [a, b]`
     * fades it out between a and b seconds of its own time, `fade: [a, b, level]` down
     * to that opacity instead (a muted backdrop), `fade: [a, b, level, start]` from
     * `start` (`[a, b, 1, 0]` fades it in), and a fifth element eases it along a
     * cubic-bezier's four numbers. `drift: {rate: [cx, cy], since}` slides
     * its relief that many % of the frame a second from `since` seconds of its own time.
     * `phase` runs the document's free-running motion (Wave's travelling waves) that
     * many seconds ahead of its keyframes: what `motionTime()` reported for the same
     * document, less where this show starts it, carries the waves on unbroken while the
     * keyframes jump. `ramp` is the entry's own colours (the show's `ramp` is the
     * default). `stillAt` is the moment a still (Reduced Motion) shows. `values` set
     * parameters over the document's (one document shown in several places, each shaded
     * its own way), and `pixels` set them in CSS pixels whatever the entry's scale (a bevel
     * as wide on a small disc as on a large one). `rates` move parameters on at that much a
     * second of the entry's own time, never wrapped with its document's loop (a colour that
     * drifts for as long as the page shows, with no jump). `size: [a, b, start, ease]` scales a
     * placed entry from `start` at a to whole at b seconds of its own time (along a
     * cubic-bezier's four numbers, linear without), as what it is placed on resizes.
     * `outline: true` keeps a circle's silhouette on its outline whatever its Rounding (in
     * a frame's own space): the edge blur, cut at half, takes about σ²/2r off its radius,
     * which this gives back, frame by frame (a disc as wide as what it stands for).
     * `text` is the type a Thermal entry draws instead of its document's (the user's
     * number), drawn smaller if it is longer, so it takes no more room across.
     * `scrub: [a, b, from, to, ease]` runs the entry's document from `from` to `to` seconds
     * of its own time between a and b seconds of the entry's (along a cubic-bezier's four
     * numbers, linear without), and holds it at `to` from then: a document whose clock is
     * a quantity (the completion rate's, the share revealed), moved to the user's.
     */
    show(next, { ramp: r = null, ground: g = null, at = 0, hold: h = null, loop: looping = true, fit = 'frame' } = {}) {
      const entries = Array.isArray(next) ? next : next ? [{ document: next, hold: h, loop: looping, fit }] : [];
      try {
        stack = entries.map((e) => ({
          doc: loadDocument(e.document),
          delay: Math.max(0, Number(e.delay) || 0),
          from: Number(e.from) || 0,
          hold: Array.isArray(e.hold) && e.hold[1] > e.hold[0] ? e.hold : null,
          once: e.loop === false,
          fitCanvas: e.fit === 'canvas',
          cover: e.fit === 'cover',
          scale: Number(e.scale) > 0 ? Number(e.scale) : 1,
          place: validPlace(e.place),
          track: typeof e.place?.track === 'function' ? e.place.track : null,
          fade: Array.isArray(e.fade) && e.fade[1] > e.fade[0] ? [e.fade[0], e.fade[1], unit(e.fade[2], 0), unit(e.fade[3], 1), ...(isEase(e.fade[4]) ? [e.fade[4].map(Number)] : [])] : null,
          drift: e.drift && Array.isArray(e.drift.rate) ? { rate: e.drift.rate.map(Number), since: Number(e.drift.since) || 0 } : null,
          ramp: Array.isArray(e.ramp) && e.ramp.length ? e.ramp : null,
          text: typeof e.text === 'string' && e.text ? e.text : null,
          phase: Number(e.phase) || 0,
          stillAt: Number.isFinite(e.stillAt) ? e.stillAt : null,
          outline: e.outline === true,
          values: numbers(e.values),
          rates: numbers(e.rates),
          pixels: numbers(e.pixels),
          size: Array.isArray(e.size) && e.size[1] > e.size[0] && Number(e.size[2]) >= 0 ? [Number(e.size[0]), Number(e.size[1]), Number(e.size[2]), ...(isEase(e.size[3]) ? [e.size[3].map(Number)] : [])] : null,
          scrub: Array.isArray(e.scrub) && e.scrub[1] > e.scrub[0] && [e.scrub[2], e.scrub[3]].every((v) => Number.isFinite(Number(v))) ? [...e.scrub.slice(0, 4).map(Number), ...(isEase(e.scrub[4]) ? [e.scrub[4].map(Number)] : [])] : null,
        }));
      } catch (err) {
        onError(err);
        stack = [];
      }
      doc = stack[0]?.doc ?? null;
      ramp = r;
      ground = g;
      base = at;
      since = performance.now();
      if (!doc) {
        playing = false;
        cancelAnimationFrame(raf);
        return;
      }
      // Nothing moves without an effect this build can draw: draw the ground once.
      const animated = stack.some((e) => e.doc.screens.some((sc) => sc.layers.some((L) => L.type === 'effect' && effects[L.effect])));
      if (opts.still || !animated) {
        playing = false;
        // A still is each document's own still moment (see draw); one document reports it.
        if (opts.still && stack.length === 1) base = stack[0].stillAt ?? stillTime(doc);
        draw(base);
      } else {
        playing = true;
        draw(at);
        loop();
      }
    },
    /** Colour override for the current document (cover art), or null for its own. */
    setRamp(r) {
      ramp = r;
      invalidate();
      if (!playing && doc) draw(lastT);
    },
    /** Draw the moment the clock is at now, playing or not (a capture on a fake clock). */
    redraw() {
      if (doc) draw(clock());
    },
    /** Draw one moment, and hold it. */
    renderAt(t) {
      playing = false;
      cancelAnimationFrame(raf);
      base = t;
      draw(t);
    },
    play() {
      if (playing || !doc || opts.still) return;
      playing = true;
      since = performance.now();
      invalidate();
      loop();
    },
    pause() {
      base = clock();
      playing = false;
      cancelAnimationFrame(raf);
    },
    playing: () => playing,
    /** The document's own time; for a stack, the clock they share. */
    time: () => (stack.length > 1 ? clock() : stack.length ? documentTime(doc, timeline(stack[0], clock() - stack[0].delay + stack[0].from)) : 0),
    /** The clock the shown documents share, in seconds since `show`'s `at`. */
    clock: () => clock(),
    /**
     * Where a lone document's free-running motion is (its time plus `phase`), so the
     * next show of the same document can carry it on; null for a stack or nothing.
     */
    motionTime: () => (stack.length === 1 ? api.time() + stack[0].phase : null),
    document: () => doc,
    setQuality({ resolution, samples, fps, maxFps, size, authored } = {}) {
      if (resolution > 0) opts.resolution = Math.min(resolution, 4);
      if (size !== undefined) opts.size = size;
      if (authored !== undefined) opts.authored = !!authored;
      if (samples > 0) opts.samples = Math.max(1, Math.min(6, Math.round(samples)));
      if (fps !== undefined) opts.fps = fps === null ? undefined : Math.max(0, fps);
      if (maxFps !== undefined) opts.maxFps = maxFps > 0 ? maxFps : 0;
      invalidate();
      if (!playing && doc) draw(lastT);
    },
    /** The stage viewer: an intermediate buffer instead of the finished frame. */
    setStage(s) {
      stage = s || null;
      invalidate();
      if (!playing && doc) draw(lastT);
    },
    stats() {
      return {
        fps: drawn.length,
        cpuMs: +cpuMs.toFixed(2),
        displayHz: interval ? +(1000 / interval).toFixed(1) : null,
        width: canvas.width,
        height: canvas.height,
        samples: doc ? Math.min(opts.samples, doc.msaa) : opts.samples,
        cadence: cadenceNow(),
        document: stack.map((e) => e.doc.id).join(' + ') || null,
        time: +api.time().toFixed(3),
      };
    },
    /** Wait for the GPU to finish everything submitted (benchmarks only). */
    finish() {
      if (lost) return;
      const px = new Uint8Array(4);
      kit.gl.readPixels(0, 0, 1, 1, kit.gl.RGBA, kit.gl.UNSIGNED_BYTE, px);
    },
    destroy() {
      destroyed = true;
      playing = false;
      cancelAnimationFrame(raf);
      sizer?.disconnect();
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      document.removeEventListener('visibilitychange', onVisibility);
      if (lost) return;
      for (const b of boxes.values()) { b.rt?.dispose(); for (const fx of Object.values(b.fx)) fx.dispose(); }
      for (const e of Object.values(effects)) e.dispose();
    },
  };
  return api;
}

/**
 * The radius a circle needs for its silhouette (its coverage blurred by a Gaussian of
 * `s`, cut at half) to fall at `r`: the blur takes s²/2R + 0.27 s⁴/R³ off a radius R
 * (fitted to the numerical contour, to 0.05 of s down to R = 1.8 s; it scales with s).
 */
export function outlineRadius(r, s) {
  let R = (r + Math.sqrt(r * r + 2 * s * s)) / 2;
  for (let i = 0; i < 4; i++) R -= (R - (s * s) / (2 * R) - (0.27 * s ** 4) / R ** 3 - r) / (1 + (s * s) / (2 * R * R) + (0.81 * s ** 4) / R ** 4);
  return R;
}

/** The moment a still (reduced motion) shows: halfway, once entrances have settled. */
export function stillTime(doc) {
  return doc.duration / 2;
}

/** A place an entry can be drawn at ({x, y, unit, …}), or null. */
function validPlace(p) {
  return p && [p.x, p.y, p.unit].every(Number.isFinite) && p.unit > 0 ? { ...p } : null;
}

/** Where a place puts what is drawn on it, to tell when it has moved. */
function placeKey(p) {
  return p ? `${p.x},${p.y},${p.unit},${p.rotate},${p.within?.x},${p.within?.y},${p.within?.w},${p.within?.h}` : '';
}

/** Which entries draw something, from their moments. */
const shownKey = (shown) => shown.map((m, i) => (m ? i : '')).join(',');

/**
 * The canvas pixels the part `[x, y, w, h]` of a box (its own pixels) can cover, the box
 * centred on (cx, cy) (canvas pixels), `hx` × `hy` from there to its corners, turned by
 * (cos, sin), cut at `within` (CSS px, `px` buffer pixels each) and at the canvas (`w` ×
 * `h`): a scissor box in GL's pixels (from the bottom left), a pixel wider all round.
 */
function placedRect([x, y, bw, bh], cx, cy, hx, hy, cos, sin, within, px, w, h) {
  const xs = [], ys = [];
  for (const [qx, qy] of [[x, y], [x + bw, y], [x, y + bh], [x + bw, y + bh]]) {
    const dx = qx - hx, dy = qy - hy;
    xs.push(cx + cos * dx - sin * dy);
    ys.push(cy + sin * dx + cos * dy);
  }
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (within) {
    x0 = Math.max(x0, (within.x - within.w / 2) * px);
    x1 = Math.min(x1, (within.x + within.w / 2) * px);
    y0 = Math.max(y0, (within.y - within.h / 2) * px);
    y1 = Math.min(y1, (within.y + within.h / 2) * px);
  }
  const left = Math.max(0, Math.floor(x0) - 1), right = Math.min(w, Math.ceil(x1) + 1);
  const top = Math.max(0, Math.floor(y0) - 1), bottom = Math.min(h, Math.ceil(y1) + 1);
  return [left, h - bottom, Math.max(0, right - left), Math.max(0, bottom - top)];
}

/** The finite numbers of an object of parameters, or null when there are none. */
function numbers(o) {
  if (!o || typeof o !== 'object') return null;
  const out = Object.fromEntries(Object.entries(o).filter(([, v]) => Number.isFinite(Number(v))).map(([k, v]) => [k, Number(v)]));
  return Object.keys(out).length ? out : null;
}

/** A cubic-bezier's four numbers. */
const isEase = (v) => Array.isArray(v) && v.length === 4 && v.every((n) => Number.isFinite(Number(n)));

/** A share in 0..1, or `fallback` when it is not a number. */
function unit(v, fallback) {
  const n = Number(v);
  return v == null || !Number.isFinite(n) ? fallback : Math.max(0, Math.min(1, n));
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  const n = m ? parseInt(m[1], 16) : 0;
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
