// The summary (Figma "Summary 1–3", nodes 1002-9410, 9673, 9766, moving as the P2's cards
// video does, measured from it frame by frame; see docs/effects.md).
//
// Three cards on a carousel, the same data on each (the top shows, the minutes, the role),
// only the background changing: the first a grid of the top covers, the second a stack of
// them, the third Figma's bubbles. The backgrounds are the backdrop's, drawn in each card's
// box and following it as it moves (ui/backdrop.js); the cards, their covers and their copy
// are DOM. Under them the dots, Share (the card showing: the flow's variant) and Skip.
//
// The carousel moves as the video's does. A swipe drags the cards under the finger, and when
// it lifts they settle on the next card (or back) on a critically damped spring that starts
// at `carry` of the finger's speed over its last `window` (fitted on the video's four swipes,
// within 1.3 pt at every frame once the finger lifts). A tap on a side card, an arrow key or
// the host's variant moves a card on the video's page move (its four moves as one curve).
// Every move is a Web Animation of the track, so it runs on the compositor and the rig can
// seek it; the backdrop reads where the cards are as it draws.

import { h } from './dom.js';
import { artwork } from './artwork.js';
import { bezier } from './carousel.js';
import { formatNumber } from '../core/format.js';
import { SUMMARY_VARIANTS } from '../core/config.js';
import { SUMMARY_BUBBLES, SUMMARY_CARD } from '../core/pages.js';

export const SUMMARY_MOTION = {
  // After a swipe (the video's): ω in rad/s, ζ, the share of the finger's speed it starts at,
  // and over how long that speed is read.
  spring: { omega: 5.6, zeta: 1, carry: 0.76, window: 1 / 30 },
  // A tap, a key or the host's variant: the video's four moves fitted as one (RMS 3.2 pt).
  page: { duration: 0.9685, ease: [0.582, -0.047, 0.099, 1.001] },
  // A release this fast (pt a second) turns the card whatever the drag's length.
  flick: 200,
  // Past the first and the last card, the track follows the finger this much.
  edge: 1 / 3,
  // The dots: the nearest card's lights up as the next goes, linearly (the video's, 0.1–0.13 s).
  dot: 0.12,
};

/** Figma's card pitch: a card and the gap after it (pt). */
const PITCH = SUMMARY_CARD.width + 8;

/** Where a spring from `u0` at speed `v0` (units and units a second) is `t` seconds on. */
export function springAt(u0, v0, { omega: w, zeta: z }, t) {
  if (Math.abs(z - 1) < 1e-6) return Math.exp(-w * t) * (u0 + (v0 + w * u0) * t);
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z);
    return Math.exp(-z * w * t) * (u0 * Math.cos(wd * t) + ((v0 + z * w * u0) / wd) * Math.sin(wd * t));
  }
  const a = w * Math.sqrt(z * z - 1), r1 = -z * w + a, r2 = -z * w - a;
  const c2 = (v0 - r1 * u0) / (r2 - r1);
  return (u0 - c2) * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
}

/**
 * A spring's course, `fps` samples a second until it is within `eps` of rest for good (and
 * at most `max` seconds): what a Web Animation's keyframes are made of.
 */
export function springCourse(u0, v0, spring, { fps = 60, eps = 1e-3, max = 3 } = {}) {
  const out = [u0];
  for (let i = 1; i <= max * fps; i++) {
    const u = springAt(u0, v0, spring, i / fps);
    out.push(u);
    if (Math.abs(u) < eps && Math.abs(springAt(u0, v0, spring, (i + 1) / fps)) < eps) break;
  }
  out[out.length - 1] = 0;
  return out;
}

/** The card a release settles on: the next one the finger was heading for if fast enough, else the nearest. */
export function settleOn(position, from, speed, count, { flick = SUMMARY_MOTION.flick } = {}) {
  const next = Math.abs(speed) > flick / PITCH ? from + Math.sign(speed) : Math.round(position);
  return Math.max(0, Math.min(count - 1, next));
}

/** A finger's speed (px a second) over the last `window` seconds of its samples ([t ms, x px]). */
export function fingerSpeed(samples, window = SUMMARY_MOTION.spring.window) {
  if (samples.length < 2) return 0;
  const [tn, xn] = samples[samples.length - 1];
  const then = tn - window * 1000;
  let i = samples.length - 2;
  while (i > 0 && samples[i][0] > then) i--;
  const [ta, xa] = samples[i], [tb, xb] = samples[i + 1];
  // The finger's place `window` ago, between the samples either side of it.
  const tw = Math.max(ta, then);
  const xw = tb > ta ? xa + ((xb - xa) * (tw - ta)) / (tb - ta) : xa;
  return tn > tw ? ((xn - xw) * 1000) / (tn - tw) : 0;
}

const css = (b) => `cubic-bezier(${b.join(', ')})`;

