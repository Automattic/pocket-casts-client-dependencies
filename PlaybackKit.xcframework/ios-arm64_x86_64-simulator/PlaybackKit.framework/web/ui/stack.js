// The shows-and-episodes cover stack (Figma "Total listened", cycling as the P2's
// "centered covers" video does, measured from it frame by frame; see docs/effects.md).
//
// The top shows, #1 at the front, in Figma's four slots, cycle once round: the front cover
// drops away and fades, the others move up a slot, and the next show grows in at the back.
// The stack comes in partway through one of those moves, already moving (POC-1038), and the
// deck carries on from there. After the last show the deck comes round to the first again:
// the page's progress segment is full as it does (`deckRound`, PCIOS-1350), and the deck
// stops there, the stack as it opened, the top show at the front, for the page's hold
// (`deckStop`): it used to cycle on, so the page moved on in the middle of the next move, the
// top show already gone from the front. A page that stays instead (shared from) has no hold
// to wait out, so its deck cycles on from where it is (`cycleOn`).
//
// Every cover runs CSS animations generated here (its own keyframes, one loop of the
// deck long), so the stack is a function of the page's clock alone: deterministic,
// paused with the app like the intro, and seekable by the rig (shows-compare.mjs).
// Positions are fractions of the front cover's size, so the stack scales with --u.
//
// A finger can take the deck (`deckControl`): dragged up or down anywhere on the stack, the
// covers follow it, the front one under the finger, a cover a front cover's drop. Down moves the
// deck on, the front cover dropping away as in the deck's own moves; up brings back the one
// before. Let go, the deck carries on as far as the finger's speed takes it, as a scroll view
// does, and lands with a cover at the front (`fling`), rests, then cycles on from there on its
// own loop. Once taken, the page stays (no hold to move on after): it waits for a tap. A tap
// on the stack is still the story's, and so is a sideways swipe.

import { h } from './dom.js';

/** Figma's slots, front first: size and top, in px of its 393 × 852 frame. */
export const SLOTS = [{ size: 234, top: 171 }, { size: 190, top: 103 }, { size: 146, top: 52 }, { size: 114, top: 0 }];
/** From the back slot's top to the front cover's bottom. */
const STACK_HEIGHT = 405;
/** Shows the deck cycles through at most. */
export const DECK_MAX = 10;

/**
 * The motion, in seconds and fractions of the front cover's size: the cycle as measured on
 * the video (30 fps, its phone at 1:1), the way in designed. Times are after the page is
 * entered.
 */
export const STACK_MOTION = {
  // The covers come in once the intro's tagline has gone.
  start: 0.25,
  // The way in (POC-1038): the stack shows up partway through one of the deck's own moves,
  // `phase` of its time gone (about its top speed), every cover coming from a slot back (the
  // back one from where the next show grows in), and fades in as one over `fade` as it
  // moves. The video's rise from below faded the front cover in 0.19 s before it began to
  // move, so it showed standing still: design QA saw the covers "ease in from a standstill".
  // (The title and the share button follow at 0.31 s and 0.5 s, over 0.27 s and 0.26 s:
  // playback.css.)
  entry: { phase: 0.42, fade: 0.18 },
  // A cycle every `period`: every cover moves a slot over `move`, on one curve (RMS 0.005
  // of the way over the first cycle). The first move comes after the way in and the deck's
  // usual rest, so the deck goes on in its own rhythm (1.004 s after the covers come in).
  get first() { return (1 - this.entry.phase) * this.move + (this.period - this.move); },
  period: 1.458,
  move: 1.082,
  ease: [0.82, 0, 0, 0.99],
  // The front cover drops on its own curve while it fades out, [seconds into the move,
  // opacity], in front of the rest until it has gone (RMS 0.4 px).
  exit: {
    by: 0.534,
    duration: 0.763,
    ease: [0.907, 0.011, 0.262, 0.925],
    fade: [[0.325, 1], [0.39, 0.9], [0.422, 0.65], [0.454, 0.27], [0.487, 0.16], [0.519, 0.07], [0.552, 0]],
  },
  // The next cover grows in at the back from `enter` of the back slot, about its centre,
  // from behind the cover it replaces.
  enter: 0.78,
};

