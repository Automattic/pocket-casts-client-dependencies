// Mounts the experience into a DOM element: the story container (progress, close, share,
// tap and swipe navigation), the current page, the debug HUD, timers and keyboard. All
// decisions live in core/flow.js; this file only renders state and forwards intent.
//
// Navigation is story-style: tap the leading third to go back and the rest to go
// forward, or swipe (except where the page swipes for itself: the top show's carousel,
// and the middle of its screen). Quiz pages block going forward until revealed (the flow decides).
// Back/Next buttons stay in the DOM for keyboards and screen readers, out of sight
// until focused. Transitions between pages are cuts until PCIOS-1258 decides them,
// except where a page's CSS gives it a way out (the intro's tagline fades as the first
// stat comes in, the first stat fades as the top show comes in, the top show fades as
// the top 5 comes in): the outgoing page stays on stage, inert, until that animation
// ends, and the share button goes with it, or fades out with it and comes back with the
// next page (`data-handover`, for that page's CSS).
//
// A page with timed steps (the intro) is rendered once per visit; a step change only
// moves its `data-step`, so the page's own CSS fades from one step to the next. The
// container ticks the flow when the next step is due. A page whose view updates itself
// (the top show: a pick, then the reveal) is also rendered once per visit.

import { h } from './dom.js';
import { coverImage } from './artwork.js';
import { DECK_MAX } from './stack.js';
import { renderPage } from './views.js';
import { createSession } from '../core/session.js';
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

/**
 * @param {HTMLElement} root
 * @param {{payload: unknown, env?: Object, bridge?: {send: (msg: object) => void}, clock?: () => number}} opts
 */
