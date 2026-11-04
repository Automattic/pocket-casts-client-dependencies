// The top show's carousel (Figma "Top show 1", moving as the P2's "most listened"
// video does, measured from it frame by frame; see docs/effects.md).
//
// The quiz's options on a ring under the big cover: the one in the middle is the pick,
// raised and full size, with a dot under it; the rest sit lower, smaller and at half
// strength, two a side on screen. Every cover's place is a function of one number, the
// ring's position `s`: an option `d` slots from the middle has `pose(d)`, linear between
// Figma's slots, which is how the video's covers move (all four tracked covers agree to
// 0.2 pt). A tap on a side cover, an arrow key or a swipe moves `s` to the next pick on
// one curve. The ring wraps round; fewer than five options go round twice, so a cover
// never jumps from one side to the other on screen.
//
// A move is a Web Animation per cover, from its pose to the next on the move's curve,
// with a keyframe at every slot it passes (poses are linear between slots), so it runs
// on the compositor, exactly, and the rig can seek it. A swipe sets the poses directly.

import { h } from './dom.js';

/** Figma's slots, by distance from the middle: centre (x from the middle, y from the middle slot's centre), size, opacity. */
export const SLOTS = [
  { x: 0, y: 0, size: 72, opacity: 1 },
  { x: 96, y: 22, size: 56, opacity: 0.5 },
  { x: 184, y: 48, size: 56, opacity: 0.5 },
];
/** Past the last slot, each further slot moves on by this much (off screen). */
const BEYOND = { x: 88, y: 26 };

/** The motion, in seconds, as measured on the video (30 fps). */
export const CAROUSEL_MOTION = {
  // A move: every cover a slot over 0.987 s on one curve (RMS 0.2 pt over two moves,
  // four covers each).
  move: { duration: 0.987, ease: [0.862, 0, 0.025, 1] },
  // After a swipe the ring settles on the nearest pick on the move's own landing.
  settle: { duration: 0.5, ease: [0, 0, 0.025, 1] },
  // The dot goes as the move starts to sweep and comes back as it lands, [from, to]
  // seconds into the move, linearly.
  dot: { out: [0.29, 0.355], in: [0.565, 0.627] },
};

const lerp = (a, b, u) => a + (b - a) * u;

/** Where a cover `d` slots from the middle sits: {x, y, scale, opacity}, scale of the middle slot's size. */
export function pose(d) {
  const a = Math.abs(d), last = SLOTS.length - 1;
  let p;
  if (a >= last) {
    const s = SLOTS[last];
    p = { x: s.x + BEYOND.x * (a - last), y: s.y + BEYOND.y * (a - last), size: s.size, opacity: s.opacity };
  } else {
    const i = Math.floor(a), u = a - i, s0 = SLOTS[i], s1 = SLOTS[i + 1];
    p = { x: lerp(s0.x, s1.x, u), y: lerp(s0.y, s1.y, u), size: lerp(s0.size, s1.size, u), opacity: lerp(s0.opacity, s1.opacity, u) };
  }
  return { x: Math.sign(d) * p.x, y: p.y, scale: p.size / SLOTS[0].size, opacity: p.opacity };
}

/** Covers on the ring for `n` options: at least five, so the ring never shows its seam. */
export const ringSize = (n) => (n >= 5 ? n : n * Math.ceil(5 / n));

/** How far ring entry `k` is from the middle at position `s`, the short way round a ring of `E`. */
export function offset(k, s, E) {
  let d = (((k - s) % E) + E) % E;
  if (d > E / 2) d -= E;
  return d;
}

/** The ring entry nearest the middle at `s`. */
export const centred = (s, E) => ((Math.round(s) % E) + E) % E;

/** cubic-bezier(x1, y1, x2, y2) as CSS has it. */
export function bezier([x1, y1, x2, y2]) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = X(t) - x, d = dX(t);
      if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    if (Math.abs(X(t) - x) > 1e-4) {
      let lo = 0, hi = 1;
      for (let i = 0; i < 30; i++) { t = (lo + hi) / 2; if (X(t) < x) lo = t; else hi = t; }
    }
    return ((ay * t + by) * t + cy) * t;
  };
}