/** The deck under a finger (designed: the video has none), in seconds. */
export const DRAG = {
  // How far a finger moves, mostly up or down, before the deck is its (app.js TAP_SLOP_PX).
  slop: 10,
  // Let go, the deck goes on as a scroll view decelerates: about as far as the finger's speed
  // would take it in `tau` (a fling of 1,000 px a second, eight covers' drop, goes 3 covers),
  // to the nearest cover, on a critically damped spring starting at the finger's speed (`fling`);
  // never more than once round.
  tau: 0.35,
  // The finger's speed over its last `sample` before it lets go (none if it stopped there).
  sample: 0.08,
  // Landed, the deck rests this long, the cover it landed on at the front, then cycles on.
  rest: 3,
};

const r = (n, d = 4) => +n.toFixed(d);
// A key's offset from the moment it marks, so two keys at one moment keep their order.
const EPS = 0.001;
const bezier = (b) => `cubic-bezier(${b.join(', ')})`;
const pct = (n) => `${r(n * 100, 3)}%`;

/** A slot's pose: where a front-sized box goes, scaled about its top centre. */
function pose(slots, s) {
  const front = slots[0];
  return { y: (slots[s].top - front.top) / front.size, scale: slots[s].size / front.size };
}

const transform = (p) => `translateY(${pct(p.y)}) scale(${r(p.scale)})`;

/** Covers in the loop for `n` shows: enough that one can be on its way out while the next comes in (a short deck goes round twice). */
export const deckSize = (n, V) => n * Math.ceil((V + 1) / n);

/**
 * When the deck of `count` shows has come round, in seconds after the page is entered: every
 * show has had its turn at the front, and the top show is back there, the stack as it opened
 * (the end of the n-th move). The page's progress segment fills until then (PCIOS-1350): the
 * cycle is what the page shows. One show does not cycle: 0, the way in is all there is.
 */
export function deckRound(count, M = STACK_MOTION) {
  const n = Math.min(count, DECK_MAX);
  return n > 1 ? M.start + M.first + (n - 1) * M.period + M.move : 0;
}

/**
 * Where the deck of `n` shows (2 or more) stops, in seconds into its loop: just after it has
 * come round (`deckRound`), in the rest before the next move, where every cover is in its slot.
 */
export const deckStop = (n, M = STACK_MOTION) => (n - 1) * M.period + M.move + 2 * EPS;

/**
 * The timing that carries a cover's loop on from where it is, as Web Animations timing (ms):
 * one still on its way round goes on looping; one stopped (`deckStop`) goes on from the pose
 * it stopped in, the next move after the deck's usual rest, rather than from where it would
 * be had it never stopped. Pure, so it can be checked.
 */
export function cycleTiming({ localTime, delay, duration, iterations }) {
  const stop = delay + duration * iterations;
  return localTime == null || localTime <= stop ? { iterations: Infinity } : { iterations: Infinity, delay: localTime - duration * iterations };
}

/**
 * Sets the stopped (or stopping) deck in `root` cycling on (`cycleTiming`), once. A deck a finger
 * has taken (`deckControl`) cycles on by itself once it lands: nothing to do.
 */
export function cycleOn(root) {
  const list = root.querySelector('.stack:not(.stack-still)');
  if (!list || list.dataset.cycling) return;
  list.dataset.cycling = '';
  for (const item of list.querySelectorAll('.stack-item')) {
    for (const a of item.getAnimations()) {
      const timing = a.effect?.getComputedTiming();
      if (!timing) continue;
      // A finished animation holds its end as its time: how long it has run is the timeline's
      // since it started (none while paused: then its own time is right).
      const ran = a.startTime == null || a.timeline?.currentTime == null ? timing.localTime : (a.timeline.currentTime - a.startTime) * a.playbackRate;
      a.effect.updateTiming(cycleTiming({ ...timing, localTime: ran }));
    }
  }
}

