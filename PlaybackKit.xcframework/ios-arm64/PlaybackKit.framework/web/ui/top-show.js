// The top show (Figma "Top show 1" and "Top show 3", moving as the P2's "most listened"
// video does, measured from it frame by frame; see docs/effects.md).
//
// The guess: "Swipe and select one" over the big cover of the pick, the quiz's options on a
// carousel under it (ui/carousel.js), and "This one!", dim until a show is chosen, as the top
// month's is until a month is (PCIOS-1351): a swipe, an arrow key, or a tap on a cover (the
// big one, or one on the carousel) chooses. Untouched 2 s after the guess has come in, the
// carousel shows its swipe once (the nudge) and "This one!" lights up; a tap on it while it is
// dim shakes it and says what to do. The reveal: the verdict, the
// top show's cover with Creative Lab's shape behind it (ui/backdrop.js anchors it on
// the cover's box here), and the show's details. Both are one page: the view updates
// in place (`update`), so the carousel, the cover and their motion carry across a pick
// and into the reveal. The page's CSS times everything else (playback.css).

import { followTitle, h } from './dom.js';
import { artwork, coverLoaded } from './artwork.js';
import { bezier, CAROUSEL_MOTION, topCarousel } from './carousel.js';

/** The big cover's dip as the carousel passes halfway to the next pick, measured on the video. */
export const DIP = {
  // Into a tap's move, when the pick changes over (the move's halfway point; the
  // video's second move changes over a frame sooner).
  at: 0.493,
  // The cover shrinks to 0.9256 and back, smallest then, down over 0.458 s and up over
  // 0.428 s (RMS 0.23 pt of its width over both moves, aligned on their change over).
  scale: 0.9256,
  down: { duration: 0.458, ease: [0.976, 0.159, 0.771, 0.475] },
  up: { duration: 0.428, ease: [0.269, 0.431, 0, 0.862] },
  // The old cover fades out over the 0.1 s before it, the new one in from 0.033 s before.
  out: 0.1,
  in: [-0.033, 0.067],
};

/** The reveal's cover: from the guess's box to the reveal's, on the carousel's curve (designed: the video's cover does not move). */
const GLIDE = CAROUSEL_MOTION.move;
/** Wrong guesses swap to the answer as the verdict comes in (designed). */
const ANSWER_SWAP_AT = 0.4;

/**
 * PCIOS-1351 (designed): how long after the guess has come in, untouched, the carousel shows
 * its swipe (the nudge, ui/carousel.js), in seconds. Paused time does not count. With Reduced
 * Motion, "This one!" lights up then with nothing moving.
 */
export const NUDGE_AFTER = 2;
/** "This one!" refusing a tap while it is dim: a small shake, in px either way, over seconds. */
const SHAKE = { distance: 6, duration: 0.4 };
/** A cover chosen by a tap gives under the finger. */
const PRESS = { scale: 0.96, duration: 0.3 };
/** Quizzes whose nudge has played: once a session, and "This one!" stays lit after it. */
const nudged = new WeakSet();

const css = (b) => `cubic-bezier(${b.join(', ')})`;

