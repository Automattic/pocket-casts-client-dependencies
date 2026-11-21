// The backdrop an old web view shows (host/legacy.js): stills in place of the WebGL canvas.
//
// Every document the backdrop draws was drawn once, ahead of time, as Reduced Motion shows it
// (rig/scripts/static-backdrop.mjs: by the same engine, each entry alone, matted off the
// ground), and is shown here as an image where the engine would draw it: across the screen,
// or on its anchor at the scale its anchor asks for (ui/backdrop-spec.js), as the page and
// what it shows change. Nothing moves, so nothing needs WebGL, and an old phone's GPU draws
// nothing but images. Three entries carry the user's own numbers, which no still can:
//
// - the completion rate's shape is drawn dim and whole, and lit over it up to the rate;
// - total minutes' Thermal type (the minutes, four rows) is set in the page's own type
//   (`.sb-minutes`, playback.css), over the anchor the engine would draw it on;
// - the top show's shape behind its cover, in the cover's colours, is drawn grey from black
//   to white (where on its ramp each pixel is) and coloured in here with the cover's ramp,
//   read from its pixels as the engine reads it (ui/palette.js), by an SVG filter; in its
//   document's own colours when the cover's cannot be read.
//
// The month bubbles and the comparison circles are the user's: each is drawn on its own
// slot, which the page sizes by the user's listening.

import { STILLS } from './static-stills.js';
import { anchorPlace, backdropNow, columnCentre, entriesOf } from './backdrop-spec.js';
import { formatNumber } from '../core/format.js';
import { normaliseRamp, sampleRamp } from '../fx/ramp.js';
import { DEFAULTS as THERMAL, FONT } from '../fx/thermal.js';
import { loadBundledDocument } from '../fx/documents/index.js';
import { readyRamp, showRamp } from './palette.js';
import { h } from './dom.js';

/** The still an entry of a page's backdrop shows, by page, phase and entry. */
export function stillKey(pageId, phase, entry) {
  return `${pageId}/${phase}/${entry.document}${entry.anchor ? `@${entry.anchor.selector}` : ''}`;
}

/** Where the images are, from the page. */
const BASE = 'assets/static/';

/**
 * @param {ReturnType<import('./app.js').mountPlayback>} controller
 * @param {HTMLElement} layer  where the canvas would be (`#backdrop`)
 */