/** A cubic-bezier's x and y at parameter s. */
const bez = (b, s) => {
  const c = (p1, p2) => 3 * (1 - s) * (1 - s) * s * p1 + 3 * (1 - s) * s * s * p2 + s * s * s;
  return [c(b[0], b[2]), c(b[1], b[3])];
};
/** The parameter where a cubic-bezier's x is `x` (x is monotonic for CSS curves). */
function bezParam(b, x) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (bez(b, m)[0] < x) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
/** A CSS timing curve's progress at time fraction x. */
export const easeAt = (b, x) => (x <= 0 ? 0 : x >= 1 ? 1 : bez(b, bezParam(b, x))[1]);

/** Where the next show grows in: `enter` of the back slot, about its centre. */
function enterPose(slots, M) {
  const back = slots[slots.length - 1], front = slots[0];
  return { y: (back.top + (back.size * (1 - M.enter)) / 2 - front.top) / front.size, scale: (back.size * M.enter) / front.size };
}

/**
 * Cover j's way in (POC-1038): the rest of a deck move into its slot, from `entry.phase` of
 * its time on, on the move's own curve, from a slot back (the back cover from where the next
 * show grows in). Poses `{t, y, scale}` (t in seconds after `start`), 120 a second, the last
 * one the slot's. Pure, so it can be checked.
 */
export function entryFrames(j, V, M = STACK_MOTION, slots = SLOTS.slice(0, V)) {
  const { phase } = M.entry;
  const from = j + 1 < V ? pose(slots, j + 1) : enterPose(slots, M);
  const to = pose(slots, j);
  const duration = (1 - phase) * M.move;
  const n = Math.ceil(duration * 120);
  return Array.from({ length: n + 1 }, (_, i) => {
    const k = i === n ? 1 : easeAt(M.ease, phase + (1 - phase) * (i / n));
    return { t: duration * (i / n), y: from.y + (to.y - from.y) * k, scale: from.scale + (to.scale - from.scale) * k };
  });
}

/**
 * The way in as the card's keyframes, inside its slot's pose (both scaled about their top
 * centre), played linearly: the curve is in the keys.
 */
function entryKeyframes(name, frames, here) {
  const T = frames[frames.length - 1].t;
  const keys = frames.map((f, i) => `${r((f.t / T) * 100, 3)}%{transform:${i === frames.length - 1 ? 'none' : `translateY(${pct((f.y - here.y) / here.scale)}) scale(${r(f.scale / here.scale, 5)})`}}`);
  return { css: `@keyframes ${name}{${keys.join('')}}`, duration: T };
}

/**
 * One cover's loop through a deck of E covers in V slots: E cycles, starting where it
 * starts (slot `j`, before its first move) and ending there. Keyframes `{u, y, scale,
 * opacity, z, ease}` (u in seconds into the loop; a key leaves out what it does not
 * set; `ease` is the curve to the next key). Pure, so the deck can be checked.
 */
export function deckFrames(j, E, V, M = STACK_MOTION, slots = SLOTS.slice(0, V)) {
  const L = E * M.period;
  const z = (s) => 2 + V - s;            // front on top
  const EXIT_Z = V + 3, WAIT_Z = 1;
  const enter = enterPose(slots, M);
  const exit = { y: M.exit.by, scale: 1 };
  const frames = [];
  const at = (u, props, ease) => frames.push({ u, ...props, ...(ease ? { ease } : {}) });
  const state = (s) => (s < V ? { ...pose(slots, s), opacity: 1, z: z(s) } : { ...enter, opacity: 0, z: WAIT_Z });

  at(0, state(j));
  let s = j;
  for (let k = 0; k < E; k++) {
    const u = k * M.period + EPS;
    if (s === 0) {
      // Out: down and away on its own curve, in front of the rest until it has gone.
      at(u - EPS, state(0));
      at(u, { ...state(0), z: EXIT_Z }, M.exit.ease);
      for (const [x, o] of M.exit.fade) at(u + x, { opacity: o });
      at(u + M.exit.duration, { ...exit, opacity: 0 });
      at(u + M.move, { ...exit, opacity: 0, z: EXIT_Z });
      at(u + M.move + EPS, state(E - 1));
      s = E - 1;
    } else if (s === V) {
      // In: from behind the back cover, growing into its slot.
      at(u - EPS, state(V));
      at(u, { ...enter, opacity: 1, z: z(V - 1) }, M.ease);
      at(u + M.move, state(V - 1));
      s = V - 1;
    } else if (s < V) {
      at(u - EPS, state(s));
      at(u, { ...state(s), z: z(s - 1) }, M.ease);
      at(u + M.move, state(s - 1));
      s -= 1;
    } else {
      s -= 1;
    }
  }
  at(L, state(j));
  return frames;
}