export function mountPlayback(root, { payload, env = {}, bridge = createBridge(env), clock = () => Date.now() }) {
  // The host's setting first (the platform's own is the reliable one), then the system's.
  const reduceMotion = env.reduceMotion ?? globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const session = createSession(payload, { ...env, reduceMotion }, clock);
  root.classList.add('pb-root');
  root.toggleAttribute('data-reduce-motion', reduceMotion);
  root.replaceChildren();
  if (env.platform) document.documentElement.dataset.platform = env.platform;

  if (!session.ok) {
    if (env.loadError) session.errors = [env.loadError];
    // The payload could not be read, but it may still say which language the app is in.
    const locale = displayLocale(payload?.locale ?? env.locale);
    const t = createTranslator(locale);
    root.setAttribute('lang', locale);
    root.setAttribute('dir', isRtl(locale) ? 'rtl' : 'ltr');
    root.append(h('main', { class: 'stage' }, h('article', { class: 'page page-error wireframe' }, h('h1', { class: 'title', 'data-testid': 'title' }, t('error.title')), h('pre', { 'data-testid': 'error-detail' }, session.errors.join('\n')), h('button', { type: 'button', class: 'btn primary', onClick: () => bridge.send({ type: 'close', reason: 'error', finished: false }) }, t('error.close')))));
    bridge.send({ type: 'error', errors: session.errors });
    return { ok: false, errors: session.errors, destroy() {} };
  }

  const { flow, pages } = session;
  const locale = session.payload.locale;
  const t = createTranslator(locale, session.payload.strings);
  const rtl = isRtl(locale);
  root.setAttribute('lang', locale);
  root.setAttribute('dir', rtl ? 'rtl' : 'ltr');
  for (const w of session.warnings) bridge.send({ type: 'warning', message: w });

  // Covers come over the network: the ones the story draws (no page draws past the cover
  // stack's) are fetched now, during the intro, and kept, so they are there when their
  // pages come in.
  const covers = session.stats.ranking.slice(0, DECK_MAX).filter((p) => p.artworkUrl).map((p) => coverImage(p.artworkUrl));

  const dispatch = (action) => flow.dispatch(action);

  const progress = h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '1', 'aria-valuemax': String(pages.length) });
  const segments = pages.map(() => h('span', { class: 'seg' }));
  progress.append(...segments);
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

    // Progress: every page up to and including this one is filled.
    const current = state.index + 1;
    progress.setAttribute('aria-valuenow', String(current));
    progress.setAttribute('aria-label', t('chrome.progress', { current, total: pages.length }));
    segments.forEach((s, i) => s.classList.toggle('done', i < current));

    // Pages drawn over their backdrop sit on the design's ground, not the placeholder.
    document.documentElement.classList.toggle('on-ground', Boolean(page.steps || page.backdrop));

    // Page. The same visit of a stepped page only changes step; a page that updates
    // itself is told what changed.
    const visit = `${state.index}:${state.visit}`;
    const onStage = stage.querySelector(':scope > .page:not([data-leaving])');
    const ctx = { page, state, answer, revealed, step, t, payload: session.payload, dispatch, reduceMotion, rtl };
    let fading = false, entered = false;
    if (step && visit === rendered && onStage) {
      if (onStage.dataset.step !== step.id) setStep(onStage, step);
    } else if (visit === rendered && onStage?.update) {
      onStage.update(ctx);
    } else {
      const view = renderPage(ctx);
      if (step) setStep(view, step);
      fading = leave(onStage);
      entered = true;
      stage.append(view);
      // From its origin: the page before may have left the stage scrolled.
      stage.scrollTo(0, 0);
      view.querySelector('[tabindex="-1"]')?.focus({ preventScroll: true });
      rendered = visit;
    }
    scheduleStep();

    // Share, once there is something to share (a quiz shares its result, not the question),
    // unless the page has a share button of its own (the summary's).
    setShare(page.shareable && revealed && !page.ownShare, fading, entered);
    back.hidden = !isStory || !flow.canGoBack();
    next.hidden = !isStory || !flow.canGoNext();
    renderHud();
  }

  /**
   * Takes the outgoing page off stage: at once, or once the exit animation its CSS
   * gives `[data-leaving]` has played. Anything still leaving from before goes now.
   */
  function leave(page) {
    for (const el of stage.querySelectorAll(':scope > [data-leaving]')) el.remove();
    if (!page) return false;
    page.dataset.leaving = '';
    page.inert = true;
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
    view.dataset.step = step.id;
    view.style.setProperty('--step-t', `${Math.round(step.startsInMs - step.elapsedMs)}ms`);
    root.dataset.step = step.id;
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
    hud.textContent = `${page.id} · ${flow.getState().index + 1}/${pages.length}` + (step ? ` · ${step.id}` : '') + (left == null ? '' : ` · auto-reveal ${Math.ceil(left / 1000)}s`);
  }

  // Effects go to the host; the page never talks to the host any other way.
  flow.subscribe((state, effects, action) => {
    for (const e of effects) bridge.send(e);
    if (action.type === 'share') return;
    // Pausing and resuming change no pixels; re-rendering would only move focus. The
    // page's animations (the intro's steps) stop and start with the clock.
    if (action.type === 'pause' || action.type === 'resume') {
      root.toggleAttribute('data-paused', flow.getState().pausedAt != null);
      return scheduleStep();
    }
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

  // `ready` first, so a host knows the page list before the first `page` event.
  bridge.send({ type: 'ready', pages: pages.map((p) => p.id), archetype: session.archetype.id });
  flow.start();
  // The clocks (the intro's steps, auto-reveal) start with the first frame on screen,
  // not at mount: a web view can mount out of sight, or paint a beat later on a slow
  // device. Animation frames do not run while hidden; visibilitychange resumes too.
  dispatch({ type: 'pause' });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!document.hidden) dispatch({ type: 'resume' });
  }));

  return {
    ok: true,
    session,
    flow,
    dispatch,
    bridge,
    reduceMotion,
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
}

function isRtl(locale) {
  return /^(ar|he|fa|ur)(-|$)/i.test(locale);
}