export function topShowView(ctx) {
  const { t, page, dispatch, reduceMotion, rtl } = ctx;
  const quiz = page.quiz;
  const top = page.data.podcast;
  const options = quiz ? quiz.options : [];
  const selected = () => ctx.answer?.selectedId;

  const ask = h('h1', { class: 'story-title tp-ask', tabindex: '-1', 'data-testid': 'title' }, t('topPodcast.quizTitle'));
  // A live region: what a tap on a dim "This one!" says comes here.
  const hint = h('p', { class: 'tp-hint', 'aria-live': 'polite', 'data-testid': 'hint' }, t('topPodcast.quizHint'));
  const guessSlot = h('div', { class: 'tp-slot tp-slot-guess', 'aria-hidden': 'true' });
  const revealSlot = h('div', { class: 'tp-slot tp-slot-reveal', 'data-backdrop-anchor': '', 'aria-hidden': 'true' });
  // Where the guess's two refracted logos are drawn: Figma's boxes for its shader layers.
  const glows = ['a', 'b'].map((k) => h('div', { class: `tp-glow tp-glow-${k}`, 'data-glow': k, 'aria-hidden': 'true' }));
  const inner = h('div', { class: 'tp-cover-inner' });
  const cover = h('div', { class: 'tp-cover' }, inner);
  const verdict = h('h1', { class: 'story-title tp-verdict', tabindex: '-1', role: 'status', 'data-testid': quiz ? 'verdict' : 'title' });
  const details = h('div', { class: 'tp-details' },
    h('p', { class: 'tp-author' }, top.author),
    h('p', { class: 'tp-show' }, top.title),
    h('p', { class: 'tp-listened' }, t('topPodcast.listened', { count: Math.floor(top.playedSeconds / 60) })));

  let shown = null;            // the podcast on the big cover
  function setCover(p, swap) {
    if (shown && p.uuid === shown.uuid) return;
    const old = inner.lastElementChild;
    const art = artwork(p, true);
    shown = p;
    if (!swap || !old || reduceMotion) {
      inner.replaceChildren(art);
      return;
    }
    // The dip (DIP): `mid` ms on performance.now() is when the pick changes over.
    const now = performance.now();
    const mid = swap.mid;
    for (const a of inner.getAnimations()) a.cancel();
    for (const child of [...inner.children].slice(0, -1)) child.remove();
    old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DIP.out * 1000, delay: mid - DIP.out * 1000 - now, fill: 'forwards' }).finished.then(() => old.remove(), () => {});
    art.animate([{ opacity: 0 }, { opacity: 1 }], { duration: (DIP.in[1] - DIP.in[0]) * 1000, delay: mid + DIP.in[0] * 1000 - now, fill: 'backwards' });
    inner.append(art);
    const down = Math.min(DIP.down.duration * 1000, Math.max(1, mid - now));
    inner.animate([
      { scale: 1, easing: css(DIP.down.ease) },
      { scale: DIP.scale, offset: down / (down + DIP.up.duration * 1000), easing: css(DIP.up.ease) },
      { scale: 1 },
    ], { duration: down + DIP.up.duration * 1000, delay: mid - down - now });
  }

  /** A cover chosen by a tap stays where it is: it is the pick now, and the big cover gives under the finger. */
  function choose(option) {
    if (!reduceMotion && !inner.getAnimations().length) {
      inner.animate([{ scale: 1 }, { scale: PRESS.scale, offset: 0.35 }, { scale: 1 }], { duration: PRESS.duration * 1000, easing: 'ease-out' });
    }
    if (option.id !== selected()) dispatch({ type: 'select', optionId: option.id });
  }

  const byId = (id) => options.find((o) => o.id === id);
  const startId = selected() ?? options[0]?.id;
  const carousel = quiz ? topCarousel(options, {
    artwork,
    label: t('topPodcast.quizTitle'),
    start: Math.max(0, options.findIndex((o) => o.id === startId)),
    rtl,
    animate: !reduceMotion,
    onPick(option, move) {
      const now = performance.now();
      setCover(option.podcast, { mid: move ? move.at + (move.settle ? 100 : DIP.at * 1000) : now + DIP.out * 1000 });
      if (option.id !== selected()) dispatch({ type: 'select', optionId: option.id });
    },
    onChoose: choose,
    // The nudge never plays over, or after, the user's own go.
    onTouch: () => wait.cancel(),
    // A tap on the big cover chooses it; elsewhere over the middle it is the story's.
    onTap(e) {
      const r = cover.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return false;
      choose(carousel.pick());
      return true;
    },
  }) : null;
  const confirm = quiz ? h('button', {
    type: 'button',
    class: 'tp-confirm',
    'data-testid': 'confirm',
    onClick: () => {
      if (!ready()) return refuse();
      // The pick is whatever is in the middle, moved there or not.
      const pick = carousel.pick();
      if (pick.id !== selected()) dispatch({ type: 'select', optionId: pick.id });
      dispatch({ type: 'confirm' });
    },
  }, t('topPodcast.confirm')) : null;

  /** "This one!" is lit once a show is chosen, or once the nudge has shown how (PCIOS-1351). */
  const ready = () => selected() != null || nudged.has(quiz);
  function setReady() {
    if (!confirm) return;
    confirm.toggleAttribute('data-ready', ready());
    confirm.setAttribute('aria-disabled', ready() ? 'false' : 'true');
  }

  /** A tap on "This one!" while it is dim: it shakes, and the hint says what to do. */
  function refuse() {
    const text = t('topPodcast.chooseHint');
    if (hint.textContent !== text) hint.textContent = text;
    if (reduceMotion) return;
    hint.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 250, easing: 'ease-out' });
    const d = SHAKE.distance;
    confirm.animate([0, -d, d, -d * 0.66, d * 0.66, -d * 0.33, 0].map((x) => ({ transform: `translateX(${x}px)` })), { duration: SHAKE.duration * 1000, easing: 'ease-out' });
  }

  /**
   * The nudge's wait: NUDGE_AFTER from when the guess has come in (its way in, measured in the
   * first frame it shows), paused with the app (`pause`), cancelled by a touch, a pick or the reveal.
   */
  const wait = {
    left: null, since: 0, timer: 0, paused: ctx.state?.pausedAt != null,
    arm() {
      if (!quiz || ctx.revealed || ready()) return;
      wait.left = Infinity;
      requestAnimationFrame(() => {
        if (wait.left == null) return;
        let entrance = 0;
        for (const a of article.getAnimations({ subtree: true })) {
          const end = a.effect?.getComputedTiming().endTime;
          if (a.playState !== 'idle' && Number.isFinite(end)) entrance = Math.max(entrance, end - (a.currentTime ?? 0));
        }
        wait.left = entrance + NUDGE_AFTER * 1000;
        wait.run();
      });
    },
    run() {
      clearTimeout(wait.timer);
      wait.timer = 0;
      if (wait.paused || wait.left == null || wait.left === Infinity) return;
      wait.since = performance.now();
      wait.timer = setTimeout(nudge, wait.left);
    },
    pause(paused) {
      if (paused === wait.paused) return;
      if (paused && wait.timer) wait.left = Math.max(0, wait.left - (performance.now() - wait.since));
      wait.paused = paused;
      wait.run();
    },
    cancel() {
      clearTimeout(wait.timer);
      wait.timer = 0;
      wait.left = null;
    },
  };

  /** Untouched: the carousel shows its swipe, once, and "This one!" lights up. */
  function nudge() {
    wait.cancel();
    if (!article.isConnected || 'leaving' in article.dataset || ctx.revealed || ready()) return;
    nudged.add(quiz);
    setReady();
    carousel.nudge();
  }

  const article = h('article', { class: 'page page-top-podcast', 'data-page': page.id },
    ...glows, ask, hint, guessSlot, revealSlot, cover, verdict, details,
    quiz ? h('div', { class: 'tp-pick' }, carousel.surface, carousel.el, confirm) : null);
  followTitle(article, ask);

  function setVerdict() {
    const a = ctx.answer;
    const head = !quiz ? t('topPodcast.direct') : a.correct == null ? t('topPodcast.timeout') : a.correct ? t('topPodcast.correct') : t('topPodcast.wrong');
    verdict.replaceChildren(h('span', null, head), h('span', null, t('topPodcast.episodes', { episodes: t('count.episodes', { count: top.episodesPlayed }) })));
  }

  /** Off the guess, onto the reveal: the page's CSS plays the rest from now. */
  function reveal(live) {
    setVerdict();
    const from = cover.getBoundingClientRect();
    article.dataset.phase = live ? 'reveal' : 'result';
    for (const el of [ask, hint]) el.setAttribute('aria-hidden', 'true');
    wait.cancel();
    carousel?.el.setAttribute('inert', '');
    carousel?.surface.setAttribute('inert', '');
    confirm?.setAttribute('inert', '');
    if (live && !reduceMotion) {
      const to = cover.getBoundingClientRect();
      if (to.width) {
        cover.animate([
          { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width})` },
          { transform: 'none' },
        ], { duration: GLIDE.duration * 1000, easing: css(GLIDE.ease) });
      }
      setCover(top, { mid: performance.now() + ANSWER_SWAP_AT * 1000 });
    } else {
      setCover(top);
    }
    if (live) verdict.focus({ preventScroll: true });
  }

  if (ctx.revealed) {
    reveal(false);
  } else {
    article.dataset.phase = 'guess';
    setCover((byId(startId) ?? options[0]).podcast);
    setReady();
    wait.arm();
  }

  return {
    article,
    /** The app in the background, or back: the nudge's wait stops and goes on with it. */
    pause: (paused) => wait.pause(paused),
    /** Resolves once the big cover shows what it will (the answer's, once revealed): app.js waits for it before the answer holds. */
    loaded: () => coverLoaded(inner.lastElementChild),
    update(next) {
      ctx = next;
      // A pick made elsewhere (the host's autoplay, restored answers) moves the carousel to it.
      const id = next.answer?.selectedId;
      if (carousel && id && !next.revealed && carousel.pick().id !== id) carousel.moveTo(id);
      if (id != null) wait.cancel();
      setReady();
      if (next.revealed && article.dataset.phase === 'guess') reveal(true);
    },
  };
}

// Exported for the unit tests: the dip's curve as a function of time from the change over.
export const dipScale = (t) => {
  if (t < -DIP.down.duration || t > DIP.up.duration) return 1;
  return t < 0
    ? 1 - (1 - DIP.scale) * bezier(DIP.down.ease)((t + DIP.down.duration) / DIP.down.duration)
    : DIP.scale + (1 - DIP.scale) * bezier(DIP.up.ease)(t / DIP.up.duration);
};
