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

import { createGL, DITHER } from './gl.js';
import { createPatternEffect, MAX_BLUR_LEVEL } from './pattern.js';
import { createWaveEffect } from './wave.js';
import { createThermalEffect } from './thermal.js';
import { loadDocument, documentTime, fadeLevel, holdTime, screenAt, scrubTime, sizeLevel, tweenValue, valuesAt } from './document.js';
import { fitFrame, placeFrame } from './frame.js';

const FS_SOLID = `#version 300 es
precision mediump float;
uniform vec4 uColor;
out vec4 frag;
void main() { frag = uColor; }`;

// A layer drawn in its own box (a shader on a Figma layer): the part of the box that
// was drawn, put on the canvas where the box is, turned with it. A box holding a smooth
// gradient (Wave: the summary's cards) is 16 bits a channel, rounded to the canvas's 8
// here, dithered (`uDither`, gl.js DITHER).
const FS_PLACE = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uSrc;
uniform float uDither;
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
${DITHER}
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
  frag = dither8(texture(uSrc, vec2(w.x, 1.0 - w.y)) * keep, uDither);
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

/**
 * An unclipped box (the top month's bubbles: past them only their empty margin) or one
 * that resizes is drawn into a target whose sides are whole multiples of this, its first
 * pixel where a target of its own size has it. Pattern keys its grain and its ramp's
 * dissolve on the pixel, and blurs on copies 2^level times smaller, rounded up: on a
 * side that is not a multiple, those copies' pixels fall elsewhere on the picture, and
 * through the metal's steep bands the whole bubble shifts. On this grid the picture is the
 * same however large the target, so a resizing box can keep one (see drawBoxed).
 */
const BOX_GRID = 2 ** MAX_BLUR_LEVEL;

/**
 * The largest an entry's `size` makes it from its own time `at` until it is whole, or
 * null once it is (or it has none): sampled, so an ease that overshoots counts.
 */
function peakSize(size, at) {
  if (!size || at >= size[1]) return null;
  let peak = 0;
  for (let i = 0; i <= 16; i++) peak = Math.max(peak, sizeLevel(size, at + ((size[1] - at) * i) / 16));
  return peak;
}

/** The effects a document draws with. */
const documentEffects = new WeakMap();
function drawsWith(doc, effects) {
  if (!documentEffects.has(doc)) documentEffects.set(doc, new Set(doc.screens.flatMap((sc) => sc.layers.filter((L) => L.type === 'effect').map((L) => L.effect))));
  for (const fx of documentEffects.get(doc)) if (effects.has(fx)) return true;
  return false;
}

/**
 * Effects whose picture moves on a clock of their own, not only on their document's
 * keyframes: Wave's travelling waves, Thermal's drift.
 */
const CLOCK_EFFECTS = new Set(['wave', 'thermal']);

/** Effects that draw large smooth gradients, which band at 8 bits a channel. */
const SMOOTH_EFFECTS = new Set(['wave']);
/** Whether a document draws any of them (a box for it is kept at 16 bits). */
const smoothDocument = (doc) => drawsWith(doc, SMOOTH_EFFECTS);

/**
 * Effects that read across all of the box they draw in, not only near what shows: Wave's
 * warps pull the field in from anywhere in it (what they pull from past its edge is empty:
 * that carves its scallops) and its mesh stretches all of it. A box drawn with one is drawn
 * whole wherever any of it shows, as a canvas that covers the screen is. Cut to the part on
 * screen and BOX_MARGIN (enough for Pattern's reads), a summary card peeking in at the
 * screen's edge drew another picture: its scallops carved at the cut, the ground through them.
 */
const WHOLE_EFFECTS = new Set(['wave']);
/** Whether a box for this document is drawn whole (see WHOLE_EFFECTS). */
const wholeDocument = (doc) => drawsWith(doc, WHOLE_EFFECTS);

/**
 * How many display intervals a frame can take before it counts as held up, for a show that
 * `waits` (see tick): more than a dropped frame or two, which a resize rides through.
 */
const STALL_FRAMES = 3;

/** Effects this build can draw. Layers naming any other effect are skipped. */
export const SUPPORTED_EFFECTS = ['pattern-refraction', 'wave', 'thermal'];
const EFFECT_SETS = Object.fromEntries(SUPPORTED_EFFECTS.map((name) => [name, new Set([name])]));

/**
 * How long (ms) an effect's targets, or a box's, are kept once nothing that shows draws with
 * them: then they are let go, and made again if a page draws with them again. A session kept
 * every target it had made to its end (on a phone at 2.625×, 87 MB of textures by Play again,
 * about half of them the pages left behind: Thermal's, Pattern's, the summary's cards'), and a
 * budget phone's WebView counts them against the app. Long enough that stepping back to the
 * page just left finds them still there.
 */