export function connectStaticBackdrop(controller, layer) {
  const root = document.documentElement;
  const { flow } = controller;
  let shown = null;
  let items = [];
  let raf = 0;
  // Frames left to place again in after a change: the page lays out over its first frames
  // (an old engine's container units and balanced headlines are set by script, after it).
  let settling = 0;
  // An anchor that resizes (a slot sized by those units) is placed on again.
  const anchors = new ResizeObserver(() => place());
  // Total minutes' type is laid out as its document lays it out: read once it has loaded.
  let minutesType = null;
  loadBundledDocument('minutes-listened').then((doc) => { minutesType = typeOf(doc); place(); }, () => {});

  function sync() {
    const { page, spec, phase, selected } = backdropNow(flow);
    const { index, visit } = flow.getState();
    const key = `${index}:${visit}:${phase}:${selected ?? ''}`;
    if (key === shown) return;
    shown = key;
    items = entriesOf(spec).flatMap((entry) => {
      const still = STILLS[stillKey(page.id, phase, entry)];
      if (typeof entry.text === 'number') return [{ entry, minutes: minutesOf(entry.text) }];
      return still ? [{ entry, still, nodes: imagesOf(still, entry, page) }] : [];
    });
    layer.replaceChildren(...items.flatMap((it) => it.nodes ?? [it.minutes]));
    root.classList.toggle('has-backdrop', items.length > 0);
    anchors.disconnect();
    for (const it of items) {
      const el = it.entry.anchor && document.querySelector(it.entry.anchor.selector);
      if (el) anchors.observe(el);
    }
    settling = 30;
    place();
    // What the next page shows, fetched now; a cover's colours read ahead, as the engine's are.
    for (const p of [page, flow.pages[index + 1]]) {
      if (!p) continue;
      preload(p);
      if (p.data?.podcast) for (const [k, s] of Object.entries(STILLS)) if (s.grey && k.startsWith(`${p.id}/`)) showRamp(p.data.podcast, s.mood);
    }
  }

  /** The images an entry shows: its still, and over it what is lit of a scrubbed one (the completion rate). */
  function imagesOf(still, entry, page) {
    const img = (src) => h('img', { src: BASE + src, alt: '', decoding: 'async', draggable: 'false' });
    if (still.grey && entry.ramp === 'cover' && page.data?.podcast) {
      const shape = img(still.src);
      const colour = (ramp) => {
        if (!ramp) return;
        shape.src = BASE + still.grey;
        shape.style.filter = `url(#${rampFilter(ramp)})`;
      };
      const ready = readyRamp(page.data.podcast, still.mood);
      if (ready !== undefined) colour(ready);
      else showRamp(page.data.podcast, still.mood).then(colour);
      return [shape];
    }
    if (!still.lit) return [img(still.src)];
    const lit = img(still.lit);
    // How far it is lit: the share its scrub moves it to, across the lit part's extent.
    const to = entry.scrub ? Math.max(0, Math.min(1, entry.scrub[3])) : 1;
    const [a, b] = still.litSpan ?? [0, 1];
    lit.style.clipPath = `inset(0 ${(100 * (1 - (a + (b - a) * to))).toFixed(2)}% 0 0)`;
    return [img(still.src), lit];
  }

  /** Total minutes' type: the minutes (as many rows as its document sets, setMinutes). */
  function minutesOf(n) {
    const text = formatNumber(n, controller.locale);
    return h('div', { class: 'sb-minutes', 'aria-hidden': 'true' }, ...Array.from({ length: 4 }, () => h('span', { 'data-text': text }, text)));
  }

  /** Puts every item where its anchor is now (again every frame while one follows a moving anchor). */
  function place() {
    cancelAnimationFrame(raf);
    const origin = layer.getBoundingClientRect();
    // Across the screen, centred on the page's column as the engine centres it (fx/backdrop.js
    // `show`'s `centre`): as wide as covers the screen on both sides of it.
    const cx = columnCentre(origin) ?? origin.width / 2;
    const across = 2 * Math.max(cx, origin.width - cx);
    let follows = false;
    for (const it of items) {
      const nodes = it.nodes ?? [it.minutes];
      const { anchor } = it.entry;
      if (!anchor) {
        for (const n of nodes) {
          n.className = 'sb-screen';
          Object.assign(n.style, { left: `${cx - across / 2}px`, right: 'auto', width: `${across}px` });
        }
        continue;
      }
      if (anchor.follow) follows = true;
      const p = anchorPlace(anchor, origin);
      for (const n of nodes) n.style.visibility = p ? '' : 'hidden';
      if (!p) continue;
      if (it.minutes) {
        it.minutes.style.visibility = minutesType ? '' : 'hidden';
        if (minutesType) setMinutes(it.minutes, p, minutesType);
        continue;
      }
      const [x0, y0, x1, y1] = it.still.box;
      const left = p.x + x0 * p.unit, top = p.y + y0 * p.unit, width = (x1 - x0) * p.unit, height = (y1 - y0) * p.unit;
      for (const n of nodes) {
        n.className = 'sb-placed';
        Object.assign(n.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
        // Cut at another element's box (a summary bubble at its card's edge), its corners rounded.
        if (p.within) {
          const w = p.within;
          const inset = [w.y - w.h / 2 - top, left + width - (w.x + w.w / 2), top + height - (w.y + w.h / 2), w.x - w.w / 2 - left].map((v) => `${Math.max(0, v).toFixed(1)}px`);
          const cut = `inset(${inset.join(' ')} round ${w.radius}px)`;
          n.style.clipPath = cut;
        }
      }
    }
    if (follows || settling > 0) {
      settling--;
      raf = requestAnimationFrame(place);
    }
  }

  /** Fetches a page's stills, so they are there when it comes in. */
  function preload(next) {
    const prefix = `${next.id}/`;
    for (const [k, s] of Object.entries(STILLS)) {
      if (!k.startsWith(prefix)) continue;
      for (const src of [s.src, s.lit, s.grey]) if (src) new Image().src = BASE + src;
    }
  }

  const unsubscribe = flow.subscribe(() => sync());
  const onResize = () => place();
  window.addEventListener('resize', onResize);
  sync();
  // The first page's stills decoded: what the story waits for before it shows (main.js).
  const ready = Promise.all([...layer.querySelectorAll('img')].map((img) => img.decode().catch(() => {})));
  return {
    ok: true,
    ready,
    destroy() {
      unsubscribe?.();
      cancelAnimationFrame(raf);
      anchors.disconnect();
      window.removeEventListener('resize', onResize);
      layer.replaceChildren();
      root.classList.remove('has-backdrop');
    },
  };
}

/** SVG filters colouring a grey still in a ramp, by ramp. */
const filters = new Map();

/**
 * An SVG filter mapping grey (black to white: where on its ramp a pixel is) to a ramp's colour,
 * as the engine's ramp texture maps it (fx/ramp.js), sampled at 65 points; its id.
 */
function rampFilter(ramp) {
  const key = JSON.stringify(ramp);
  if (filters.has(key)) return filters.get(key);
  const stops = normaliseRamp(ramp);
  const samples = Array.from({ length: 65 }, (_, i) => sampleRamp(stops, i / 64));
  const id = `sb-ramp-${filters.size}`;
  const ns = 'http://www.w3.org/2000/svg';
  let svg = document.getElementById('sb-filters');
  if (!svg) {
    svg = document.createElementNS(ns, 'svg');
    svg.id = 'sb-filters';
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    document.body.append(svg);
  }
  const filter = document.createElementNS(ns, 'filter');
  filter.id = id;
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  const transfer = document.createElementNS(ns, 'feComponentTransfer');
  ['R', 'G', 'B'].forEach((ch, k) => {
    const f = document.createElementNS(ns, `feFunc${ch}`);
    f.setAttribute('type', 'table');
    f.setAttribute('tableValues', samples.map((c) => c[k].toFixed(4)).join(' '));
    transfer.append(f);
  });
  filter.append(transfer);
  svg.append(filter);
  filters.set(key, id);
  return id;
}

/** Total minutes' type as its document (06) lays it out: Thermal's parameters over its defaults. */
function typeOf(doc) {
  const layer = doc.screens[0].layers.find((L) => L.effect === 'thermal');
  return { ...THERMAL, ...layer?.statics, text: layer?.fx?.text ?? '40,400', ref: [doc.refWidth, doc.refHeight] };
}

/**
 * Sets the minutes as Thermal sets its type (fx/thermal.js layout): its document's frame
 * centred on the place, the type `textSize` of the frame's short edge, rows `lineGap` apart,
 * a number longer than the document's own drawn smaller to take no more room across.
 */
function setMinutes(el, p, T) {
  const text = el.firstChild?.textContent ?? '';
  const rows = Math.max(1, Math.round(T.rows));
  if (el.children.length !== rows) el.replaceChildren(...Array.from({ length: rows }, () => h('span', { 'data-text': text }, text)));
  const S = Math.min(T.ref[0], T.ref[1]) * p.unit;
  const size = (T.textSize / 100) * S;
  const ctx = document.createElement('canvas').getContext('2d');
  const width = (s) => { ctx.font = `900 ${size}px ${FONT}`; return ctx.measureText(s).width; };
  const k = Math.min(1, width(T.text) / Math.max(1e-6, width(text)));
  const w = T.ref[0] * p.unit, h = T.ref[1] * p.unit;
  Object.assign(el.style, {
    left: `${p.x - w / 2 + (w * T.textX) / 100}px`,
    top: `${p.y - h / 2 + (h * T.textY) / 100}px`,
    fontFamily: FONT,
    fontSize: `${(size * k).toFixed(2)}px`,
    lineHeight: `${((T.lineGap / 100) * S * k).toFixed(2)}px`,
    letterSpacing: `${T.tracking / 100}em`,
  });
}
