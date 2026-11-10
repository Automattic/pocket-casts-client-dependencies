// Mounts the experience into a DOM element: the story container (progress, close, share,
// tap and swipe navigation), the current page, the debug HUD, timers and keyboard. All
// decisions live in core/flow.js; this file only renders state and forwards intent.
//
// Navigation is story-style: tap the leading third to go back and the rest to go
// forward, or swipe (except where the page swipes for itself: the top show's carousel,
// and the middle of its screen). Quiz pages block going forward until revealed (the flow decides).
// Back/Next buttons stay in the DOM for keyboards and screen readers, out of sight
// until focused.
//
// Moving on, where a page's CSS gives it a way out (the intro's tagline fades as the first
// stat comes in, the top month fades as total minutes comes in over it), the outgoing page
// stays on stage, inert, until that animation ends; elsewhere a page change is a cut. The
// share button fades out with the page, or stays where it is when the next page shares too
// (`data-handover`). Going back, the page comes back as it was left, its way in done, and
// crossfades in over the one leaving (BACK_MS); its backdrop does the same (ui/backdrop.js).
// These are PCIOS-1258's; with Reduced Motion, going back is a cut.
//
// The progress bar is a story's (POC-1019): the pages before this one full, the ones after
// empty, and this one's segment filling, linearly, as the page comes in, full once
// everything on it has: its last finite animation (or the share button's) has ended, and
// whatever its steps or backdrop still bring in (`flow.untilShownMs`). What loops for as
// long as the page shows (the cover stack's cycle, the role's shine) does not count. A quiz
// fills half while it asks and the rest as its answer comes in. Only the intro moves on by
// itself, 6.85 s into its title, through its wave into the first stat as its segment fills
// (POC-1020): the rest of the story is tapped through, and quizzes wait for a pick.
//
// The host's data can come late (PCIOS-1324): the app opens the story at once and reads the
// user's listening history while the intro plays (`PLAYBACK_ENV.pending`, then `load`, which
// `Playback.setData` calls). The intro needs no data; the progress bar shows the story's usual
// length until the real one is known. Moving on from the intro's title before the data is there
// (a tap, or the intro moving on by itself) holds it as Figma's Intro 5, the blob carrying on
// and a line saying what it waits for in the tagline's place, and the intro's wave plays as soon
// as the data comes.
//
// A page with timed steps (the intro) is rendered once per visit; a step change only
// moves its `data-step`, so the page's own CSS fades from one step to the next. The
// container ticks the flow when the next step, or the page moving on, is due. A page whose view updates itself
// (the top show: a pick, then the reveal) is also rendered once per visit.

import { h } from './dom.js';
import { coverImage } from './artwork.js';
import { DECK_MAX } from './stack.js';
import { renderPage } from './views.js';
import { BACK_FADE, INTRO_BLOB_OUT } from '../core/pages.js';
import { createSession } from '../core/session.js';
import { PLAYBACK_YEAR } from '../core/config.js';
import { createTranslator, displayLocale } from '../core/copy.js';
import { createBridge } from '../host/bridge.js';

const TICK_MS = 1000;
/** Share of the width, from the leading edge, that steps back on a tap. */
const BACK_ZONE = 1 / 3;
/** A pointer that moves less than this is a tap. */
const TAP_SLOP_PX = 10;
/** A mostly horizontal move longer than this is a swipe. */
const SWIPE_PX = 40;
/** Taps on these do their own thing and never navigate. */
const INTERACTIVE = 'button, a, input, select, textarea, label, [role="button"]';
/** Swipes on these are theirs (the top show's carousel), not the story's. */
const OWN_SWIPE = '[data-own-swipe]';
/** Swipes on these are theirs too, but a tap there is still the story's (the top show's cover). */
const OWN_DRAG = '[data-own-drag]';
/** How much of its segment a quiz fills while it asks; the answer fills the rest. */
const QUIZ_ASKED = 0.5;
/** Going back: how long the page left and the page come back to crossfade, in ms. */
const BACK_MS = BACK_FADE * 1000;

/**
 * @param {HTMLElement} root
 * @param {{payload: unknown, env?: Object, bridge?: {send: (msg: object) => void}, clock?: () => number}} opts
 *   `payload` null with `env.pending`: it comes later, through the returned controller's `load`.
 */