const IDLE_RELEASE_MS = 3000;

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
 * @param {number} [options.walls]  the most samples across Pattern's ridges at a wall (the
 *   degrade ladder's; fx/pattern.js MAX_WALL_SAMPLES by default).
 * @param {number} [options.ripple]  the most taps a side Wave's ripple takes (the degrade
 *   ladder's; fx/wave.js MAX_RIPPLE_GRID by default).
 * @param {boolean} [options.reads=true]  false: every Pattern pixel takes all its samples, even
 *   where they would all read the same (fx/pattern.js FS_REFRACT), to measure what that saves.
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
  // Boxed entries' own targets and Pattern instances, by the entry's `key` (`box`) or its
  // stack index, and what was last drawn into each (`drawn`: the entry, its scale and the
  // part of its box).
  const boxes = new Map();
  // Entries whose boxes are made ready before they show (`prepare`), and the frame that
  // makes the next one.
  let prepared = [], preparing = 0;
  // What is showing: documents bottom first, each with when it starts on the shared
  // clock (`delay`), how its time runs (`hold`, `once`) and how it is framed.
  let stack = [], doc = null, ramp = null, ground = null, stage = null;
  // The middle of the page's column across the canvas (CSS px from its left), what a document
  // that is not placed is centred on; null, the canvas's middle (see `show`).
  let centre = null;
  let lost = false, destroyed = false;
  let playing = false, raf = 0, hidden = document.hidden;
  // The document clock: `base` seconds, plus wall time since `since` while playing and
  // visible.
  let base = 0, since = 0;
  let lastTick = 0, lastWall = 0, interval = 0;
  // While what shows is resizing (until `waitUntil` on the clock), a frame held up does not
  // move it on (`waits`, see tick); `started` is when the show started, for a first frame
  // held up before any was drawn.
  let waits = false, waitUntil = 0, started = 0;
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
  // When each effect's own instance last drew (ms), and the sweep that lets go of what
  // nothing showing draws with (see IDLE_RELEASE_MS).
  const usedAt = new Map();
  let sweeper = 0, lastSweep = 0;

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
    usedAt.clear();
  }

  try {
    build();
  } catch (e) {
    onError(e);
    const none = () => {};
    return { ok: false, canvas, show: none, setCentre: none, setRamp: none, redraw: none, renderAt: none, play: none, pause: none, playing: () => false, time: () => 0, clock: () => 0, motionTime: () => null, document: () => null, setQuality: none, setStage: none, stats: () => null, gpu: () => null, compiled: () => Promise.resolve(), finish: none, destroy: none };
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
    // A new context holds nothing: every entry is drawn again, settled or not.
    invalidate();
    if (playing) loop(); else if (doc) draw(lastT);
  };
  const sizer = typeof ResizeObserver === 'function' ? new ResizeObserver(([e]) => {
    const box = e.contentBoxSize?.[0];
    cssSize = box ? [box.inlineSize, box.blockSize] : [e.contentRect.width, e.contentRect.height];
  }) : null;
  sizer?.observe(canvas);
  // A frame's animation callbacks, where it is drawn, run before its resize observations, so
  // the first frame drawn after the window resizes would be drawn at the canvas's old size and
  // stretched to the new, and hold until something else asked for a frame. The window's resize
  // forgets the size, so that frame reads it from the layout. (The share image's layout, which
  // resizes the window's way: taken on a slow Android device, the summary card's background
  // was drawn to 80% of its height.)
  const onWindowResize = () => { cssSize = null; };
  window.addEventListener('resize', onWindowResize);
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
      since = started = performance.now();
      lastTick = lastWall = 0;
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

  /** The buffer's size for the canvas's CSS size: what `fit` makes it. */
  function bufferSize() {
    if (opts.size) return opts.size.map((n) => Math.max(2, Math.round(n)));
    const [cssW, cssH] = cssWidthHeight();
    const cw = cssW || canvas.width, ch = cssH || canvas.height;
    return [Math.max(2, Math.round(cw * opts.resolution)), Math.max(2, Math.round(ch * opts.resolution))];
  }

  /** Match the buffer to the canvas's CSS size. */
  function fit() {
    const [w, h] = bufferSize();
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
    for (const e of stack) {
      e.drawnAt = 0;
      e.look = undefined;
    }
  }

  /**
   * What an entry's picture at its moment `m` is drawn from, as a string, on a buffer of
   * `size`; null when it moves on by itself (on a clock of its own: Wave's travelling waves,
   * Thermal's drift, an entry's `rates` or `drift`). Everything else an entry is drawn with
   * stays as it was until `show` or `invalidate`. The same look is the same picture, so a
   * frame in which every entry looks as it did when last drawn is not drawn again: the
   * canvas holds it (the completion rate's shape, once lit to the rate, for the rest of the
   * page; on a budget phone each of its frames cost 120 ms of the GPU's time).
   */
  function lookOf(e, m, size) {
    if (e.rates || e.tweens || e.drift || drawsWith(e.doc, CLOCK_EFFECTS)) return null;
    return `${documentTime(e.doc, timeline(e, m.at))},${m.opacity},${m.k},${size}`;
  }
  /** Whether an entry at its moment `m` would draw another picture than it last drew. */
  const changed = (e, m, size) => {
    const look = lookOf(e, m, size);
    return look === null || look !== e.look;
  };

  /**
   * Draw the moment `t`. `shown` is each entry's moment (see `moment`), when the caller has
   * them; `caps` (see `beatsDue`) puts a boxed entry that is not due a frame as it was last
   * drawn, where its box is now (otherwise each is drawn afresh); `now` is the frame's time.
   */
  function draw(t, { shown = null, caps = null, now = performance.now() } = {}) {
    if (lost || destroyed || !doc) return;
    const started = performance.now();
    lastT = t;
    if (!shown) shown = stack.map((e) => moment(e, t));
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
      const o = { opacity, phase: e.phase, clock: at + e.phase, ramp: e.ramp ?? ramp, drift: drifted(e, at), values: e.values, rates: e.rates, tweens: e.tweens, pixels: e.pixels, px, outline: e.outline, text: e.text };
      e.placedKey = placeKey(e.place);
      e.drawnK = k;
      const look = lookOf(e, m, `${w}x${h}`);
      // A canvas that covers the screen is drawn whole in a box of its own, as Creative Lab's
      // runtime draws it (Wave's mesh and ripple read across all of it), and cut at the screen.
      if (m.boxed) {
        const place = e.cover ? coverPlace(e, w, h, px) : e.place;
        const was = e.drawnAt;
        drawBoxed(i, e, place, at, o, w, h, px, k, !caps || due(e, caps) ? now : 0);
        // Drawn into its box afresh, or put again as it was last drawn (its look then).
        if (e.drawnAt !== was) e.look = look;
        continue;
      }
      const F = e.place && !opts.authored
        ? placeFrame(w, h, e.doc.refWidth, e.doc.refHeight, e.place.x * px, e.place.y * px, e.place.unit * px * k)
        : fitFrame(w, h, e.doc.refWidth, e.doc.refHeight, opts.authored ? e.doc.width : 0, e.fitCanvas ? [e.doc.width, e.doc.height] : null, opts.authored ? 1 : e.scale, opts.authored ? w / 2 : centreOf(w, px));
      const { screen, local } = screenAt(e.doc, documentTime(e.doc, timeline(e, at)));
      drawLayers(e.doc, screen, local, F, o);
      e.drawnAt = now;
      e.look = look;
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

  /** Where a document that is not placed is centred across a buffer `w` wide (`centre`, see `show`), in its pixels. */
  function centreOf(w, px) {
    return centre == null ? w / 2 : Math.min(w, Math.max(0, centre * px));
  }

  /**
   * Where a canvas that covers the screen is (`fit: 'cover'`): the document's authored
   * canvas in a box of its own, centred on the page's column (`centreOf`), as large as it
   * takes to cover the screen on both sides of that (times the entry's `scale`), drawn to its
   * edge.
   */
  function coverPlace(e, w, h, px) {
    const cx = centreOf(w, px);
    const unit = (Math.max((2 * Math.max(cx, w - cx)) / e.doc.width, h / e.doc.height) * e.scale) / px;
    return { x: cx / px, y: h / 2 / px, unit, box: true, canvas: true, edge: 0 };
  }

  /**
   * A boxed entry: its frame drawn into a target of its own, as a shader draws on a
   * Figma layer (the box is what it can draw into, and reads outside it are empty), then
   * put on the canvas at its place, turned by `place.rotate` degrees (clockwise, as CSS
   * turns), at `k` of its placed size. Only the part of the box that can reach the canvas
   * is drawn, unless the box is the document's authored canvas (`place.canvas`, a canvas
   * that covers the screen): that is drawn whole, its frame in its middle, as Creative
   * Lab's runtime draws it; so is a box whose effect reads across all of it (WHOLE_EFFECTS),
   * wherever any of it shows.
   *
   * `refresh` (ms, the frame's time) draws the box afresh; 0 puts what was drawn into it
   * last where the box is now, as long as that is the same entry, at about the same scale,
   * and covers all of the box that can show now. `dry` draws it into its box only, sized for
   * all of its `size` from `at`, and puts nothing on the canvas (`prepare`).
   */
  function drawBoxed(i, e, place, at, o, w, h, px, k, refresh, dry = false) {
    const { gl } = kit;
    const unit = place.unit * px * k;
    const Bw = (place.canvas ? e.doc.width : e.doc.refWidth) * unit, Bh = (place.canvas ? e.doc.height : e.doc.refHeight) * unit;
    const cx = place.x * px, cy = place.y * px;
    const th = ((Number(place.rotate) || 0) * Math.PI) / 180, cos = Math.cos(th), sin = Math.sin(th);
    const inBox = ([x, y]) => [cos * (x - cx) + sin * (y - cy) + Bw / 2, -sin * (x - cx) + cos * (y - cy) + Bh / 2];
    const corners = [[0, 0], [w, 0], [0, h], [w, h]].map(inBox);
    // Drawn whole wherever any of it shows: the authored canvas, or a box whose effect reads
    // across all of it (WHOLE_EFFECTS: a summary card's Wave).
    const whole = Boolean(place.canvas) || wholeDocument(e.doc);
    const margin = (Number.isFinite(place.margin) ? place.margin : BOX_MARGIN) * unit;
    const m = whole ? 0 : margin;
    // Clipped to the box, as Figma clips a layer's shader (drawn a little past it, empty,
    // for the edge blur), unless `clip: false` lets it spill out as far as the margin
    // (`place.margin` authored px, BOX_MARGIN by default).
    const clip = place.clip !== false;
    const spill = clip ? (Number.isFinite(place.edge) ? place.edge : EDGE_MARGIN) * unit : margin;
    let x0 = Math.max(-spill, Math.floor(Math.min(...corners.map((q) => q[0])) - m));
    let y0 = Math.max(-spill, Math.floor(Math.min(...corners.map((q) => q[1])) - m));
    let x1 = Math.min(Math.ceil(Bw + spill), Math.ceil(Math.max(...corners.map((q) => q[0])) + m));
    let y1 = Math.min(Math.ceil(Bh + spill), Math.ceil(Math.max(...corners.map((q) => q[1])) + m));
    if (x1 - x0 < 1 || y1 - y0 < 1) return;
    // The part of the box on the canvas. The authored canvas, drawn whole for what its last
    // pass reads (Wave's ripple: from anywhere in it), is finished there only: on a phone
    // that part of Play again's is under half of it, and its ripple the cost of its frame.
    const seen = place.canvas ? [x0, y0, x1, y1] : null;
    if (whole) [x0, y0, x1, y1] = [-spill, -spill, Math.ceil(Bw + spill), Math.ceil(Bh + spill)];
    const id = e.box ?? i;
    let box = boxes.get(id);
    if (!box) boxes.set(id, (box = { fx: {}, rt: null, drawn: null }));
    box.usedAt = performance.now();
    // What was drawn into the box last, in its own pixels at its own scale (`unit`): the
    // part of the box it holds (finished), now `r` times as large.
    const was = box.drawn;
    const r = was ? was.unit / unit : 1;
    const [n0, m0, n1, m1] = seen ?? [x0, y0, x1, y1];
    const [h0, k0, h1, k1] = was?.seen ?? (was ? [was.x0, was.y0, was.x1, was.y1] : []);
    const keep = !refresh && was?.entry === e && Math.abs(r - 1) < MAX_RESCALE
      && n0 * r >= h0 && m0 * r >= k0 && n1 * r <= h1 && m1 * r <= k1;
    if (!keep) {
      // A box resizing with what it is placed on (its `size`: the top month's bubbles) keeps
      // one target while it plays, with room for the largest it gets, until it is whole:
      // one of its own size at every frame meant a dozen textures a frame for each (its
      // Pattern instance's too), and dropped frames. On BOX_GRID, it is the same picture as
      // drawn at its own size, frame by frame and once it settles (it jumped there, drawn
      // centred in a target of any size).
      let bw = x1 - x0, bh = y1 - y0;
      if (!clip || e.size) {
        const grid = (n) => Math.ceil(n / BOX_GRID) * BOX_GRID;
        let [tw, th] = [grid(bw), grid(bh)];
        const peak = playing || dry ? peakSize(e.size, at) : null;
        // A target as large or larger on the grid draws the same picture: kept, so a box made
        // ready for its largest (`prepare`), or grown for it, is not made again smaller.
        if (box.rt && box.rt.w >= tw && box.rt.h >= th && box.rt.w % BOX_GRID === 0 && box.rt.h % BOX_GRID === 0) [tw, th] = [box.rt.w, box.rt.h];
        else if (peak) {
          const g = Math.max(1, peak / k) * 1.02;
          [tw, th] = [grid(bw * g + 2), grid(bh * g + 2)];
        }
        // Grown right and up: its first pixel (bottom left) stays where it was.
        [bw, bh] = [tw, th];
        [x1, y0] = [x0 + tw, y1 - th];
      }
      // A smooth gradient (Wave: the summary's cards) is kept at 16 bits, where the device has
      // them, and dithered as it is put on the canvas (FS_PLACE), so 8 bits do not band it.
      const smooth = smoothDocument(e.doc);
      if (!box.rt || box.rt.w !== bw || box.rt.h !== bh || box.smooth !== smooth) {
        box.rt?.dispose();
        box.rt = kit.target(bw, bh, { float: smooth });
        box.smooth = smooth;
      }
      const { screen, local } = screenAt(e.doc, documentTime(e.doc, timeline(e, at)));
      // An instance of each effect its layers use (Pattern's bubbles, Wave's cards), with
      // targets of the box's size.
      for (const L of screen.layers) if (L.type === 'effect' && !box.fx[L.effect] && effects[L.effect]?.fork) box.fx[L.effect] = effects[L.effect].fork();
      for (const fx of Object.values(box.fx)) fx.resize(bw, bh);
      gl.bindFramebuffer(gl.FRAMEBUFFER, box.rt.fbo);
      gl.viewport(0, 0, bw, bh);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const F = placeFrame(bw, bh, e.doc.refWidth, e.doc.refHeight, Bw / 2 - x0, Bh / 2 - y0, unit);
      // What is seen, in the target's GL pixels (from its bottom left), two more all round
      // for the placing's filter.
      const finish = seen && [seen[0] - x0 - 2, y1 - seen[3] - 2, seen[2] - seen[0] + 4, seen[3] - seen[1] + 4];
      drawLayers(e.doc, screen, local, F, { ...o, into: box, bounds: clip ? [-x0, -y0, Bw - x0, Bh - y0] : null, finish });
      box.drawn = { entry: e, unit, x0, y0, x1, y1, seen };
      e.drawnAt = refresh || performance.now();
    }
    if (dry) return;
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
      gl.uniform1f(loc('uDither'), box.rt.float ? 1 : 0);
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
   * time plus its `phase`, unwrapped (a rate's: Thermal's drift, the comparison circles'
   * colour, Wave's travelling waves), `tweens` move them from one value to another over a
   * stretch of `clock` (Play again's rings running out as it comes in), and `text` the type a Thermal layer draws instead of
   * its document's.
   */
  function drawLayers(d, screen, local, F, { opacity = 1, phase = 0, clock = local + phase, ramp = null, into = null, bounds = null, finish = null, drift = null, values: set = null, rates = null, tweens = null, pixels = null, px = 1, outline = false, text = null } = {}) {
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
      if (effect && !into) usedAt.set(L.effect, performance.now());
      if (!effect) {
        if (!warned.has(L.effect)) { warned.add(L.effect); onWarning(`backdrop: effect "${L.effect}" is not implemented yet; layer skipped`); }
        continue;
      }
      try {
        const values = valuesAt(L, local);
        if (set) Object.assign(values, set);
        if (rates) for (const [id, r] of Object.entries(rates)) values[id] = (values[id] ?? 0) + r * clock;
        if (tweens) for (const [id, tw] of Object.entries(tweens)) values[id] = tweenValue(tw, clock, opts.still);
        if (pixels) for (const [id, v] of Object.entries(pixels)) values[id] = (v * px) / F.unit;
        if (outline && Math.round(values.shape) === 0 && Math.round(values.fxSpace) !== 1 && values.mRounding > 0 && values.shapeSize > 0) {
          const r = (values.shapeSize / 100) * Math.min(d.refWidth, d.refHeight) / 2;
          values.shapeSize *= outlineRadius(r, values.mRounding) / r;
        }
        if (drift) { values.cx = (values.cx ?? 50) + drift[0]; values.cy = (values.cy ?? 50) + drift[1]; }
        effect.render(values, {
          F,
          samples: Math.min(opts.samples, d.msaa),
          ...(opts.walls > 0 ? { walls: opts.walls } : {}),
          ...(opts.ripple > 0 ? { ripple: opts.ripple } : {}),
          ...(opts.reads === false ? { reads: false } : {}),
          ramp: ramp || L.gradient,
          override: ramp,
          layer: L,
          canvas: [d.width, d.height],
          clock,
          text,
          stage: into ? null : stage,
          opacity,
          target: into?.rt ?? null,
          bounds,
          finish,
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
    const fps = stack.filter((e) => moment(e, t) && !(playing && e.settled)).map((e) => e.doc.playbackFps ?? 0);
    return fps.length ? cappedFps(fps.includes(0) ? 0 : Math.max(...fps)) : null;
  }

  function loop() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }

  function tick(now) {
    if (!playing || lost || destroyed) return;
    raf = requestAnimationFrame(tick);
    // A frame held up (the device busy for longer than STALL_FRAMES display intervals) while
    // what shows is resizing does not move it on: its clock waits out the time lost, and so
    // does the page (`onStall`: its own animations, started before then). On a phone, the top
    // month's answer was held up for half a second as its twelve bubbles came in, and both
    // were then most of the way through: a jump, not a bounce. Each on its own clock: this
    // one reads the time as it draws, the page's animations the frame's (`now`), so a frame
    // held up before this runs in it is late here at once and for them a frame on.
    const wall = performance.now();
    if (wall - lastSweep >= 1000) sweep(wall);
    if (waits) {
      const iv = interval || 1000 / 60;
      const held = wall - (lastWall || started) - iv, late = now - (lastTick || started) - iv;
      if (held > (STALL_FRAMES - 1) * iv && clock() - held < waitUntil) since += held;
      if (late > (STALL_FRAMES - 1) * iv && clock() < waitUntil) opts.onStall?.(late, lastTick || started);
    }
    lastWall = wall;
    // The display's own interval, measured from the frame callback itself.
    if (lastTick) {
      const dt = now - lastTick;
      if (dt > 1 && dt < 100) interval = interval ? interval * 0.9 + dt * 0.1 : dt;
    }
    lastTick = now;
    // A frame when what shows has changed, when anything showing is due one at its own
    // cadence, when something placed on what moves has moved, or when something is
    // resizing (its `size`: the top month's bubbles, with their discs, at every display
    // frame, not at their document's 30). Otherwise the last frame holds (and with nothing
    // showing, nothing is drawn at all).
    // An entry due a frame that would draw the picture it last drew (its look, see lookOf)
    // asks for none: it is `settled`, and asks for no cadence (stats) until it changes.
    const t = clock();
    const shown = stack.map((e) => moment(e, t));
    const caps = beatsDue(now, shown);
    const [w, h] = bufferSize();
    let wanted = shownKey(shown) !== lastShown;
    for (const [i, e] of stack.entries()) {
      if (!shown[i]) continue;
      // Asked on its beat only: between them it stays as it was.
      if (due(e, caps)) e.settled = !changed(e, shown[i], `${w}x${h}`);
      wanted = wanted || (due(e, caps) && !e.settled) || (Boolean(e.track) && placeKey(e.place) !== e.placedKey) || shown[i].k !== e.drawnK;
    }
    if (!wanted) return;
    for (const cap of caps) beats.set(cap, now);
    draw(t, { shown, caps, now });
  }

  /** A shown (or prepared) entry, from what `show` is given (see there). */
  function entryOf(e) {
    return {
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
      tweens: tweensOf(e.tweens),
      pixels: numbers(e.pixels),
      size: Array.isArray(e.size) && e.size[1] > e.size[0] && Number(e.size[2]) >= 0 ? [Number(e.size[0]), Number(e.size[1]), Number(e.size[2]), ...(isEase(e.size[3]) ? [e.size[3].map(Number)] : isSegments(e.size[3]) ? [e.size[3].map(([x, y, b]) => [Number(x), Number(y), ...(isEase(b) ? [b.map(Number)] : [])])] : [])] : null,
      scrub: Array.isArray(e.scrub) && e.scrub[1] > e.scrub[0] && [e.scrub[2], e.scrub[3]].every((v) => Number.isFinite(Number(v))) ? [...e.scrub.slice(0, 4).map(Number), ...(isEase(e.scrub[4]) ? [e.scrub[4].map(Number)] : [])] : null,
      key: typeof e.key === 'string' && e.key ? e.key : null,
    };
  }

  /**
   * Each keyed entry's box (`box`): its key, the nth showing with the same key `key#n`, and
   * boxes kept by key that nothing shows or is made ready for any more let go.
   */
  function claimBoxes() {
    const seen = new Map();
    for (const e of stack) {
      if (!e.key) continue;
      const n = seen.get(e.key) ?? 0;
      seen.set(e.key, n + 1);
      e.box = n ? `${e.key}#${n}` : e.key;
    }
    const used = new Set([...stack, ...prepared].map((e) => e.box));
    for (const [id, b] of boxes) if (typeof id === 'string' && !used.has(id)) { disposeBox(b); boxes.delete(id); }
  }

  function disposeBox(b) {
    b.rt?.dispose();
    for (const fx of Object.values(b.fx)) fx.dispose();
  }

  /** Whether an entry is drawn in a box of its own (see `moment`); one that is placed afresh at every frame may be either. */
  const boxedEntry = (e) => !opts.authored && (e.cover || Boolean(e.place?.box));

  /** Whether an entry will never draw again from playback time `t` on: faded out for good. */
  function gone(e, t) {
    if (opts.still || !e.fade || e.fade[2] > 0) return false;
    return t - e.delay + e.from >= e.fade[1];
  }

  /**
   * Let go of the targets of what nothing showing draws with, and has not drawn for
   * IDLE_RELEASE_MS: an effect's own instance no entry draws with outside a box, and a box no
   * entry draws in (by its stack index, or its key: one whose entries have all faded out, and
   * that is not made ready for one; `show` lets go of a key it no longer names, see
   * claimBoxes). Each is made again, and draws the same picture, if a page draws with it again.
   */
  function sweep(now = performance.now()) {
    lastSweep = now;
    if (lost || destroyed) return;
    const t = clock();
    const live = stack.filter((e) => !gone(e, t));
    for (const [name, fx] of Object.entries(effects)) {
      if (now - (usedAt.get(name) ?? -Infinity) < IDLE_RELEASE_MS) continue;
      if (live.some((e) => (!boxedEntry(e) || e.track) && drawsWith(e.doc, EFFECT_SETS[name]))) continue;
      fx.release?.();
      usedAt.delete(name);
    }
    for (const [id, b] of boxes) {
      if (now - (b.usedAt ?? 0) < IDLE_RELEASE_MS) continue;
      if (typeof id === 'number') {
        const e = stack[id];
        if (e && !e.box && !gone(e, t) && (boxedEntry(e) || e.track)) continue;
      } else if (live.some((e) => e.box === id) || prepared.some((e) => e.box === id)) continue;
      disposeBox(b);
      boxes.delete(id);
    }
  }

  /** Make the next entry `prepare` was given ready, a frame at a time. */
  function prepareNext() {
    preparing = 0;
    const e = prepared.find((p) => !boxes.get(p.box)?.ready);
    if (!e || lost || destroyed) return;
    const at = e.from;
    const o = { opacity: 1, phase: e.phase, clock: at + e.phase, ramp: e.ramp ?? ramp, values: e.values, rates: e.rates, tweens: e.tweens, pixels: e.pixels, px: e.px, outline: e.outline, text: e.text };
    // At every scale its `size` takes it through (where it starts, ends and turns, and steps
    // of √2 between): an effect's own targets can depend on it (Pattern's edge blur, on a
    // coarser copy as the box gets smaller). Anywhere on a canvas it fits on: only its box's
    // size matters here.
    const ks = new Set([sizeLevel(e.size, at), 1, peakSize(e.size, at) ?? 1]);
    const lo = Math.min(...ks), hi = Math.max(...ks);
    for (let k = lo * Math.SQRT2; k < hi; k *= Math.SQRT2) ks.add(k);
    for (const k of ks) if (k > 0) drawBoxed(-1, e, e.place, at, o, 1e5, 1e5, e.px, k, performance.now(), true);
    const box = boxes.get(e.box);
    if (box) box.ready = true;
    preparing = requestAnimationFrame(prepareNext);
  }

  const api = {
    ok: true,
    canvas,
    /**
     * Play a document from `at` seconds (default 0). `ramp` replaces every layer's own
     * gradient (colour from cover art); `ground` replaces the document's background.
     * `hold: [a, b]` plays to b, then moves its keyframes back and forth between a and b
     * instead of looping: for a document whose stretch after its entrance is meant to last
     * while the page does. What runs at a rate (Wave's travelling waves) goes on forward
     * through it, on the entry's own clock. `loop: false` plays it once and holds the last
     * frame. `fit: 'canvas'` fits the document's authored canvas rather than its frame (see
     * frame.js), and
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
     * many seconds ahead of its own time: what `motionTime()` reported for the same
     * document, less where this show starts it, carries the waves on unbroken while the
     * keyframes jump. `ramp` is the entry's own colours (the show's `ramp` is the
     * default). `stillAt` is the moment a still (Reduced Motion) shows. `values` set
     * parameters over the document's (one document shown in several places, each shaded
     * its own way), and `pixels` set them in CSS pixels whatever the entry's scale (a bevel
     * as wide on a small disc as on a large one). `rates` move parameters on at that much a
     * second of the entry's own time, never wrapped with its document's loop (a colour that
     * drifts for as long as the page shows, with no jump). `tweens: {id: [a, b, from, to,
     * ease]}` move a parameter from `from` at a to `to` at b seconds of the entry's own time
     * (along a cubic-bezier's four numbers, linear without), and hold it at `to` from then (Play
     * again's rings running out from the middle and settling on 12's own); a still shows it at
     * `to`. `size: [a, b, start, ease]` scales a
     * placed entry from `start` at a to whole at b seconds of its own time (along a
     * cubic-bezier's four numbers, or segments `[[x, y, bezier], …]`: past whole and back, a
     * bounce; linear without), as what it is placed on resizes.
     * `outline: true` keeps a circle's silhouette on its outline whatever its Rounding (in
     * a frame's own space): the edge blur, cut at half, takes about σ²/2r off its radius,
     * which this gives back, frame by frame (a disc as wide as what it stands for).
     * `text` is the type a Thermal entry draws instead of its document's (the user's
     * number), drawn smaller if it is longer, so it takes no more room across.
     * `scrub: [a, b, from, to, ease]` runs the entry's document from `from` to `to` seconds
     * of its own time between a and b seconds of the entry's (along a cubic-bezier's four
     * numbers, linear without), and holds it at `to` from then: a document whose clock is
     * a quantity (the completion rate's, the share revealed), moved to the user's.
     *
     * `centre` is the middle of the page's column across the canvas, in CSS px from its left
     * edge (`setCentre` moves it): every entry that is not placed is centred on it rather
     * than on the canvas's middle, the canvas still drawn edge to edge. Where a bar takes one
     * side of the screen (the iPhone Duo's), the page lays itself out between the safe area's
     * sides, and what a document draws about the middle (the intro's rings and blob, Play
     * again's 12) stays on its copy.
     */
    show(next, { ramp: r = null, ground: g = null, at = 0, hold: h = null, loop: looping = true, fit = 'frame', waits: wait = false, centre: c = null } = {}) {
      centre = Number.isFinite(c) ? c : null;
      const entries = Array.isArray(next) ? next : next ? [{ document: next, hold: h, loop: looping, fit }] : [];
      try {
        stack = entries.map(entryOf);
      } catch (err) {
        onError(err);
        stack = [];
      }
      claimBoxes();
      cancelAnimationFrame(preparing);
      preparing = 0;
      // Playing, the frames sweep (see tick); this one is for a show that does not play.
      clearTimeout(sweeper);
      sweeper = setTimeout(() => sweep(), IDLE_RELEASE_MS + 100);
      doc = stack[0]?.doc ?? null;
      ramp = r;
      ground = g;
      base = at;
      since = started = performance.now();
      // Waits out a frame held up while anything is still to resize (see tick).
      const resizing = stack.filter((e) => e.size);
      waits = Boolean(wait) && resizing.length > 0 && !opts.still;
      waitUntil = Math.max(0, ...resizing.map((e) => e.delay - e.from + e.size[1]));
      if (!playing) lastTick = lastWall = 0;
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
    /** The page's column moved (see `show`'s `centre`): what is not placed follows it. */
    setCentre(c) {
      const next = Number.isFinite(c) ? c : null;
      if (next === centre) return;
      centre = next;
      invalidate();
      if (!playing && doc) draw(lastT);
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
      since = started = performance.now();
      lastTick = lastWall = 0;
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
     * Where a lone document's free-running motion is (its own time, unwrapped, plus
     * `phase`: what its waves travel on), so the next show of the same document can carry
     * it on; null for a stack or nothing.
     */
    motionTime: () => (stack.length === 1 ? clock() - stack[0].delay + stack[0].from + stack[0].phase : null),
    document: () => doc,
    setQuality({ resolution, samples, fps, maxFps, size, authored, walls, ripple, reads } = {}) {
      if (resolution > 0) opts.resolution = Math.min(resolution, 4);
      if (size !== undefined) opts.size = size;
      if (authored !== undefined) opts.authored = !!authored;
      if (samples > 0) opts.samples = Math.max(1, Math.min(6, Math.round(samples)));
      if (fps !== undefined) opts.fps = fps === null ? undefined : Math.max(0, fps);
      if (maxFps !== undefined) opts.maxFps = maxFps > 0 ? maxFps : 0;
      if (walls !== undefined) opts.walls = walls > 0 ? Math.round(walls) : 0;
      if (ripple !== undefined) opts.ripple = ripple > 0 ? Math.round(ripple) : 0;
      if (reads !== undefined) opts.reads = reads !== false;
      invalidate();
      if (!playing && doc) draw(lastT);
    },
    /**
     * Make ready, before they show, the boxes of entries drawn in boxes of their own (their
     * `place.box`, and a `key` naming each): a box's target, as large as its `size` makes it,
     * and its effects' own instance, drawn once out of sight, an entry a frame, at
     * `resolution` buffer pixels a CSS pixel (the one they will show at). Then the frames
     * that first show them (by the same keys) make nothing: the top month's answer made
     * twelve boxes and their Pattern instances as it came in, and a phone held its first
     * frames up for half a second. Kept until the next `prepare`; `prepare(null)` lets them
     * go. A `show` stops making them (call again to go on: what is ready is not made again).
     */
    prepare(list, { resolution = opts.resolution } = {}) {
      cancelAnimationFrame(preparing);
      preparing = 0;
      const [cssW] = cssWidthHeight();
      const cw = cssW || window.innerWidth || 1;
      const px = Math.max(2, Math.round(cw * resolution)) / cw;
      try {
        prepared = (list || []).map(entryOf).filter((e) => e.key && e.place?.box && !e.cover);
      } catch (err) {
        onError(err);
        prepared = [];
      }
      for (const e of prepared) Object.assign(e, { box: e.key, px });
      claimBoxes();
      if (prepared.length && !lost && !destroyed && !opts.still) preparing = requestAnimationFrame(prepareNext);
    },
    /** The stage viewer: an intermediate buffer instead of the finished frame. */
    setStage(s) {
      stage = s || null;
      invalidate();
      if (!playing && doc) draw(lastT);
    },
    stats() {
      // Draws in the last second, to now: a backdrop that has stopped drawing (nothing showing,
      // or settled) drew none.
      const now = performance.now();
      while (drawn.length && now - drawn[0] > 1000) drawn.shift();
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
    /** The GPU's name as the context gives it ("Adreno (TM) 610", "Apple GPU"), or null. */
    gpu() {
      if (lost) return null;
      try {
        const gl = kit.gl, ext = gl.getExtension('WEBGL_debug_renderer_info');
        return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '') || null;
      } catch {
        return null;
      }
    },
    /** Resolves once the GPU has compiled every effect's programs, never making the page wait (gl.js `compiled`). */
    compiled() {
      return lost ? Promise.resolve() : kit.compiled();
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
      cancelAnimationFrame(preparing);
      clearTimeout(sweeper);
      sizer?.disconnect();
      window.removeEventListener('resize', onWindowResize);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      document.removeEventListener('visibilitychange', onVisibility);
      if (lost) return;
      for (const b of boxes.values()) disposeBox(b);
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

/**
 * An entry's `tweens` ({id: [a, b, from, to, ease?]}), each kept as `scrub` is (b past a, from
 * and to numbers, an optional cubic-bezier), or null when none is.
 */
function tweensOf(o) {
  if (!o || typeof o !== 'object') return null;
  const out = {};
  for (const [id, tw] of Object.entries(o)) {
    if (!Array.isArray(tw) || !(Number(tw[1]) > Number(tw[0])) || !tw.slice(0, 4).every((v) => Number.isFinite(Number(v)))) continue;
    out[id] = [...tw.slice(0, 4).map(Number), ...(isEase(tw[4]) ? [tw[4].map(Number)] : [])];
  }
  return Object.keys(out).length ? out : null;
}

/** A cubic-bezier's four numbers. */
const isEase = (v) => Array.isArray(v) && v.length === 4 && v.every((n) => Number.isFinite(Number(n)));
/** An ease in segments, `[[x, y, bezier?], …]` (document.js easeAt), x rising to 1. */
const isSegments = (v) => Array.isArray(v) && v.length > 0 && v.every((s, i) => Array.isArray(s) && Number.isFinite(Number(s[0])) && Number.isFinite(Number(s[1])) && (s[2] == null || isEase(s[2])) && (i === 0 || Number(s[0]) > Number(v[i - 1][0]))) && Number(v[v.length - 1][0]) === 1;

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
