// Puts the current page's (or step's) motion document on the backdrop canvas, under the
// DOM layer.
//
// Only pages that name a document draw one: the intro (per step), shows and episodes,
// the top show, the top 5, the top month, total minutes, the year comparison, the
// completion rate, roles intro, the role, the summary and Play again, so far. Every other
// page keeps the light-red placeholder (--pb-backdrop) until its backdrop is wired in, and the
// canvas is hidden there (its context lives on: creating one costs hundreds of
// milliseconds and a black frame). The flow decides the page and the step; this only follows it. A
// step or page shows one document or a stack of them (`stack`, `from`); a stack that
// carries on into the next step keeps playing, and a quiz page shows its
// `revealBackdrop` once the answer shows. Any other change is a cut to the next
// document at the time the page or step has reached: the intro's documents start and
// end on empty frames, so nothing shows the cut, and the same document carrying on into
// the next page (the intro's wave into shows and episodes) keeps its waves moving where
// they were, only its keyframes jump on; one that comes back later (the wave under the
// top 5, after the top show) carries them on as if they had kept moving while it was
// away. A quiz page shows its `pickBackdrop` once something is picked and its
// `revealBackdrop` once the answer shows (with `options`, the pick's own: the top
// month's picked bubble); within a page, a document that carries on in the same place
// keeps its clock. A backdrop that `replaces` another sends what was showing to its
// document's `exit`, or fades it out underneath (the first stat's wave under the top
// show's logos, the logos under the shape behind the cover). An entry can be placed on
// an element of the page (`anchor`, in a box of its own with `box`) and drawn in the
// page's show's cover colours (`ramp: 'cover'`); a Thermal entry's `text` (a number: the
// user's minutes) is formatted for the locale; an entry's `rates` move parameters on, on
// its own clock (the comparison circles' colour), and its `scrub` moves its document to a
// moment (the completion rate's, the share lit); an anchor that `follow`s is placed afresh
// at every frame (the summary's cards, moving with their carousel), its box's corners rounded
// (`radius`) and cut at another element's box (`within`: a bubble at its card's edge); a
// `sharp` backdrop is drawn at the screen's density, until what it replaces has faded out; an
// entry that `fit`s `'cover'` draws its document's whole canvas as large as the screen (Play
// again's 12, as the P2's video shows it). Going back (PCIOS-1258), what the page come back to
// draws shows as it was once in, its way in done, and crossfades in as what the page left drew
// fades out where it was.
//
// Opt out with PLAYBACK_ENV.backdrop = false (or ?backdrop=0). An object tunes it:
// {resolution, samples, fps} (see fx/backdrop.js). Reduced Motion (the controller's,
// from the host or the system) shows one still frame per document.

import { createBackdrop } from '../fx/backdrop.js';
import { loadBundledDocument } from '../fx/documents/index.js';
import { fadeLevel, holdTime } from '../fx/document.js';
import { readyRamp, showRamp } from './palette.js';
import { formatNumber } from '../core/format.js';
import { BACK_FADE, BACK_SETTLED } from '../core/pages.js';
import { createGovernor, quality, LAST_RUNG } from './governor.js';

// The most buffer pixels a point a `sharp` backdrop is drawn at (see connectBackdrop).
const SHARP_DENSITY = 1.25;

/**
 * @param {ReturnType<import('./app.js').mountPlayback>} controller
 * @param {HTMLCanvasElement} canvas
 * @param {object} env
 */
