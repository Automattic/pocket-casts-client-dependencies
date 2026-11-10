// `window.Playback`: the native → web surface for anything after first paint.
// Hosts call these through evaluateJavaScript / WebView.evaluateJavascript.

import { startAutoplay } from './autoplay.js';
import { applyAccessibility } from './accessibility.js';

export function installApi(controller, env = {}, backdrop = null) {
  let autoplay = null;
  const api = {
    /** Open a page by id. */
    goTo: (pageId) => controller.dispatch({ type: 'goTo', pageId }),
    next: () => controller.dispatch({ type: 'next' }),
    /**
     * System back (Android gesture, iOS edge swipe). Returns true if the page consumed
     * it by stepping back; false means the host should close the experience.
     */
    back() {
      if (!controller.flow.canGoBack()) return false;
      controller.dispatch({ type: 'back' });
      return true;
    },
    restart: () => controller.dispatch({ type: 'restart' }),
    /**
     * The payload, when the host opened the story before it had it (`PLAYBACK_ENV.pending`):
     * the rest of the story comes in, and if moving on was waiting for it (the intro's title,
     * as Intro 5), the story moves on. A payload the page cannot read shows its error state.
     * Returns true when the story took it; false when it was rejected, or the story already
     * has its data (only the first call counts).
     */
    setData: (payload) => controller.load(payload).ok,
    /** Safe-area insets in CSS px. Android WebViews report env(safe-area-inset-*) as 0. */
    setInsets({ top = 0, right = 0, bottom = 0, left = 0 } = {}) {
      const s = document.documentElement.style;
      s.setProperty('--inset-top', `${top}px`);
      s.setProperty('--inset-right', `${right}px`);
      s.setProperty('--inset-bottom', `${bottom}px`);
      s.setProperty('--inset-left', `${left}px`);
    },
    /**
     * The system's text size, Bold Text and Increase Contrast, when they change after launch (`PLAYBACK_ENV`
     * carries them at launch): `{textScale, boldText, increaseContrast}`. The text size is held
     * to the range the layout supports (host/accessibility.js); returns the scale used.
     */
    setAccessibility: (settings) => applyAccessibility(document, settings),
    /**
     * Lays the story out as the share image (a centred 9:16 box, no chrome, the Pocket Casts
     * badge) while the host takes it, and back again. The backdrop follows the layout. On, it
     * returns the box in CSS px, `{x, y, width, height}`, for the host to crop and scale to
     * 1080 × 1920; off, `null`.
     */
    setCaptureMode(on) {
      document.documentElement.classList.toggle('capture', !!on);
      window.dispatchEvent(new Event('resize'));
      if (!on) return null;
      const { x, y, width, height } = document.getElementById('app').getBoundingClientRect();
      return { x, y, width, height };
    },
    state() {
      const s = controller.flow.getState();
      const page = controller.flow.getPage();
      const { flow } = controller;
      return { pageId: page.id, index: s.index, count: flow.count(), step: flow.step()?.id ?? null, stepsDone: flow.stepsDone(), canGoNext: flow.canGoNext(), answers: flow.answers(), finished: s.finished, summaryVariant: s.summaryVariant, pending: flow.isPending(), waiting: flow.isWaiting() };
    },
    /** Rig only. Tells the host (`autoplayDone`, a dev-only message) when the walkthrough ends. */
    autoplay(opts) {
      autoplay?.stop();
      autoplay = startAutoplay(controller, { ...opts, onDone: () => controller.bridge.send({ type: 'autoplayDone' }) });
    },
    stopAutoplay: () => autoplay?.stop(),
    /**
     * The WebGL backdrop's frame rate, cost and settings, or null when there is none
     * (no WebGL2, disabled, or no page draws one). For measuring on devices.
     */
    backdropStats: () => backdrop?.stats() ?? null,
    /** Backdrop render settings: {resolution, samples, fps}. For device tuning. */
    setBackdropQuality: (q) => backdrop?.setQuality(q),
    /**
     * Rig only: draws the backdrop's current moment now, for frame-exact captures on a fake
     * clock (which runs animation frames on a grid of its own, up to a frame behind).
     */
    drawBackdrop: () => backdrop?.redraw(),
  };
  globalThis.Playback = api;
  return api;
}
