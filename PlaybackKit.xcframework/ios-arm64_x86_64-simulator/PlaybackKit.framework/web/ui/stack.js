// The shows-and-episodes cover stack (Figma "Total listened", moving as the P2's
// "centered covers" video does, measured from it frame by frame; see docs/effects.md).
//
// The top shows, #1 at the front, fan out upwards into Figma's four slots, then cycle
// for as long as the page is open: the front cover drops away and fades, the others
// move up a slot, and the next show grows in at the back. After the last show the deck
// comes round to the first again.
//
// Every cover runs CSS animations generated here (its own keyframes, one loop of the
// deck long), so the stack is a function of the page's clock alone: deterministic,
// paused with the app like the intro, and seekable by the rig (shows-compare.mjs).
// Positions are fractions of the front cover's size, so the stack scales with --u.

import { h } from './dom.js';

/** Figma's slots, front first: size and top, in px of its 393 × 852 frame. */
export const SLOTS = [{ size: 234, top: 171 }, { size: 190, top: 103 }, { size: 146, top: 52 }, { size: 114, top: 0 }];
/** From the back slot's top to the front cover's bottom. */
const STACK_HEIGHT = 405;
/** Shows the deck cycles through at most. */
export const DECK_MAX = 10;

/**
 * The motion, in seconds and fractions of the front cover's size, as measured on the
 * video (30 fps, its phone at 1:1). Times are after the page is entered.
 */
export const STACK_MOTION = {
  // The covers come in once the intro's tagline has gone.
  start: 0.25,
  // All of them rise together (the further back, the slightly earlier), each from
  // further down the further back it sits, so the stack fans out from behind the front
  // cover: 0.33 of a cover, plus 0.1975 per slot. RMS 0.9 px over the first 24 frames.
  rise: { at: [0.053, 0.037, 0.028, 0.02], duration: 1.071, ease: [0.128, 0.507, 0.058, 1.079], from: 0.33, step: 0.1975 },
  // Each fades in on its own beat: the front one first and gently, the rest linearly.
  // (The title and the share button follow at 0.31 s and 0.5 s, over 0.27 s and 0.26 s:
  // playback.css.)
  fade: [
    { at: -0.141, duration: 0.636, ease: [0.677, 0.382, 0, 0.982] },
    { at: 0.008, duration: 0.214 },
    { at: 0.11, duration: 0.202 },
    { at: 0.27, duration: 0.15 },
  ],
  // A cycle every `period`: every cover moves a slot over `move`, on one curve (RMS 0.005
  // of the way over the first cycle).
  first: 1.427,
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

const r = (n, d = 4) => +n.toFixed(d);
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
 * One cover's loop through a deck of E covers in V slots: E cycles, starting where it
 * starts (slot `j`, before its first move) and ending there. Keyframes `{u, y, scale,
 * opacity, z, ease}` (u in seconds into the loop; a key leaves out what it does not
 * set; `ease` is the curve to the next key). Pure, so the deck can be checked.
 */
export function deckFrames(j, E, V, M = STACK_MOTION, slots = SLOTS.slice(0, V)) {
  const L = E * M.period;
  const EPS = 0.001;
  const z = (s) => 2 + V - s;            // front on top
  const EXIT_Z = V + 3, WAIT_Z = 1;
  const back = slots[V - 1];
  const enter = { y: (back.top + (back.size * (1 - M.enter)) / 2 - slots[0].top) / slots[0].size, scale: (back.size * M.enter) / slots[0].size };
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
        const timing = `${r(E * M.period, 3)}s linear ${r(M.start + M.first, 3)}s infinite both`;
        anims.push(`${name} ${timing}`, `${name}-z ${timing}`);
      } else {
        item.style.transform = transform(start);
      }
      if (anims.length) item.style.animation = anims.join(', ');
      else item.style.zIndex = String(2 + V - j);
      if (start) {
        // The entrance, inside the slot's scale: rise from below and fade in.
        const name = `pb-stack-rise-${j}`;
        const fade = M.fade[j] ?? M.fade.at(-1);
        css.push(`@keyframes ${name}{from{transform:translateY(${pct((M.rise.from + M.rise.step * j) / start.scale)})}to{transform:none}}`);
        card.style.animation = [
          `${name} ${M.rise.duration}s ${bezier(M.rise.ease)} ${r(M.start + (M.rise.at[j] ?? M.rise.at.at(-1)), 3)}s both`,
          `pb-fade-in ${fade.duration}s ${fade.ease ? bezier(fade.ease) : 'linear'} ${r(M.start + fade.at, 3)}s both`,
        ].join(', ');
      }
    }
    items.push(item);
  }
  // Front first, so a screen reader reads #1 first; z-index decides what paints on top.
  const list = h('ul', { class: 'stack', style: `--stack-h:${STACK_HEIGHT - base};--front-top:${slots[0].top - base}`, 'aria-label': label }, items);
  return css.length ? [h('style', null, css.join('\n')), list] : [list];
}