export function mountPlayback(root, { payload, env = {}, bridge = createBridge(env), clock = () => Date.now() }) {
  // The host's setting first (the platform's own is the reliable one), then the system's.
  const reduceMotion = env.reduceMotion ?? globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const session = createSession(payload, { ...env, reduceMotion }, clock);
  root.classList.add('pb-root');
  root.toggleAttribute('data-reduce-motion', reduceMotion);
  root.replaceChildren();
  if (env.platform) document.documentElement.dataset.platform = env.platform;

  /** The page's error state, in place of everything: the payload could not be read. */
  function showError(errors, locale) {
    const t = createTranslator(locale);
    root.setAttribute('lang', locale);
    root.setAttribute('dir', isRtl(locale) ? 'rtl' : 'ltr');
    root.replaceChildren(h('main', { class: 'stage' }, h('article', { class: 'page page-error wireframe' }, h('h1', { class: 'title', 'data-testid': 'title' }, t('error.title')), h('pre', { 'data-testid': 'error-detail' }, errors.join('\n')), h('button', { type: 'button', class: 'btn primary', onClick: () => bridge.send({ type: 'close', reason: 'error', finished: false }) }, t('error.close')))));
    bridge.send({ type: 'error', errors });
  }

  if (!session.ok) {
    if (env.loadError) session.errors = [env.loadError];
    // The payload could not be read, but it may still say which language the app is in.
    showError(session.errors, displayLocale(payload?.locale ?? env.locale));
    return { ok: false, errors: session.errors, destroy() {} };
  }

  const { flow } = session;
  // With the data still to come, the app's language (the host's); a late payload is shown in it too.
  const locale = session.payload?.locale ?? displayLocale(env.locale);
  let t = createTranslator(locale, session.payload?.strings);
  const rtl = isRtl(locale);
  root.setAttribute('lang', locale);
  root.setAttribute('dir', rtl ? 'rtl' : 'ltr');
  for (const w of session.warnings) bridge.send({ type: 'warning', message: w });
  // What the views read from the payload before there is one (the intro's title).
  const placeholder = { year: env.year ?? PLAYBACK_YEAR, locale };

  // Covers come over the network: the ones the story draws (no page draws past the cover
  // stack's) are fetched now, during the intro, and kept, so they are there when their
  // pages come in.
  let covers = [];
  const fetchCovers = () => { covers = session.stats.ranking.slice(0, DECK_MAX).filter((p) => p.artworkUrl).map((p) => coverImage(p.artworkUrl)); };
  if (session.stats) fetchCovers();

  const dispatch = (action) => flow.dispatch(action);

  const progress = h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '1' });
  const segments = [];
  setSegments(flow.count());
  // Closed from the outro, the story is finished (bridge.md).
  const closeReason = () => (flow.getPage().kind === 'outro' ? 'finished' : 'closed');
  const close = h('button', { type: 'button', class: 'close', 'aria-label': t('chrome.close'), 'data-testid': 'close', onClick: () => dispatch({ type: 'close', reason: closeReason() }) },
    h('img', { src: 'assets/close.svg', alt: '', width: '24', height: '24' }));
  const stage = h('main', { class: 'stage', id: 'stage' });
  const share = h('button', { type: 'button', class: 'share-bar', 'data-testid': 'share', onClick: () => dispatch({ type: 'share' }) },
    h('span', { class: 'share-icon' }, h('img', { src: 'assets/share.svg', alt: '', width: '20', height: '20' })),
    h('span', null, t('chrome.share')));
  const badge = h('div', { class: 'share-badge', 'aria-hidden': 'true' },
    h('img', { src: 'assets/share-badge.svg', alt: '', width: '26', height: '26' }),
    h('span', null, t('chrome.shareBadge')));
  const back = h('button', { type: 'button', class: 'step step-back', 'data-testid': 'back', onClick: () => dispatch({ type: 'back' }) }, t('chrome.back'));
  const next = h('button', { type: 'button', class: 'step step-next', 'data-testid': 'next', onClick: () => dispatch({ type: 'next' }) }, t('chrome.next'));
  const hud = h('div', { class: 'hud', 'data-testid': 'hud', hidden: !env.debug });
  root.append(stage, progress, close, share, badge, back, next, hud);

  let rendered = '', stepTimer = 0;
  // Which way the last move went: going back, the page comes back as it was left.
  let direction = 'forward';
  // What moves between two pages outside their CSS (the crossfade back): paused with the
  // app, and done at once when the page changes again.
  const moving = new Set();
  const track = (a) => {
    if (!a) return a;
    moving.add(a);
    const done = () => moving.delete(a);
    a.finished.then(done, done);
    return a;
  };
  // The current segment's fill: the visit and the phase of it it is filling for, and its animation.
  let fill = { visit: '', phase: '', from: 0, to: 0, anim: null };

  function render() {
    const state = flow.getState();
    const page = flow.getPage();
    const answer = page.quiz ? state.answers[page.id] : null;
    const revealed = flow.isRevealed();
    const step = flow.step();

    root.dataset.page = page.id;
    root.dataset.index = String(state.index);
    root.dataset.blocked = String(flow.isBlocked());
    const isStory = page.kind !== 'empty';

    // Progress: every page before this one is filled; this one fills as it comes in (below).
    const current = state.index + 1;
    progress.setAttribute('aria-valuenow', String(current));
    progress.setAttribute('aria-label', t('chrome.progress', { current, total: flow.count() }));
    segments.forEach((s, i) => s.classList.toggle('done', i < state.index));

    // Pages drawn over their backdrop sit on the design's ground, not the placeholder.
    document.documentElement.classList.toggle('on-ground', Boolean(page.steps || page.backdrop));

    // Page. The same visit of a stepped page only changes step; a page that updates
    // itself is told what changed.
    const visit = `${state.index}:${state.visit}`;
    const onStage = stage.querySelector(':scope > .page:not([data-leaving])');
    const ctx = { page, state, answer, revealed, step, t, payload: session.payload ?? placeholder, dispatch, reduceMotion, rtl };
    let fading = false, entered = false;
    if (step && visit === rendered && onStage) {
      if (onStage.dataset.step !== step.id) setStep(onStage, step);
    } else if (visit === rendered && onStage?.update) {
      onStage.update(ctx);
    } else {
      const view = renderPage(ctx);
      if (step) setStep(view, step);
      for (const a of moving) a.finish();
      fading = leave(onStage);
      entered = true;
      stage.append(view);
      if (onStage && direction === 'back' && !reduceMotion) {
        // The page comes back as it was left, its way in done, crossfading in.
        settle(view);
        track(view.animate([{ opacity: 0 }, { opacity: 1 }], { duration: BACK_MS, easing: 'linear' }));
      }
      // From its origin: the page before may have left the stage scrolled.
      stage.scrollTo(0, 0);
      view.querySelector('[tabindex="-1"]')?.focus({ preventScroll: true });
      rendered = visit;
    }
    scheduleStep();

    // Share, once there is something to share (a quiz shares its result, not the question),
    // unless the page has a share button of its own (the summary's).
    setShare(page.shareable && revealed && !page.ownShare, fading, entered);
    if (entered && direction === 'back' && !reduceMotion && !share.hidden && !('leaving' in share.dataset) && !share.hasAttribute('data-handover')) {
      // Back on a page that shares from one that did not: it comes in with the page.
      settle(share);
      track(share.animate([{ opacity: 0 }, { opacity: 1 }], { duration: BACK_MS, easing: 'linear' }));
    }
    setLoading(flow.isWaiting());
    fillSegment(visit, `${revealed}:${step?.index ?? ''}`, state.index, revealed);
    back.hidden = !isStory || !flow.canGoBack();
    next.hidden = !isStory || !flow.canGoNext();
    renderHud();
  }

  /**
   * As many segments as the story has pages (or, while they are still to come, as it usually
   * has). The ones there stay, so the current one's fill carries on as the count changes.
   */
  function setSegments(count) {
    while (segments.length > count) segments.pop().remove();
    while (segments.length < count) {
      const seg = h('span', { class: 'seg' }, h('span', { class: 'seg-fill' }));
      segments.push(seg);
      progress.append(seg);
    }
    progress.setAttribute('aria-valuemax', String(count));
  }

  /**
   * Intro 5, while moving on from the intro waits for the host's data: the tagline gives way
   * to what it waits for, on the blob, which holds (playback.css, pages.js INTRO_STACK).
   */
  function setLoading(waiting) {
    if (waiting === root.hasAttribute('data-waiting')) return;
    root.toggleAttribute('data-waiting', waiting);
    const view = stage.querySelector(':scope > .page-intro:not([data-leaving])');
    const line = view?.querySelector('.intro-loading');
    if (!waiting || !line) return;
    // Its text comes as it shows, so the live region announces it; it stays as it fades out.
    // The tagline does not come back: the wave plays next, into the first stat.
    line.textContent = t('intro.loading');
    view.toggleAttribute('data-waited', true);
  }

  /**
   * Fills the current page's segment from where it is to `to` (all of it, or QUIZ_ASKED of a
   * quiz still asking), linearly, ending once the page has shown everything for now: once its
   * last finite animation (the page's, the share button's) has ended and its own timeline
   * (flow.untilShownMs) has run. Once per phase of a visit (a step, the answer); a pick
   * changes nothing. A new visit starts from empty.
   */
  function fillSegment(visit, phase, index, revealed) {
    if (visit === fill.visit && phase === fill.phase) return;
    const at = visit === fill.visit ? fillFraction() : 0;
    for (const [i, s] of segments.entries()) if (i !== index) s.firstChild.getAnimations().forEach((a) => a.cancel());
    fill.anim?.cancel();
    const to = revealed ? 1 : QUIZ_ASKED;
    const view = stage.querySelector(':scope > .page:not([data-leaving])');
    const ms = Math.max(flow.untilShownMs(), untilSettledMs([...(view?.getAnimations({ subtree: true }) ?? []), ...share.getAnimations()]));
    const anim = segments[index].firstChild.animate([{ transform: `scaleX(${at})` }, { transform: `scaleX(${Math.max(at, to)})` }], { duration: ms, easing: 'linear', fill: 'forwards' });
    if (flow.getState().pausedAt != null) anim.pause();
    fill = { visit, phase, from: at, to: Math.max(at, to), anim };
  }

  /** How much of the current segment is filled now. */
  function fillFraction() {
    const { from, to, anim } = fill;
    if (!anim) return 0;
    const p = anim.effect.getComputedTiming().progress;
    return from + (to - from) * (p ?? (anim.playState === 'finished' ? 1 : 0));
  }

  /** Paused with the flow (the app in the background), on again with it. */
  function pauseFill(paused) {
    const a = fill.anim;
    if (paused && a?.playState === 'running') a.pause();
    else if (!paused && a?.playState === 'paused') a.play();
  }

  /**
   * Takes the outgoing page off stage: at once, once the exit animation its CSS gives
   * `[data-leaving]` has played, or, going back, once it has crossfaded out. Anything still
   * leaving from before goes now.
   */
  function leave(page) {
    for (const el of stage.querySelectorAll(':scope > [data-leaving]')) el.remove();
    if (!page) return false;
    page.dataset.leaving = '';
    page.inert = true;
    if (direction === 'back' && !reduceMotion) {
      const out = track(page.animate([{ opacity: 1 }, { opacity: 0 }], { duration: BACK_MS, easing: 'linear', fill: 'forwards' }));
      out.finished.then(() => page.remove(), () => page.remove());
      return true;
    }
    const exits = page.getAnimations().filter((a) => a.animationName === 'page-leave');
    if (!exits.length) { page.remove(); return false; }
    Promise.all(exits.map((a) => a.finished)).then(() => page.remove(), () => page.remove());
    return true;
  }

  /**
   * Shows or hides the share button; hiding it with a page that fades out fades it too.
   * Shown on a page entered from one that fades out while it showed, it is handed over:
   * the next page's CSS fades it out with the page, then brings it in its own way.
   */
  function setShare(visible, fading, entered) {
    if (entered) share.toggleAttribute('data-handover', visible && fading && !share.hidden && !('leaving' in share.dataset));
    if (visible) {
      delete share.dataset.leaving;
      share.hidden = false;
      return;
    }
    if (share.hidden || 'leaving' in share.dataset) return;
    if (!fading) { share.hidden = true; return; }
    share.dataset.leaving = '';
    const exits = share.getAnimations().filter((a) => a.animationName === 'page-leave');
    const done = () => { if ('leaving' in share.dataset) { delete share.dataset.leaving; share.hidden = true; } };
    if (!exits.length) return done();
    Promise.all(exits.map((a) => a.finished)).then(done, done);
  }

  /**
   * `--step-t` is how far into the step it already is, for animation delays: negative once
   * it has started, positive while it has yet to (the intro after Play again, once the outro
   * has left).
   */
  function setStep(view, step) {
    // Into the way out of the page (the intro's wave): what shows fades from where it is to
    // where that step has it, whatever the step before had reached (a tap can come before its
    // copy is all in), as the blob fades under it (pages.js INTRO_BLOB_OUT).
    const parts = step.transition && view.dataset.step && !reduceMotion ? [...view.children].map((el) => [el, getComputedStyle(el).opacity]) : [];
    view.dataset.step = step.id;
    view.style.setProperty('--step-t', `${Math.round(step.startsInMs - step.elapsedMs)}ms`);
    root.dataset.step = step.id;
    for (const [el, from] of parts) {
      const to = getComputedStyle(el).opacity;
      if (to !== from) track(el.animate([{ opacity: from }, { opacity: to }], { duration: INTRO_BLOB_OUT * 1000, easing: 'cubic-bezier(0.33, 0, 0.67, 1)' }));
    }
  }

  function scheduleStep() {
    clearTimeout(stepTimer);
    const due = flow.step()?.remainingMs;
    if (due == null) {
      if (!flow.step()) delete root.dataset.step;
      return;
    }
    // A paused flow (app in the background) cannot advance; resuming re-renders.
    if (flow.getState().pausedAt != null) return;
    stepTimer = setTimeout(() => {
      dispatch({ type: 'tick' });
      scheduleStep();
    }, due + 10);
  }

  function renderHud() {
    if (!env.debug) return;
    const page = flow.getPage();
    const left = flow.revealCountdownMs();
    const step = flow.step();
    hud.textContent = `${page.id} · ${flow.getState().index + 1}/${flow.count()}` + (flow.isPending() ? ' · data pending' : '') + (step ? ` · ${step.id}` : '') + (left == null ? '' : ` · auto-reveal ${Math.ceil(left / 1000)}s`);
  }

  // Effects go to the host; the page never talks to the host any other way.
  flow.subscribe((state, effects, action) => {
    for (const e of effects) bridge.send(e);
    if (action.type === 'share') return;
    // Pausing and resuming change no pixels; re-rendering would only move focus. The
    // page's animations (the intro's steps) stop and start with the clock.
    if (action.type === 'pause' || action.type === 'resume') {
      const paused = flow.getState().pausedAt != null;
      root.toggleAttribute('data-paused', paused);
      pauseFill(paused);
      for (const a of moving) if (paused) a.pause(); else a.play();
      return scheduleStep();
    }
    direction = action.type === 'back' ? 'back' : 'forward';
    render();
  });

  // Taps and swipes. A swipe is decided on pointerup; a tap waits for its click, so a
  // page rendered under the finger never receives the click that opened it.
  let press = null;
  let swiped = false;
  const storyNav = () => flow.getPage().kind !== 'empty';
  const onPointerDown = (e) => {
    if (!e.isPrimary || e.button > 0) return;
    if (e.target.closest?.(OWN_SWIPE)) { press = null; return; }
    press = { x: e.clientX, y: e.clientY, own: Boolean(e.target.closest?.(OWN_DRAG)) };
    swiped = false;
  };
  const onPointerUp = (e) => {
    if (!press || !e.isPrimary) return;
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    press.moved = Math.hypot(dx, dy) >= TAP_SLOP_PX;
    if (storyNav() && !press.own && Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swiped = true;
      dispatch({ type: (rtl ? dx > 0 : dx < 0) ? 'next' : 'back' });
    }
  };
  const onClick = (e) => {
    const p = press;
    press = null;
    if (swiped) { swiped = false; return; }
    if (!storyNav() || (p && p.moved) || e.target.closest(`${INTERACTIVE}, ${OWN_SWIPE}`)) return;
    // The margins beside the column count as its edges, so a tap there goes the way the nearest edge does.
    const box = root.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    dispatch({ type: (rtl ? x > 1 - BACK_ZONE : x < BACK_ZONE) ? 'back' : 'next' });
  };
  // On the whole screen, not the column (.pb-root is 560 px wide at most): on a tablet or a
  // foldable a tap or a swipe in the margins beside it moves the story too. The body, not the
  // column's parent: the WebGL canvas (a sibling of it) is what is under the finger in a margin.
  const surface = root.ownerDocument?.body ?? root;
  surface.addEventListener('pointerdown', onPointerDown);
  surface.addEventListener('pointerup', onPointerUp);
  surface.addEventListener('pointercancel', () => { press = null; });
  surface.addEventListener('click', onClick);

  const timer = setInterval(() => {
    dispatch({ type: 'tick' });
    renderHud();
  }, TICK_MS);

  const onVisibility = () => dispatch({ type: document.hidden ? 'pause' : 'resume' });
  const onKey = (e) => {
    if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight') dispatch({ type: rtl ? 'back' : 'next' });
    else if (e.key === 'ArrowLeft') dispatch({ type: rtl ? 'next' : 'back' });
    else if (e.key === 'Escape') dispatch({ type: 'close', reason: flow.getPage().kind === 'outro' ? 'finished' : 'closed' });
  };
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('keydown', onKey);

  // `ready` first, so a host knows the page list before the first `page` event. With the data
  // still to come, the list is the intro's alone (`pending`), and `loaded` has the rest.
  bridge.send({ type: 'ready', pages: flow.pages.map((p) => p.id), archetype: session.archetype?.id ?? null, ...(session.pending && { pending: true }) });
  flow.start();
  // The clocks (the intro's steps, auto-reveal) start with the first frame on screen,
  // not at mount: a web view can mount out of sight, or paint a beat later on a slow
  // device. Animation frames do not run while hidden; visibilitychange resumes too.
  dispatch({ type: 'pause' });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!document.hidden) dispatch({ type: 'resume' });
  }));

  /**
   * The host's data, now that it has it (`PLAYBACK_ENV.pending`): the rest of the story. Tells
   * the host (`loaded`), then moves on if moving on was waiting for it. A payload the page
   * cannot read shows the error state, as at mount. Once only: false when the data is already there.
   * @returns {{ok: boolean, errors?: string[]}}
   */
  function load(data) {
    if (!session.pending) return { ok: false, errors: ['the payload is already loaded'] };
    // In the language the story opened in, whatever the payload says.
    const raw = data && typeof data === 'object' && !Array.isArray(data) ? { ...data, locale } : data;
    const result = session.load(raw);
    if (!result.ok) {
      controller.destroy();
      showError(result.errors, locale);
      controller.onFail?.();
      return result;
    }
    t = createTranslator(locale, session.payload.strings);
    for (const w of result.warnings) bridge.send({ type: 'warning', message: w });
    fetchCovers();
    bridge.send({ type: 'loaded', pages: session.pages.map((p) => p.id), archetype: session.archetype.id });
    setSegments(session.pages.length);
    flow.load(session.pages);
    return { ok: true };
  }

  const controller = {
    ok: true,
    session,
    flow,
    dispatch,
    bridge,
    reduceMotion,
    locale,
    load,
    /** Called once a late payload has been rejected and the error state shows (main.js stops the backdrop). */
    onFail: null,
    destroy() {
      clearInterval(timer);
      clearTimeout(stepTimer);
      surface.removeEventListener('pointerdown', onPointerDown);
      surface.removeEventListener('pointerup', onPointerUp);
      surface.removeEventListener('click', onClick);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('keydown', onKey);
      covers.length = 0;
    },
  };
  return controller;
}

/**
 * Shows `el` (and everything in it) as it is once it has come in: every finite animation
 * on it finished, so a page come back to is as it was left rather than replaying a way in
 * timed for coming to it from the page before. What loops for as long as the page shows
 * (the role's shine, the cover stack's cycle) carries on.
 */
function settle(el) {
  for (const a of el.getAnimations({ subtree: true })) {
    const end = a.effect?.getComputedTiming().endTime;
    if (Number.isFinite(end)) a.finish();
  }
}

/**
 * How long until the last of `animations` that ends has ended, in ms from now: those that
 * run on for as long as the page shows (infinite ones) never end, so do not count.
 */
export function untilSettledMs(animations) {
  let ms = 0;
  for (const a of animations) {
    const { endTime } = a.effect?.getComputedTiming() ?? {};
    if (!Number.isFinite(endTime) || a.playState === 'idle') continue;
    ms = Math.max(ms, (endTime - (a.currentTime ?? 0)) / Math.abs(a.playbackRate || 1));
  }
  return ms;
}

function isRtl(locale) {
  return /^(ar|he|fa|ur)(-|$)/i.test(locale);
}