export function connectBackdrop(controller, canvas, env = {}) {
  const settings = env.backdrop === false ? null : { ...(typeof env.backdrop === 'object' ? env.backdrop : {}) };
  const entries = (spec) => spec?.stack?.layers ?? (spec ? [spec] : []);
  const specs = (p) => [...(p.steps || []).map((s) => s.backdrop), p.backdrop, ...(p.pickBackdrop?.options ? Object.values(p.pickBackdrop.options) : [p.pickBackdrop]), p.revealBackdrop];
  const documentsOf = (pages) => [...new Set(pages.flatMap(specs).flatMap(entries).map((e) => e.document))];
  const ids = controller.ok ? documentsOf(controller.flow.pages) : [];
  // No probe for WebGL2 first: a context costs hundreds of milliseconds, and
  // createBackdrop reports a missing one itself (as a warning, below).
  if (!settings || !ids.length || !canvas) {
    canvas?.remove();
    return { ok: false, destroy() {} };
  }
  const backdrop = createBackdrop(canvas, {
    ...settings,
    still: controller.reduceMotion,
    onError: (e) => controller.bridge.send({ type: 'warning', message: `backdrop: ${e.message || e}` }),
    onWarning: (message) => env.debug && console.warn(message),
  });
  if (!backdrop.ok) {
    canvas.remove();
    return { ok: false, destroy() {} };
  }
  const root = document.documentElement;
  const locale = controller.locale;
  const ground = getComputedStyle(root).getPropertyValue('--pb-ground').trim() || '#2d0004';
  // A `sharp` backdrop (hard-edged shapes: the top show's) is drawn at the screen's
  // density, up to 1.25: drawn at 1 and scaled up, their rims smear and the notches
  // between their slices flicker from frame to frame. The rest stay soft and cheap.
  // 1.25 and not 2 because of what 2 costs: on an iPhone 16 Pro it dropped six pages
  // below 60 fps in a long walk, where 1.25 held them (docs/effects.md, Performance).
  // (`settings.sharp`, a number, sets that density instead, for measuring what it costs.)
  const base = {
    samples: settings.samples ?? 3,
    resolution: settings.resolution ?? 1,
    sharp: typeof settings.sharp === 'number' ? settings.sharp : Math.min(window.devicePixelRatio || 1, SHARP_DENSITY),
  };
  // The degrade ladder (governor.js): a device that cannot keep up gets a cheaper
  // backdrop, a step at a time, for the rest of the session. `rung` 0 is `base`.
  // The performance walk measures a fixed setting, so it keeps the ladder off unless asked.
  let rung = 0;
  let level = quality(0, 0, base);
  const resolutionFor = (spec) => (spec?.sharp ? Math.max(level.resolution, level.sharp) : level.resolution);

  const stats = backdrop.stats;
  backdrop.stats = () => { const s = stats(); return s && { ...s, rung, ladder: governor?.events ?? null }; };

  /** Apply the ladder's current rung to what is drawing. */
  function applyRung(hz) {
    level = quality(rung, hz, base);
    backdrop.setQuality({ samples: level.samples, resolution: resolutionFor({ sharp: current?.sharp }), maxFps: level.maxFps });
  }
  let ladder = 0;
  let governor = null;
  if (settings.ladder !== false && !controller.reduceMotion) {
    const step = (by) => { rung += by; applyRung(governor.displayRate); env.debug && console.warn(`backdrop: rung ${rung}`); };
    governor = createGovernor({ maxRung: LAST_RUNG, onSlow: () => step(1), onRevert: () => step(-1) });
    const watch = (now) => { governor.feed(now, current?.key ?? null); ladder = requestAnimationFrame(watch); };
    ladder = requestAnimationFrame(watch);
  }

  // Loaded up front, so a step never waits on an import. With the host's data still to come,
  // the intro's now and the rest's once the flow has them (`load`, below).
  const docs = new Map();
  let loaded = false;
  let loading = null;
  const preload = (wanted) => {
    loaded = false;
    const done = loading = Promise.all([loading, ...wanted.filter((id) => !docs.has(id)).map(async (id) => {
      try {
        docs.set(id, await loadBundledDocument(id));
      } catch (e) {
        controller.bridge.send({ type: 'warning', message: `backdrop: ${e.message}` });
      }
    })]).then(() => { if (loading === done) loaded = true; });
  };
  preload(ids);

  // What is showing, for carrying a document on into the next show and for showing the
  // same again when the layout moves or a cover's colours arrive.
  let shown = null;
  let current = null;
  // Where each document's free-running motion (Wave's travelling waves) was when it last
  // stopped showing, and when: a document that comes back carries its waves on.
  const motions = new Map();
  let lowering = 0;

  /**
   * Where an anchor's box is on the canvas, and the scale it asks for (CSS pixels): `span`
   * authored pixels across its width, and no more than `spanY` down its height; the frame's
   * centre on the box's, or `offset` authored pixels from it. A boxed one's corners are
   * rounded by `radius` CSS pixels, `edge` authored pixels are drawn past its edge, and
   * `within` clips it to another element's box (its corners rounded by its own `radius`:
   * a summary card's bubble, clipped to its card). One that `follow`s is placed afresh at
   * every frame (a summary card, moving with its carousel).
   */
  function placeOf(anchor) {
    const el = document.querySelector(anchor.selector);
    const r = el?.getBoundingClientRect();
    if (!r?.width) return null;
    const c = canvas.getBoundingClientRect();
    const unit = Math.min(r.width / anchor.span, anchor.spanY > 0 ? r.height / anchor.spanY : Infinity);
    const [dx, dy] = Array.isArray(anchor.offset) ? anchor.offset.map((v) => (Number(v) || 0) * unit) : [0, 0];
    const w = anchor.within && document.querySelector(anchor.within.selector)?.getBoundingClientRect();
    if (anchor.within && !w?.width) return null;
    return {
      x: r.left + r.width / 2 - c.left + dx,
      y: r.top + r.height / 2 - c.top + dy,
      unit,
      box: Boolean(anchor.box),
      rotate: Number(anchor.rotate) || 0,
      ...(anchor.clip === false ? { clip: false, margin: anchor.margin } : {}),
      ...(anchor.radius > 0 ? { radius: anchor.radius } : {}),
      ...(Number.isFinite(anchor.edge) ? { edge: anchor.edge } : {}),
      ...(w ? { within: { x: w.left + w.width / 2 - c.left, y: w.top + w.height / 2 - c.top, w: w.width, h: w.height, radius: anchor.within.radius ?? 0 } } : {}),
    };
  }
  const placed = (anchor) => (anchor.follow ? { ...placeOf(anchor), track: () => placeOf(anchor) } : placeOf(anchor));

  /** The colours a `ramp: 'cover'` entry is drawn in: the page's show, in the document's own mood. */
  const moodOf = (doc) => doc.screens[0]?.layers.find((L) => L.statics?.coverOn)?.statics.coverMood ?? 2;
  const coverRampFor = (page, doc) => (page.data?.podcast ? showRamp(page.data.podcast, moodOf(doc)) : null);

  function sync(action) {
    const { flow } = controller;
    const page = flow.getPage();
    const step = flow.step();
    // A quiz page draws its reveal's document once the answer shows, and its pick's once
    // something is picked (or the pick's own, with `options`, by option id).
    const revealed = !step && Boolean(page.revealBackdrop) && flow.isRevealed();
    const selected = flow.getState().answers[page.id]?.selectedId;
    const pickSpec = page.pickBackdrop?.options ? page.pickBackdrop.options[selected] : page.pickBackdrop;
    const picked = !step && !revealed && Boolean(pickSpec) && selected != null;
    const spec = step ? step.backdrop : revealed ? page.revealBackdrop : picked ? pickSpec : page.backdrop;
    // One key per visit and per document, or per stack: a stack that carries on into
    // the next step has the same key, and keeps playing.
    const visit = `${flow.getState().index}:${flow.getState().visit}`;
    const key = step || spec ? `${visit}:${spec?.stack ? spec.stack.name : step ? step.index : revealed ? 'reveal' : picked ? 'pick' : 'page'}` : null;
    // A reveal in a cover's colours has them read ahead: from the page before, so they are
    // there when it comes in.
    for (const p of [page, flow.pages[flow.getState().index + 1]]) {
      if (p?.revealBackdrop?.ramp === 'cover' && docs.has(p.revealBackdrop.document)) coverRampFor(p, docs.get(p.revealBackdrop.document));
    }
    if (key === shown) return;
    const layers = entries(spec).map((e) => ({ ...e, document: docs.get(e.document), ...(typeof e.text === 'number' && { text: formatNumber(e.text, locale) }) }));
    if (layers.some((e) => !e.document) && !loaded) {
      // Still loading (the first moments of the session): come back when it is there.
      loading.then(() => { if (shown !== key) sync(); });
      return;
    }
    shown = key;
    const drawn = layers.filter((e) => e.document);
    // Seconds into what this shows: the step's, the page's, or none yet when it changes
    // within the visit (the answer showing). A stack's clock starts where the step does
    // (`from`); a lone document runs from its own `from`.
    const sameVisit = current?.visit === visit;
    const since = (step ? step.elapsedMs : sameVisit ? 0 : flow.elapsedMs()) / 1000;
    const at = (spec?.stack ? spec.from ?? 0 : 0) + since;
    const lone = backdrop.document();
    const motion = lone ? backdrop.motionTime() : null;
    // Each entry showing now, at its own time (before any hold).
    const clock = backdrop.clock();
    const own = (e) => clock - (e.delay ?? 0) + (e.from ?? 0);
    if (motion != null) motions.set(lone.id, { motion, at: performance.now() });
    // One showing on its own over what it replaced, still fading out under it, and carried on
    // by what shows now (the intro's wave, washed in as the blob went, under the first stat):
    // where its motion is, from its own clock.
    else if (current?.lone && own(current.lone) >= 0 && layers.some((e) => e.document === current.lone.document)) motions.set(current.lone.document.id, { motion: own(current.lone) + (current.lone.phase ?? 0), at: performance.now() });
    // The document that was showing, carrying on into the next page: its waves go on
    // from where they were. One that showed before, further back, carries them on from
    // where they would be had they kept moving. Stills stay the same every time.
    const back = !sameVisit && drawn.length === 1 && !controller.reduceMotion ? motions.get(drawn[0].document.id) : null;
    if (back) drawn[0].phase = back.motion + (performance.now() - back.at) / 1000 - (since + (drawn[0].from ?? 0));
    // Within the page, a document that carries on, in the same place, keeps its clock
    // (and its waves): a pick only starts the logos' slide, and the picked month's bubble
    // carries on into the answer. What it does from now (its `size`) moves onto that clock.
    // So does one carried on into the next page, when both pages' backdrops say so
    // (`carries`: roles intro's logos into the role's).
    const carried = new Set();
    const carriedOn = new Set();
    if ((sameVisit || (spec?.carries && current?.carries)) && !step && !controller.reduceMotion) {
      for (const e of drawn) {
        // Not one on its way out (fading to nothing: a pick before the last).
        const was = current.entries.find((c) => c.document === e.document && c.anchor?.selector === e.anchor?.selector && !(c.fade?.[2] === 0) && !carried.has(c));
        if (!was) continue;
        carried.add(was);
        carriedOn.add(e);
        const t = own(was);
        const shift = t - since + (e.delay ?? 0) - (e.from ?? 0);
        Object.assign(e, { delay: 0, from: t - since, phase: was.phase });
        if (e.drift) e.drift = { ...e.drift, since: was.drift ? was.drift.since : t };
        if (e.size) e.size = [e.size[0] + shift, e.size[1] + shift, ...e.size.slice(2)];
      }
    }
    // Going back, the page come back to draws what it showed once in, crossfading in over
    // what the page left drew (what carries on between them carries on).
    const backward = action?.type === 'back' && !sameVisit && !step && Boolean(current) && !controller.reduceMotion;
    if (backward) {
      for (const e of drawn) {
        if (carriedOn.has(e)) continue;
        const settled = BACK_SETTLED - (e.delay ?? 0) + (e.from ?? 0);
        const level = fadeLevel(e.fade, settled);
        Object.assign(e, { delay: 0, from: settled - at, fade: [settled, settled + BACK_FADE, level, 0] });
      }
    }
    // What was showing makes way (`replaces`), on its own clock: to its document's exit
    // where it has one (the logos shrinking back), or fading out underneath; going back,
    // fading out as it comes in (BACK_FADE).
    const [a, b] = backward ? [0, BACK_FADE] : spec?.replaces ?? [];
    let replaced = 0;
    if (b != null && current && !controller.reduceMotion) {
      const out = [];
      for (const c of current.entries) {
        const t = own(c), exit = c.document.exit;
        // Where its document is (a hold keeps it on its stretch), so where its exit is.
        const shown = c.hold ? holdTime(t, c.hold) : t;
        // Gone already: faded out, or through its exit.
        if (carried.has(c) || (c.fade?.[2] === 0 && t >= c.fade[1]) || (Number.isFinite(exit) && shown >= c.document.duration)) continue;
        // Where it was last placed, not where its anchor is now: the page it was placed on
        // may be gone already (going back, it leaves at once).
        const gone = c.anchor && !placeOf(c.anchor);
        const frozen = gone && c.lastPlace ? { anchor: null, place: { ...c.lastPlace, track: undefined } } : {};
        if (Number.isFinite(exit) && shown < exit && !backward) {
          out.push({ ...c, ...frozen, delay: 0, from: exit - since, hold: null, loop: false, drift: c.drift && { ...c.drift, since: c.drift.since + (exit - t) } });
        } else {
          out.push({ ...c, ...frozen, delay: 0, from: t - since, fade: [t + a, t + b, 0, fadeLevel(c.fade, t)] });
        }
      }
      drawn.unshift(...out);
      replaced = out.length;
    }
    for (const e of drawn) if (e.ramp === 'cover' && page.data?.podcast) e.colours = readyRamp(page.data.podcast, moodOf(e.document));
    // What a sharp backdrop replaces stays sharp while it makes way underneath.
    const sharp = Boolean(spec?.sharp) || (replaced > 0 && Boolean(current?.sharp));
    current = { key, visit, page, lone: drawn.length - replaced === 1 ? drawn[replaced] : null, entries: drawn, sharp: Boolean(spec?.sharp), carries: Boolean(spec?.carries) };
    // Visible before the first frame, so the buffer is sized from the laid-out canvas.
    // A step without a document is the bare ground, which the page's CSS draws.
    root.classList.toggle('has-backdrop', drawn.length > 0);
    clearTimeout(lowering);
    backdrop.setQuality({ resolution: resolutionFor({ sharp }) });
    if (sharp && !spec?.sharp) {
      const mine = current;
      lowering = setTimeout(() => { if (current === mine) backdrop.setQuality({ resolution: resolutionFor(spec) }); }, b * 1000);
    }
    show(at);
    // A cover's colours arrive once its pixels are read: show the same with them.
    const pending = drawn.filter((e) => e.ramp === 'cover' && e.colours === undefined);
    for (const e of pending) coverRampFor(page, e.document)?.then((ramp) => { if (current?.entries.includes(e) && ramp) { e.colours = ramp; show(backdrop.clock()); } });
  }

  /** Show `current` from `at` on the shared clock, placed on its anchors and in its colours as they are now. */
  function show(at) {
    const list = current.entries.map((e) => ({
      ...e,
      place: e.anchor ? placed(e.anchor) : e.place,
      ramp: e.ramp === 'cover' ? e.colours ?? null : e.ramp,
    }));
    // Where each was placed, for when it makes way and its anchor has gone.
    list.forEach((e, i) => { if (e.place) current.entries[i].lastPlace = e.place; });
    backdrop.show(list.length ? list : null, { ground, at });
  }

  // A layout that moves (rotation, a resized window) moves what is placed on it.
  let relayout = 0;
  const onResize = () => {
    if (!current?.entries.some((e) => e.anchor)) return;
    cancelAnimationFrame(relayout);
    relayout = requestAnimationFrame(() => show(backdrop.clock()));
  };
  window.addEventListener('resize', onResize);

  const unsubscribe = controller.flow.subscribe((state, effects, action) => {
    if (action.type === 'load') preload(documentsOf(controller.flow.pages));
    sync(action);
  });
  sync();
  return {
    ok: true,
    backdrop,
    destroy() {
      unsubscribe?.();
      clearTimeout(lowering);
      cancelAnimationFrame(ladder);
      window.removeEventListener('resize', onResize);
      backdrop.destroy();
      root.classList.remove('has-backdrop');
    },
  };
}