/**
 * A cover's pose `s` slots back from the front, anywhere on the loop of E covers (wrapped into
 * [0, E)), as a finger holds the deck: whole, the pose `deckFrames` rests it in; between two
 * slots, linear between them; past E − 1, leaving (E − s of the way out), dropping as the
 * front cover does and fading as it does for the same drop; from V on, waiting unseen; between
 * V − 1 and V, growing in from behind the back cover. `{y, scale, opacity, z}`. Pure.
 */
export function deckPose(s, E, V, M = STACK_MOTION, slots = SLOTS.slice(0, V)) {
  s = ((s % E) + E) % E;
  if (s > E - 1) {
    const g = E - s;
    return { y: M.exit.by * g, scale: 1, opacity: exitOpacity(g, M), z: V + 3 };
  }
  if (s >= V) return { ...enterPose(slots, M), opacity: 0, z: 1 };
  const k = Math.floor(s), f = s - k;
  const a = pose(slots, k), b = k + 1 < V ? pose(slots, k + 1) : enterPose(slots, M);
  return { y: a.y + (b.y - a.y) * f, scale: a.scale + (b.scale - a.scale) * f, opacity: 1, z: 2 + V - k };
}

/** The leaving cover's opacity `g` of the way down: the drop's fade keyed by how far it has dropped by each key. */
function exitOpacity(g, M) {
  const { fade, ease, duration } = M.exit;
  let x0 = 0, o0 = 1;
  for (const [t, o] of fade) {
    const x = easeAt(ease, t / duration);
    if (g <= x) return x > x0 ? o0 + ((o - o0) * (g - x0)) / (x - x0) : o;
    x0 = x;
    o0 = o;
  }
  return o0;
}

/**
 * How far the deck has gone `u` seconds into its loop, in moves: whole at rest, and a share of
 * one while a move is on, as far as the covers in the slots have got on the move's curve.
 */
export function deckAt(u, M = STACK_MOTION) {
  const t = u - EPS;
  if (!(t > 0)) return 0;
  const k = Math.floor(t / M.period);
  const x = (t - k * M.period) / M.move;
  return k + (x >= 1 ? 1 : easeAt(M.ease, x));
}

/**
 * Where a deck let go of at `p` (in moves), going `v` moves a second, lands, and how it gets
 * there (DRAG): `to`, the nearest whole move to where that speed would take it in `tau`, no
 * more than `n` moves (once round) away; `where(t)`, where it is `t` seconds on: a critically
 * damped spring that starts at the finger's speed and, flung, goes about as far as `tau` of
 * it would (its time constant is half of `tau`); `duration`, when it is within a 500th of a
 * move of `to` (a quarter of a pixel) for good. Pure.
 */