/**
 * The carousel. `options` are the quiz's ({id, podcast}), in ring order; `start` is the
 * option in the middle at first. `onPick(option, move)` is called as a move to a new
 * pick starts (`move`: {at, duration, ease}, `at` in ms on performance.now()), or with
 * no move when a swipe has already brought it to the middle.
 *
 * `surface` is a second place to swipe: the middle of the screen, over the big cover
 * (PCIOS-1315). It drags the same ring, and only swipes; a tap there is the story's.
 *
 * @returns {{el: HTMLElement, surface: HTMLElement, pick: () => object, moveTo: (id: string) => void, destroy: () => void}}
 */
export function topCarousel(options, { artwork, label, start = 0, rtl = false, animate = true, onPick = () => {} }) {
  const M = CAROUSEL_MOTION;
  const n = options.length;
  const E = ringSize(n);
  const dir = rtl ? -1 : 1;
  let s = start, target = start, move = null, drag = null, dragged = false;

  const items = [];
  for (let k = 0; k < E; k++) {
    const o = options[k % n];
    const real = k < n;
    const el = h('button', {
      type: 'button',
      class: 'tp-option',
      role: real ? 'radio' : null,
      'aria-hidden': real ? null : 'true',
      'aria-label': real ? o.podcast.title : null,
      'data-testid': real ? `option-${o.id}` : null,
      tabindex: '-1',
      onClick: () => { if (!dragged) go(nearest(k)); },
    }, h('span', { class: 'tp-option-frame' }), artwork(o.podcast, false));
    items.push(el);
  }
  const dot = h('span', { class: 'tp-dot', 'aria-hidden': 'true' });
  const el = h('div', { class: 'tp-carousel', role: 'radiogroup', 'aria-label': label, 'data-own-swipe': '' }, items, dot);
  const surface = h('div', { class: 'tp-swipe', 'data-own-drag': '', 'aria-hidden': 'true' });

  /** The ring position of entry `k` nearest the target, so a move goes the short way. */
  const nearest = (k) => target + offset(k, target, E);
  const pickAt = (t) => options[centred(t, E) % n];

  const style = (p) => ({ transform: `translate(${(dir * p.x).toFixed(2)}px, ${p.y.toFixed(2)}px) scale(${p.scale.toFixed(4)})`, opacity: String(p.opacity) });

  /** Every cover in its pose at `s`, still. */
  function layout() {
    for (let k = 0; k < E; k++) {
      const d = offset(k, s, E);
      Object.assign(items[k].style, style(pose(d)), { zIndex: String(10 - Math.round(Math.abs(d) * 2)), visibility: Math.abs(d) > SLOTS.length + 0.5 ? 'hidden' : '' });
    }
    checked();
  }

  /** The pick (the one moving to the middle) is the checked radio and the one Tab reaches. */
  function checked() {
    const c = centred(target, E) % n;
    items.forEach((it, k) => {
      if (k >= n) return;
      it.setAttribute('aria-checked', k === c ? 'true' : 'false');
      it.tabIndex = k === c ? 0 : -1;
    });
  }

  /**
   * The same slot's entry among the first `n`, the real options: a ring of fewer than five
   * goes round twice, and a move can land on a copy, whose real option is then off screen,
   * and Tab and the arrow keys would have nothing to reach. Every entry `n` apart shows the
   * same option, so the ring can turn to the real one unseen.
   */
  const home = (t) => centred(t, E) % n;

  /** Where a move has the ring now. */
  const position = (now = performance.now()) => (move ? lerp(move.from, move.to, move.ease(Math.min(1, (now - move.at) / (move.duration * 1000)))) : s);

  function stop() {
    for (const it of items) for (const a of it.getAnimations()) a.cancel();
    move = null;
  }

  /** Move to ring position `to` on `curve` (the move, or the settle after a swipe). */
  function run(to, curve = M.move) {
    const before = pickAt(target);
    const at = performance.now();
    const from = position(at);
    stop();
    s = from;
    target = to;
    if (!animate || to === from) {
      s = target = home(to);
      layout();
    } else {
      move = { from, to, at, duration: curve.duration, ease: bezier(curve.ease) };
      const timing = { duration: curve.duration * 1000, easing: `cubic-bezier(${curve.ease.join(', ')})`, fill: 'forwards' };
      for (let k = 0; k < E; k++) {
        const d0 = offset(k, from, E), d1 = d0 - (to - from);
        // A keyframe at every slot passed: between them a pose is linear in the ring's position.
        const ds = [d0];
        for (let b = Math.ceil(Math.min(d0, d1)); b <= Math.floor(Math.max(d0, d1)); b++) if (b > Math.min(d0, d1) && b < Math.max(d0, d1) && Math.abs(b) <= SLOTS.length) ds.push(b);
        ds.push(d1);
        ds.sort((a, b) => (d1 > d0 ? a - b : b - a));
        const frames = ds.map((d) => ({ ...style(pose(d)), offset: (d - d0) / (d1 - d0) }));
        Object.assign(items[k].style, { zIndex: String(10 - Math.round(Math.min(Math.abs(d0), Math.abs(d1)) * 2)), visibility: Math.min(Math.abs(d0), Math.abs(d1)) > SLOTS.length + 0.5 ? 'hidden' : '' });
        items[k].animate(frames, timing);
      }
      // Done: hold the poses as styles, and let the animations go.
      const done = move;
      items[0].getAnimations()[0]?.finished.then(() => { if (move === done) { move = null; s = target = home(to); layout(); stop(); } }, () => {});
      checked();
    }
    const after = pickAt(to);
    if (after !== before || curve === M.settle) onPick(after, animate && to !== s ? { at, duration: curve.duration, ease: curve.ease, settle: curve === M.settle } : null);
    if (animate && curve === M.move) dotMove();
  }
  const go = (to) => { if (to !== target) run(to); };

  function dotMove() {
    const [a, b] = M.dot.out, [c, d] = M.dot.in;
    const D = M.move.duration;
    dot.getAnimations().forEach((x) => x.cancel());
    dot.animate([
      { opacity: 1, offset: 0 }, { opacity: 1, offset: a / D }, { opacity: 0, offset: b / D },
      { opacity: 0, offset: c / D }, { opacity: 1, offset: d / D }, { opacity: 1, offset: 1 },
    ], { duration: D * 1000 });
  }

  // A swipe across the ring moves it under the finger, a slot per 96 px, and settles
  // on the nearest pick (a flick goes one further). It never moves the story.
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const v = drag.v;
    drag = null;
    if (!dragged) return;
    // Clicks that end a drag are not taps.
    setTimeout(() => { dragged = false; }, 0);
    const flick = Math.abs(v) > 0.4 ? -Math.sign(dir * v) * 0.5 : 0;
    run(Math.round(s + flick), M.settle);
  };
  for (const area of [el, surface]) {
    area.addEventListener('pointerdown', (e) => {
      if (!e.isPrimary || e.button > 0) return;
      drag = { x: e.clientX, s, t: performance.now(), v: 0, last: e.clientX, id: e.pointerId };
      dragged = false;
    });
    area.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      if (!dragged && Math.abs(dx) < 10) return;
      if (!dragged) { dragged = true; area.setPointerCapture?.(e.pointerId); drag.s = position(); stop(); }
      const now = performance.now();
      drag.v = (e.clientX - drag.last) / Math.max(1, now - drag.t);
      drag.last = e.clientX;
      drag.t = now;
      const before = pickAt(s);
      s = drag.s - (dir * dx) / SLOTS[1].x;
      target = s;
      layout();
      const after = pickAt(s);
      if (after !== before) onPick(after, null);
    });
    area.addEventListener('pointerup', end);
    area.addEventListener('pointercancel', end);
  }
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    e.stopPropagation();
    go(Math.round(target) + ((e.key === 'ArrowRight') === !rtl ? 1 : -1));
    requestAnimationFrame(() => items[centred(target, E) % n]?.focus({ preventScroll: true }));
  });

  layout();
  return {
    el,
    surface,
    pick: () => pickAt(target),
    moveTo(id) { const k = options.findIndex((o) => o.id === id); if (k >= 0) go(nearest(k)); },
    destroy() { stop(); },
  };
}