export function summaryView(ctx) {
  const { t, page, dispatch, reduceMotion, rtl, payload } = ctx;
  const d = page.data;
  const count = SUMMARY_VARIANTS.length;
  const role = t(`archetype.${d.archetype.id}.name`);
  const yy = String(d.year % 100).padStart(2, '0');

  // The same copy on every card: Figma's.
  const stats = (k) => [
    h('div', { class: 'sc-top' },
      h('p', { class: 'sc-label' }, t('summary.topShows')),
      h('ol', { class: 'sc-shows' }, d.top.map((p, i) => h('li', null, t('summary.rank', { rank: i + 1, title: p.title }))))),
    h('div', { class: 'sc-minutes' },
      h('p', { class: 'sc-label' }, t('summary.minutes')),
      h('p', { class: 'sc-number', 'data-testid': k ? null : 'minutes' }, formatNumber(d.minutes, payload.locale))),
    h('div', { class: 'sc-role' },
      h('p', { class: 'sc-label' }, t('summary.role')),
      h('p', { class: 'sc-role-name', 'data-testid': k ? null : 'role' }, role)),
    h('img', { class: 'sc-mark', src: 'assets/logo.svg', alt: '', width: '21', height: '21' }),
    h('p', { class: 'sc-footer' }, t('summary.footer', { yy })),
  ];
  // What each card shows over its background: the grid, the stack (#1 at the front; fewer
  // shows fill the front slots first), Figma's boxes for the bubbles the backdrop draws.
  const arts = [
    () => h('div', { class: 'sc-grid' }, d.grid.map((p, i) => h('div', { class: 'sc-cover', style: `--c: ${i % 3}; --r: ${Math.floor(i / 3)}` }, artwork(p)))),
    () => h('div', { class: 'sc-stack' }, d.stack.map((p, i) => h('div', { class: 'sc-cover', 'data-slot': String(3 - i) }, artwork(p))).reverse()),
    () => h('div', { class: 'sc-bubbles', 'aria-hidden': 'true' }, SUMMARY_BUBBLES.map((b, i) => h('div', { class: 'sc-bubble', 'data-bubble': String(i), style: `--x: ${b.x}; --y: ${b.y}; --d: ${b.size}` }))),
  ];
  const cards = SUMMARY_VARIANTS.map((v, k) => h('section', {
    class: 'sc-card',
    'data-card': v,
    'data-testid': `summary-card-${v}`,
    role: 'group',
    'aria-roledescription': 'slide',
    'aria-label': t('summary.card', { index: k + 1, count }),
    style: `--k: ${k}`,
    onClick: () => { if (!dragged) go(k, 'page'); },
  }, arts[k](), stats(k)));
  const track = h('div', { class: 'sc-track' }, cards);
  const deck = h('div', { class: 'sc-deck', role: 'region', 'aria-roledescription': 'carousel', 'aria-label': t('summary.cards'), tabindex: '0', 'data-own-swipe': '' }, track);
  const dots = cards.map(() => h('span', { class: 'sc-dot' }));
  const article = h('article', { class: 'page page-summary', 'data-page': page.id },
    h('img', { class: 'sc-logo', src: 'assets/logo.svg', alt: '', width: '31', height: '31' }),
    h('h1', { class: 'story-title sc-title', tabindex: '-1', 'data-testid': 'title' }, t('summary.title', { year: d.year })),
    deck,
    h('div', { class: 'sc-dots', 'aria-hidden': 'true' }, dots),
    h('button', { type: 'button', class: 'pill sc-share', 'data-testid': 'summary-share', onClick: () => dispatch({ type: 'share' }) }, t('summary.share')),
    h('button', { type: 'button', class: 'sc-skip', 'data-testid': 'skip', onClick: () => dispatch({ type: 'next' }) }, t('summary.skip')));

  // ── the carousel ─────────────────────────────────────────────────────────────────
  const M = SUMMARY_MOTION;
  const dir = rtl ? -1 : 1;
  const opened = Math.max(0, SUMMARY_VARIANTS.indexOf(ctx.state.summaryVariant));
  let target = opened, drag = null, dragged = false, lit = -1, watching = 0;

  /** CSS pixels from one card to the next, as laid out now (Figma's 273 pt, scaled with the deck). */
  const pitch = () => Math.abs(cards[1].offsetLeft - cards[0].offsetLeft) || PITCH;
  const transform = (s) => `translateX(${(-dir * s * pitch()).toFixed(3)}px)`;
  /** Where the track is, in cards, animated or not. */
  function position() {
    const m = getComputedStyle(track).transform;
    const x = m && m !== 'none' ? new DOMMatrixReadOnly(m).m41 : 0;
    return -x / (dir * pitch());
  }
  function stop() {
    for (const a of track.getAnimations()) a.cancel();
  }
  /** Hold the track at `s` cards, still. */
  function hold(s) {
    stop();
    track.style.transform = transform(s);
    light();
  }

  /** The nearest card's dot lit, the last one's going out (M.dot). */
  function light(s = position()) {
    const k = Math.max(0, Math.min(count - 1, Math.round(s)));
    if (k === lit) return;
    const was = lit;
    lit = k;
    dots.forEach((dot, i) => dot.toggleAttribute('data-on', i === k));
    if (was < 0 || reduceMotion) return;
    const fade = { duration: M.dot * 1000, easing: 'linear' };
    dots[k].animate([{ opacity: 0.3 }, { opacity: 1 }], fade);
    dots[was].animate([{ opacity: 1 }, { opacity: 0.3 }], fade);
  }
  /** While the track moves, keeps its dot up to date (every frame). */
  function watch() {
    cancelAnimationFrame(watching);
    const tick = () => {
      light();
      if (track.getAnimations().length) watching = requestAnimationFrame(tick);
    };
    watching = requestAnimationFrame(tick);
  }

  /** The card the carousel is on is the flow's variant: what Share shares. */
  function choose(k) {
    target = k;
    cards.forEach((c, i) => {
      c.toggleAttribute('data-current', i === k);
      c.setAttribute('aria-hidden', i === k ? 'false' : 'true');
    });
    if (SUMMARY_VARIANTS[k] !== ctx.state.summaryVariant) dispatch({ type: 'setVariant', variant: SUMMARY_VARIANTS[k] });
  }

  /** On to card `k`: on the video's page move, or (`spring`) settling from a swipe at `speed` cards a second. */
  function go(k, how, speed = 0) {
    k = Math.max(0, Math.min(count - 1, k));
    const from = position();
    if (k !== target) choose(k);
    if (reduceMotion || (how === 'page' && Math.abs(from - k) < 1e-3)) return hold(k);
    stop();
    let animation;
    if (how === 'spring') {
      const course = springCourse(from - k, M.spring.carry * speed, M.spring);
      animation = track.animate(course.map((u) => ({ transform: transform(k + u) })), { duration: ((course.length - 1) / 60) * 1000, easing: 'linear', fill: 'forwards' });
    } else {
      animation = track.animate([{ transform: transform(from) }, { transform: transform(k) }], { duration: M.page.duration * 1000, easing: css(M.page.ease), fill: 'forwards' });
    }
    animation.finished.then(() => { if (target === k && !drag) hold(k); }, () => {});
    watch();
  }

  // A swipe across the deck moves the cards under the finger, never the story: from where it
  // has moved far enough to be a swipe (10 px), so they never jump; past the first and last
  // card they follow it less (M.edge). Lifted, they settle on a card.
  deck.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || e.button > 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, s: position(), from: target, samples: [[performance.now(), e.clientX]], moving: false };
    dragged = false;
  });
  deck.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moving) {
      if (Math.abs(dx) < 10) return;
      if (Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
      drag.moving = dragged = true;
      deck.setPointerCapture?.(e.pointerId);
      drag.s = position();
      drag.x += Math.sign(dx) * 10;
      stop();
    }
    const now = performance.now();
    drag.samples.push([now, e.clientX]);
    while (drag.samples.length > 2 && now - drag.samples[0][0] > 200) drag.samples.shift();
    let s = drag.s - (dir * (e.clientX - drag.x)) / pitch();
    if (s < 0) s *= M.edge;
    else if (s > count - 1) s = count - 1 + (s - (count - 1)) * M.edge;
    track.style.transform = transform(s);
    light(s);
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { moving, samples, from } = drag;
    if (moving) samples.push([performance.now(), e.clientX]);
    drag = null;
    if (!moving) return;
    // The click that ends a drag is not a tap.
    setTimeout(() => { dragged = false; }, 0);
    const speed = (-dir * fingerSpeed(samples)) / pitch();
    const s = position();
    go(settleOn(s, from, speed, count), 'spring', speed);
  };
  deck.addEventListener('pointerup', end);
  deck.addEventListener('pointercancel', end);
  deck.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    e.stopPropagation();
    go(target + ((e.key === 'ArrowRight') === !rtl ? 1 : -1), 'page');
  });

  /** A number or a role wider than its column is drawn smaller, to fit it (`--fit`). */
  function fit() {
    for (const el of article.querySelectorAll('.sc-number, .sc-role-name')) {
      el.style.removeProperty('--fit');
      const room = el.parentElement.clientWidth;
      if (room && el.scrollWidth > room) el.style.setProperty('--fit', (room / el.scrollWidth).toFixed(4));
    }
  }

  choose(opened);
  hold(target);
  // Laid out (and laid out again: a rotation, a resized window), the track is where its card
  // is, and the copy fits.
  const resized = new ResizeObserver(() => {
    if (!article.isConnected) return resized.disconnect();
    fit();
    if (!drag && !track.getAnimations().some((a) => a.playState === 'running')) hold(target);
  });
  resized.observe(deck);
  document.fonts?.ready.then(() => { if (article.isConnected) fit(); });

  return {
    article,
    update(next) {
      Object.assign(ctx, next);
      // The host (or the rig's autoplay) chose another background: show that card.
      const k = SUMMARY_VARIANTS.indexOf(next.state.summaryVariant);
      if (k >= 0 && k !== target) go(k, 'page');
    },
  };
}