export function fling(p, v, n, D = DRAG) {
  const w = 2 / D.tau, cap = n / D.tau;
  v = Math.max(-cap, Math.min(cap, v || 0));
  const to = Math.round(p + v * D.tau);
  const A = p - to, B = v + w * A;
  const spring = (t) => to + (A + B * t) * Math.exp(-w * t);
  // Past its turn (if it overshoots) and its last bend, it only closes in.
  const after = Math.max(0, B ? -A / B : 0) + 1 / w;
  let duration = 0;
  if (Math.abs(A) > 1e-6 || Math.abs(B) > 1e-6) {
    duration = 1 / 120;
    while (duration < 4 && (duration < after || Math.abs(spring(duration) - to) > 2e-3)) duration += 1 / 120;
  }
  return { to, where: (t) => (t >= duration ? to : spring(t)), duration };
}

/**
 * The keyframes of a loop, as two animations: the pose (transform and opacity, which
 * the compositor can run) and the stacking order, which changes as each move starts.
 */
function loopKeyframes(name, frames, L) {
  const block = (keys) => frames.map((f) => {
    const props = [];
    if (keys === 'pose') {
      if (f.y != null) props.push(`transform:${transform(f)}`);
      if (f.opacity != null) props.push(`opacity:${f.opacity}`);
      if (props.length && f.ease) props.push(`animation-timing-function:${bezier(f.ease)}`);
    } else if (f.z != null) {
      props.push(`z-index:${f.z}`);
    }
    return props.length ? `${r((f.u / L) * 100, 4)}%{${props.join(';')}}` : '';
  }).join('');
  return `@keyframes ${name}{${block('pose')}}@keyframes ${name}-z{${block('z')}}`;
}

/**
 * The stack, as a list (screen readers get one image per show), with the styles that
 * move it. `animate: false` (Reduced Motion) draws Figma's still stack.
 *
 * @param {Array<{uuid: string, title: string}>} podcasts  ranked, #1 first
 * @param {{artwork: (p: object, label: boolean) => HTMLElement, label: string, animate: boolean}} o
 */
export function coverStack(podcasts, { artwork, label, animate = true }) {
  const M = STACK_MOTION;
  const deck = podcasts.slice(0, DECK_MAX);
  const V = Math.min(deck.length, SLOTS.length);
  const slots = SLOTS.slice(0, V);
  const cycles = animate && deck.length > 1;
  const E = cycles ? deckSize(deck.length, V) : V;
  const base = slots[V - 1].top;
  const css = [];
  const items = [];
  for (let j = 0; j < E; j++) {
    const p = deck[j % deck.length];
    const repeat = j >= deck.length;
    const card = h('div', { class: 'stack-card' }, artwork(p, !repeat));
    const item = h('li', { class: 'stack-item', 'aria-hidden': repeat ? 'true' : null }, card);
    const start = j < V ? pose(slots, j) : null;
    if (!animate) {
      item.style.transform = transform(start);
      item.style.zIndex = String(2 + V - j);
    } else {
      const anims = [];
      if (cycles) {
        const name = `pb-deck-${E}-${V}-${j}`;
        css.push(loopKeyframes(name, deckFrames(j, E, V, M, slots), E * M.period));
        // Once round, to where it stops (a share of the loop: the loop is longer than a round for
        // a short deck); the rest of the loop is what `cycleOn` plays.
        const timing = `${r(E * M.period, 3)}s linear ${r(M.start + M.first, 3)}s ${r(deckStop(deck.length, M) / (E * M.period), 6)} both`;
        anims.push(`${name} ${timing}`, `${name}-z ${timing}`);
      } else {
        item.style.transform = transform(start);
      }
      if (anims.length) item.style.animation = anims.join(', ');
      else item.style.zIndex = String(2 + V - j);
      if (start) {
        // The way in, inside the slot's pose.
        const name = `pb-stack-in-${V}-${j}`;
        const way = entryKeyframes(name, entryFrames(j, V, M, slots), start);
        css.push(way.css);
        card.style.animation = `${name} ${r(way.duration, 3)}s linear ${r(M.start, 3)}s both`;
      }
    }
    items.push(item);
  }
  // Front first, so a screen reader reads #1 first; z-index decides what paints on top. The
  // stack fades in as one, as it starts to move (a cover fading on its own would show the
  // ones behind through it).
  const size = `--stack-h:${STACK_HEIGHT - base};--front-top:${slots[0].top - base}`;
  const fade = animate ? `;animation:pb-fade-in ${M.entry.fade}s linear ${r(M.start, 3)}s both` : '';
  const list = h('ul', { class: 'stack', style: `${size}${fade}`, 'aria-label': label }, items);
  if (cycles) list.deck = deckControl(list, items, { n: deck.length, E, V, M, slots, loop: `pb-deck-${E}-${V}` });
  const out = css.length ? [h('style', null, css.join('\n')), list] : [list];
  // The share image shows the stack at rest, #1 at the front, as it opens and comes round (and
  // as the summary's stack card does), not wherever the deck has got to: it moves through the
  // host's wait and the snapshot, so the image caught a different show each time, sometimes
  // halfway through a move. A still copy, shown only in the share layout (playback.css), over the
  // deck, which carries on underneath, so nothing replays once the image is taken.
  if (cycles) out.push(stillStack(deck, slots, size, artwork));
  return out;
}

