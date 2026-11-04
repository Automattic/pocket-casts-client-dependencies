// The top show (Figma "Top show 1" and "Top show 3", moving as the P2's "most listened"
// video does, measured from it frame by frame; see docs/effects.md).
//
// The guess: "Pick one" over the big cover of the pick, the quiz's options on a
// carousel under it (ui/carousel.js), and "This one!". The reveal: the verdict, the
// top show's cover with Creative Lab's shape behind it (ui/backdrop.js anchors it on
// the cover's box here), and the show's details. Both are one page: the view updates
// in place (`update`), so the carousel, the cover and their motion carry across a pick
// and into the reveal. The page's CSS times everything else (playback.css).

import { followTitle, h } from './dom.js';
import { artwork } from './artwork.js';
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

const css = (b) => `cubic-bezier(${b.join(', ')})`;

export function topShowView(ctx) {
  const { t, page, dispatch, reduceMotion, rtl } = ctx;
  const quiz = page.quiz;
  const top = page.data.podcast;
  const options = quiz ? quiz.options : [];
  const selected = () => ctx.answer?.selectedId;

  const ask = h('h1', { class: 'story-title tp-ask', tabindex: '-1', 'data-testid': 'title' }, t('topPodcast.quizTitle'));
  const hint = h('p', { class: 'tp-hint' }, t('topPodcast.quizHint'));
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
  }) : null;
  const confirm = quiz ? h('button', {
    type: 'button',
    class: 'tp-confirm',
    'data-testid': 'confirm',
    onClick: () => {
      // The pick is whatever is in the middle, moved there or not.
      const pick = carousel.pick();
      if (pick.id !== selected()) dispatch({ type: 'select', optionId: pick.id });
      dispatch({ type: 'confirm' });
    },
  }, t('topPodcast.confirm')) : null;

  const article = h('article', { class: 'page page-top-podcast', 'data-page': page.id },
    ...glows, ask, hint, guessSlot, revealSlot, cover, verdict, details,
    quiz ? h('div', { class: 'tp-pick' }, carousel.surface, carousel.el, confirm) : null);
  followTitle(article, ask);

  function setVerdict() {
    const a = ctx.answer;
    const head = !quiz ? t('topPodcast.direct') : a.correct == null ? t('topPodcast.timeout') : a.correct ? t('topPodcast.correct') : t('topPodcast.wrong');
    verdict.replaceChildren(h('span', null, head), h('br'), h('span', null, t('topPodcast.episodes', { episodes: t('count.episodes', { count: top.episodesPlayed }) })));
  }

  /** Off the guess, onto the reveal: the page's CSS plays the rest from now. */
  function reveal(live) {
    setVerdict();
    const from = cover.getBoundingClientRect();
    article.dataset.phase = live ? 'reveal' : 'result';
    for (const el of [ask, hint]) el.setAttribute('aria-hidden', 'true');
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
  }

  return {
    article,
    update(next) {
      ctx = next;
      // A pick made elsewhere (the host's autoplay, restored answers) moves the carousel to it.
      const id = next.answer?.selectedId;
      if (carousel && id && !next.revealed && carousel.pick().id !== id) carousel.moveTo(id);
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