/**
 * The deck in `list` (its covers `items`, cover j starting in slot j of its loop `loop`) under a
 * finger: `bind(surface, {onGrab})` lets a drag up or down on `surface` take it. On the deck's
 * own loop (its CSS animations), where it is is `base` moves on from the loop's start; a finger
 * takes it from there (`takeOver`), moving it itself (`layout`); let go, it is flung
 * (`fling`, a sampled Web Animation per cover, so it runs on the compositor) and lands on a
 * whole move, where its covers start their loops again, each from the slot it is in, after
 * DRAG.rest. `onGrab` is told as it is first taken.
 */
function deckControl(list, items, { n, E, V, M, slots, loop }) {
  const L = E * M.period;
  let base = 0, touched = false, drag = null, flung = null;

  const slotOf = (j, p) => (((j - p) % E) + E) % E;
  function layout(p) {
    items.forEach((item, j) => {
      const q = deckPose(slotOf(j, p), E, V, M, slots);
      Object.assign(item.style, { transform: transform(q), opacity: String(q.opacity), zIndex: String(q.z) });
    });
  }

  /** Where the deck is now, in moves. */
  function position() {
    if (drag?.claimed) return drag.p;
    if (flung) {
      const t = (flung.anims[0]?.currentTime ?? 0) / 1000;
      return flung.path.where(Math.min(t, flung.path.duration));
    }
    const a = items[0].getAnimations().find((x) => x.animationName?.startsWith(loop) && !x.animationName.endsWith('-z'));
    const progress = a?.effect?.getComputedTiming().progress;
    return base + (progress == null ? 0 : deckAt(progress * L, M));
  }

  function stopFling() {
    for (const a of flung?.anims ?? []) a.cancel();
    flung = null;
  }

  /** Off its loop, where it is, held by script from now on. */
  function takeOver() {
    const p = position();
    stopFling();
    for (const item of items) item.style.animation = 'none';
    // Applied now: a loop set again later under the same name has to start afresh.
    void getComputedStyle(items[0]).animationName;
    layout(p);
    if (!touched) {
      touched = true;
      // Its own loop now: the page staying has nothing to cycle on (cycleOn).
      list.dataset.cycling = '';
    }
    return p;
  }

  /** Flung from `p` at `v` moves a second, sampled 60 times a second (the poses curve through every slot). */
  function release(p, v) {
    const path = fling(p, v, n);
    if (!(path.duration > 0)) return land(path.to);
    const N = Math.ceil(path.duration * 60);
    const timing = { duration: path.duration * 1000, easing: 'linear', fill: 'forwards' };
    const ps = Array.from({ length: N + 1 }, (_, i) => path.where((i / N) * path.duration));
    const anims = [];
    items.forEach((item, j) => {
      const qs = ps.map((p) => deckPose(slotOf(j, p), E, V, M, slots));
      if (qs.every((q) => q.opacity === 0)) return;
      // The pose on the compositor; the stacking order apart, as on the loop, held between samples.
      anims.push(item.animate(qs.map((q, i) => ({ transform: transform(q), opacity: String(q.opacity), offset: i / N })), timing));
      anims.push(item.animate(qs.map((q, i) => ({ zIndex: String(q.z), offset: i / N, easing: 'steps(1, end)' })), timing));
    });
    flung = { anims, path };
    const done = flung;
    Promise.all(anims.map((a) => a.finished)).then(() => { if (flung === done) land(path.to); }, () => {});
  }

  /** At rest on move `k`: each cover's loop starts again from the slot it is in, after DRAG.rest. */
  function land(k) {
    stopFling();
    layout(k);
    base = k;
    const timing = `${r(L, 3)}s linear ${DRAG.rest}s infinite both`;
    items.forEach((item, j) => {
      const name = `${loop}-${slotOf(j, k)}`;
      item.style.animation = `${name} ${timing}, ${name}-z ${timing}`;
    });
  }

  function bind(surface, { onGrab = () => {} } = {}) {
    surface.dataset.drag = '';
    const claim = (e) => {
      drag.from = drag.p = takeOver();
      drag.claimed = true;
      drag.y = e.clientY;
      drag.step = Math.max(1, M.exit.by * list.offsetWidth);
      drag.samples = [{ t: performance.now(), y: e.clientY }];
      // Gone already (lifted as it was taken), it has nothing to capture.
      try { surface.setPointerCapture?.(e.pointerId); } catch { /* not active */ }
      onGrab();
    };
    surface.addEventListener('pointerdown', (e) => {
      if (!e.isPrimary || e.button > 0) return;
      // One that never ended (its pointer lost): let go of it where it is.
      if (drag) {
        const d = drag;
        drag = null;
        if (d.claimed) release(d.p, 0);
      }
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, claimed: false };
      // A touch catches a flung deck where it is (and is no tap), as it would a scroll view.
      if (flung) claim(e);
    });
    surface.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.claimed) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.hypot(dx, dy) < DRAG.slop) return;
        // Sideways is the story's swipe.
        if (Math.abs(dy) <= Math.abs(dx)) { drag = null; return; }
        claim(e);
        return;
      }
      const t = performance.now();
      drag.samples.push({ t, y: e.clientY });
      while (drag.samples.length > 2 && t - drag.samples[0].t > DRAG.sample * 1000) drag.samples.shift();
      drag.p = drag.from + (e.clientY - drag.y) / drag.step;
      layout(drag.p);
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      if (!d.claimed) return;
      let v = 0;
      if (e.type === 'pointerup') {
        d.p = d.from + (e.clientY - d.y) / d.step;
        // The deck's gesture, neither a swipe nor a tap of the story's (app.js).
        e.preventDefault();
        const t = performance.now();
        const s = d.samples.filter((x) => t - x.t <= DRAG.sample * 1000);
        s.push({ t, y: e.clientY });
        const a = s[0], b = s[s.length - 1];
        if (b.t > a.t) v = ((b.y - a.y) / d.step) / ((b.t - a.t) / 1000);
      }
      release(d.p, v);
    };
    surface.addEventListener('pointerup', end);
    surface.addEventListener('pointercancel', end);
    // Its own capture only: a touch's first, on the cover under it, goes as the surface takes it.
    surface.addEventListener('lostpointercapture', (e) => { if (e.target === surface) end(e); });
    // A mouse would drag a cover's image away instead, and no pointer event would come after.
    surface.addEventListener('dragstart', (e) => e.preventDefault());
  }

  return { bind, position };
}

/** The deck's first `slots.length` shows in their slots, as Reduced Motion draws them. */
function stillStack(deck, slots, size, artwork) {
  const items = slots.map((_, j) => {
    const item = h('li', { class: 'stack-item' }, h('div', { class: 'stack-card' }, artwork(deck[j], false)));
    item.style.transform = transform(pose(slots, j));
    item.style.zIndex = String(2 + slots.length - j);
    return item;
  });
  return h('ul', { class: 'stack stack-still', style: size, 'aria-hidden': 'true' }, items);
}
