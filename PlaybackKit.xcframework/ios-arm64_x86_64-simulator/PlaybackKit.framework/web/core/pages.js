// Decides which screens this user sees, in what order, with what data.
//
// A page is a plain description: `kind` picks the view, `data` carries facts (never
// copy), `quiz` marks an interactive page, `motion` names the Creative Lab asset that
// becomes its WebGL background, `steps` (the intro only, so far) is a timed sequence
// inside the page, each step with the motion document it draws (the step it rests on, with
// `ms`, moves the page on by itself once it has run; a last step that is the `transition`
// into the next page runs then, taking no taps, and the page moves on as it ends), `backdrop` is the document a page
// without steps draws, `pickBackdrop` the one a quiz page draws once
// something is picked (or, with `options`, the one for whatever is picked), and
// `revealBackdrop` the one it draws once its answer shows (or straight away when it has
// no quiz). `ownShare` marks a page that draws its own share button (the summary's, Figma's
// pill), so the story's is hidden there. `leaves` is how long a page takes to leave when
// Play again restarts the story from it (seconds): the intro's clock starts once it has gone.
// `shows` is how long after entering a page (or, on a step, after it begins) its backdrop
// is still bringing in what the page shows, when that outlasts the page's own CSS
// animations (seconds): its progress segment fills until then (ui/app.js).

import { seededShuffle } from './random.js';

/** Creative Lab deliverables in `motion/developments deliverables/`, by page kind. */
const MOTION = {
  intro: { effect: 'pattern-refraction, wave', asset: '01 - Intro ring, 02 - intro loading, 03 - wave transition' },
  'shows-and-episodes': { effect: 'wave', asset: '03 - wave transition' },
  'top-podcast': { effect: 'pattern-refraction', asset: 'Figma Top show 1 (composed), 04 - behind the cover visual (coloured as 13 - color-grabbing settings)' },
  // No deliverable is named for it (13 is the top show's answer, re-coloured per cover).
  // Figma draws a picture of a Wave and the P2's video a Wave: the wave comes back.
  'top-shows': { effect: 'wave', asset: '03 - wave transition' },
  'best-month': { effect: 'pattern-refraction', asset: '05 - months visual example 1 (as Figma and the video draw it: composed)' },
  'total-minutes': { effect: 'thermal', asset: '06 - minutes listened' },
  'year-comparison': { effect: 'pattern-refraction', asset: '07 - comparison circles (one per year, as Figma and the video draw them: composed)' },
  'completion-rate': { effect: 'pattern-refraction', asset: '08 - completion rate (lit to the rate over its shape whole, as Figma and the video draw it: composed)' },
  // No deliverable is named for roles intro; Figma draws the role's two logos on it too.
  'roles-intro': { effect: 'pattern-refraction', asset: '09 - your role - visual B (as the role draws it: composed)' },
  archetype: { effect: 'pattern-refraction', asset: '09 - your role - visual B (Figma\'s two logos, as the P2\'s role video draws them: composed)' },
  summary: { effect: 'wave, pattern-refraction', asset: '10, 11 - summary card backgrounds, 07 - summary card with dots (Figma\'s five bubbles, as the P2\'s cards video draws them: composed)' },
  outro: { effect: 'wave', asset: '12 - play again (its canvas covering the screen, as the P2\'s outro video draws it)' },
  // No design of its own (POC-1016): drawn as Play again is, with its own copy.
  empty: { effect: 'wave', asset: '12 - play again (as Play again draws it)' },
};

/**
 * The intro (Figma "Intro 1–4", moving as the P2's intro video does, timed from it
 * frame by frame): the logo on the dark ground; rings coming out from under it and
 * opening onto the sphere; the title as the sphere turns into the blob; then the wave
 * washing in under the tagline. The logo and the rings play through (`locked`: a tap does
 * nothing on them, PCIOS-1324). The title (Intro 3, "Ready to dig in?") is the screen the
 * intro rests on: a tap moves on from it, or it moves on by itself 6.85 s in, when the
 * P2's video starts to fade the blob (POC-1020: nobody should have to tap). Intro 4 is no
 * screen but the way from there into the first stat (`transition`, core/flow.js): the
 * blob fades out with the title and the line at the bottom as the video's does (0.6 s:
 * the wave's `replaces`), the wave washes in under the tagline from the bare ground after
 * it, and the first stat comes in over the wave once it has (2.6 s); a tap does nothing on
 * it. Coming back to the intro shows the title as it is once everything on it has come in
 * (`settled`).
 *
 * The rings and the sphere are one stack on one clock (the sphere is underneath when
 * the rings open), and it plays on from the ring step into the title step (`from`: how
 * far into the stack a step starts). The rings are composed from 01
 * (web/scripts/import-motion.mjs). The sphere is 02 as delivered, started 2.4 s in so
 * it has grown by the time they open, and drawn at the video's size: 0.77 of its
 * authored canvas fitted to the screen, 238 px wide on its 375 px phone. The blob holds
 * whole for as long as the title shows (`hold`, just before 02 breaks it up, BLOB_HOLD), its
 * relief sliding on as 02 slides it (`drift`): the title can wait for a tap, or, as Intro 5,
 * for the data (PCIOS-1324). Moving on fades it out (the wave's `replaces`, over the 0.6 s the
 * video's fade takes, 6.85 s into the title when nobody taps), so the wave washes in from the
 * bare ground. `hold` on the wave would keep it moving, after its entrance, on the stretch
 * before the document moves on to the next page's pose (6 s): the first stat comes in as it
 * reaches it, and carries it on from there.
 */
export const BLOB_HOLD = 8.6;
/** 02's relief slide (cx 50.25 → 80 over 1.5–10.95 s, linearly), in cx a second. */
export const BLOB_SLIDE = 29.75 / 9.45;
const INTRO_STACK = {
  name: 'intro',
  layers: [
    { document: 'intro-loading', delay: 2.4, loop: false, fit: 'canvas', scale: 0.77, hold: [BLOB_HOLD, BLOB_HOLD + 0.01], drift: { rate: [BLOB_SLIDE, 0], since: BLOB_HOLD + 0.01 } },
    { document: 'intro-rings', loop: false },
  ],
};

/**
 * Play again's way out (the outro, at the end of the story): the outro fades out, everything
 * together, linearly over OUTRO_OUT, and the intro starts once it has gone (the outro's
 * `leaves`: the flow starts the intro's clock then), from the bare ground, the outro's wave
 * fading out under it (`replaces`). Opened afresh, there is nothing to replace.
 */
export const OUTRO_OUT = 0.32;
const INTRO_GROUND = { stack: { name: 'intro-ground', layers: [] }, replaces: [0, OUTRO_OUT] };

/** Intro 4, the way from the title into the first stat: the blob fades out, then the wave washes in (its entrance, 1.9 s). */
export const INTRO_BLOB_OUT = 0.6;
export const INTRO_WAVE_IN = 0.68;
export const INTRO_OUT_MS = 2600;

export const INTRO_STEPS = [
  { id: 'logo', ms: 1800, locked: true, backdrop: INTRO_GROUND },
  { id: 'ring', ms: 4750, locked: true, backdrop: { stack: INTRO_STACK, from: 0 } },
  // Everything on it is in 2.2 s in: the tagline (1.8 s) and the blob (02's 4.53 s).
  { id: 'title', ms: 6850, settled: 2200, backdrop: { stack: INTRO_STACK, from: 4.75 } },
  { id: 'wave', ms: INTRO_OUT_MS, transition: true, shows: INTRO_OUT_MS / 1000, backdrop: { document: 'wave-transition', delay: INTRO_WAVE_IN, hold: [2, 5.8], replaces: [0, INTRO_BLOB_OUT] } },
];

/** Reduced Motion: one still composition, the title over the blob, moving on 4 s in. */
export const INTRO_STILL = [{ id: 'still', ms: 4000, backdrop: { document: 'intro-loading', fit: 'canvas', scale: 0.77 } }];

/**
 * Shows and episodes (Figma "Total listened", moving as the P2's "centered covers"
 * video does): the intro's wave carries on, from where the deliverable moves it on to
 * the first stat (6 s), and sinks to the bottom of the screen while it mutes to 0.71
 * of itself against the ground, as the video's does ("the pattern becomes more muted,
 * letting the podcasts be the protagonists"). Then it moves on the stretch after that
 * (`hold`). Reduced Motion: one still of that pose.
 */
export const SHOWS_BACKDROP = { document: 'wave-transition', from: 6, hold: [7.7, 9.9], fade: [6, 6.25, 0.71] };
export const SHOWS_STILL = { document: 'wave-transition', stillAt: 8.5, fade: [6, 6.25, 0.71] };

/**
 * The top show (Figma "Top show 1–3", moving as the P2's "most listened" video does).
 *
 * The guess: Figma's two refracted logos at the top of the screen (composed documents,
 * web/scripts/import-motion.mjs), each drawn in its own Figma box placed on the page
 * (`anchor`, `box`; B turned as Figma turns it). They grow in with the guess (0.25 s in,
 * as the first stat's wave fades out under them: `replaces`), hold, and from the first
 * pick their relief slides on (`drift`: a period every 3.4 s, inwards, as the video's
 * does), on through every pick. The answer is the shape behind the cover, Creative Lab's
 * 04 as Figma and the video draw it (`top-shape`, composed in the importer), in that
 * cover's colours (its `coverMood`, as 13 reads covers): placed behind the cover on the
 * page (the cover there is `span` of its authored pixels across, as in Figma), it grows
 * out from behind the cover, and its relief eases into a slide to the left that carries
 * on as long as the page shows (`drift`, TOP_SHAPE_SLIDE), while the logos shrink back
 * into their corners (their documents' `exit`) and anything else showing fades out
 * (`replaces`). All of it hard-edged, so drawn at the screen's density (`sharp`).
 * Reduced Motion: stills.
 */
const LOGO_DRIFT_PX = -22;
/** The answer's relief once its ease is through (top-shape's `cx` from 3.45 s), in cx a second: the video's. */
const TOP_SHAPE_SLIDE = -6.933;
const logo = (id, span, rotate) => ({
  document: id,
  delay: 0.25,
  loop: false,
  hold: [1.6, 1.61],
  stillAt: 1.6,
  anchor: { selector: `[data-glow="${id.slice(-1)}"]`, span, box: true, ...(rotate ? { rotate } : {}) },
});
const LOGOS = [logo('top-logo-a', 264.517), logo('top-logo-b', 714.372, -58.69)];
/** The relief across its 45° ridges, in % of each box a second. */
const drift = (L, height) => ({ ...L, drift: { rate: [(LOGO_DRIFT_PX * Math.SQRT1_2 * 100) / L.anchor.span, (LOGO_DRIFT_PX * Math.SQRT1_2 * 100) / height] } });
export const TOP_GUESS_BACKDROP = { stack: { name: 'top-guess', layers: LOGOS }, replaces: [0, 0.25], sharp: true };
export const TOP_PICK_BACKDROP = { stack: { name: 'top-pick', layers: [drift(LOGOS[0], 264), drift(LOGOS[1], 712.977)] }, sharp: true };
export const TOP_REVEAL_BACKDROP = { document: 'top-shape', loop: false, anchor: { selector: '[data-backdrop-anchor]', span: 187.8 }, drift: { rate: [TOP_SHAPE_SLIDE, 0], since: 3.45 }, ramp: 'cover', replaces: [0.2, 0.75], stillAt: 2, sharp: true };

/**
 * The top 5 (Figma "Top 5", moving as the P2's top 5 video does): the wave comes back,
 * on the stretch the intro holds it on, fading in from the ground on the video's curve
 * (its backdrop brightens that way, 0.13 s before the frame its take starts on) as the
 * top show's answer, and the shape behind its cover, fade out (`replaces`). Its waves
 * carry on from where shows and episodes left them (ui/backdrop.js). The video's
 * background is another export of the wave, brighter and closer in; the deliverable is
 * what is drawn. Reduced Motion: a still from that stretch.
 */
export const TOP_SHOWS_FADE_IN = { duration: 1.008, ease: [0.73, 1.273, 0.317, 0.609] };
export const TOP_SHOWS_BACKDROP = { document: 'wave-transition', from: 2, hold: [2, 5.8], fade: [2, 2 + TOP_SHOWS_FADE_IN.duration, 1, 0, TOP_SHOWS_FADE_IN.ease], replaces: [0, 0.25] };
export const TOP_SHOWS_STILL = { document: 'wave-transition', stillAt: 3.9 };

/**
 * The top month (Figma "Top month 1–3", moving as the P2's best-months video does,
 * measured from it frame by frame; see docs/effects.md).
 *
 * The way in: the top 5 falls away as its own video's does (playback.css), its wave
 * dimming to the bare ground under it (`replaces`, on that video's clock), and the
 * guess comes in on the ground as the best-months video does, 0.7 s after the tap, as
 * the top 5's last card has faded (TOP_MONTH_IN, the DOM's). A pick turns that month's
 * flat disc into Creative Lab's bubble (`top-month`, composed from 05 in the importer),
 * drawn in the month's own box on the page (`anchor`, `box`), shaded its own way
 * (`values`: MONTH_SHIFT) with a 10 pt bevel at any size (`pixels`); another pick sends
 * it back (`replaces`). The answer turns every month into its bubble, sized by its
 * listening (monthSizes), one after another as the video's do (`delay`), each resizing
 * from the guess's 80 pt with its disc (`size`); the picked one carries on. Hard-edged,
 * so drawn at the screen's density (`sharp`).
 * Reduced Motion: stills.
 */
export const TOP_MONTH_IN = 0.7;
export const TOP_MONTH_GUESS_BACKDROP = { stack: { name: 'top-month-guess', layers: [] }, replaces: [0.55, 1] };

/**
 * The months' discs on the answer, in pt: the top month Figma's 95, the rest by area in
 * proportion to their listening, never under Figma's smallest (36), where the label still
 * fits. Figma's guess has every month at 80.
 */
export const MONTH_SIZE = { guess: 80, top: 95.06, least: 36 };
export function monthSizes(seconds) {
  const top = Math.max(0, ...seconds);
  return seconds.map((s) => +(top > 0 ? Math.max(MONTH_SIZE.least, MONTH_SIZE.top * Math.sqrt(Math.max(0, s) / top)) : MONTH_SIZE.least).toFixed(2));
}

/**
 * The months' motion, measured on the video (seconds; its grid is read in rows, top to
 * bottom, and right to left within a row, `row` and `column` apart):
 *   in: each disc fades in linearly over `fade` as it grows from `scale` to whole over
 *     `grow` on `ease`, the first `first` after the page comes in (fitted to 0.17 pt);
 *   pick: from the tap, the bubble's Depth comes up (its document's 0.3 s) as the flat
 *     disc gives way over `flat` from `flatAt` (both fitted to how the video's brightens),
 *     the label turning white over `label` from `labelAt`;
 *   reveal: from "This one!" (as it gives under the finger), each disc resizes over
 *     `duration` on `ease` (fitted to 0.26 pt RMS), its bubble coming in `metal` into its
 *     resize, as the pick's does.
 */
export const MONTH_MOTION = {
  in: { first: 0.2429, row: 0.048, column: 0.0163, fade: 0.1932, scale: 0.7609, grow: 0.677, ease: [0.04, 1.122, 0.821, 0.988] },
  pick: { flatAt: 0.067, flat: 0.3, labelAt: 0.05, label: 0.1, out: 0.3 },
  reveal: { first: 0.042, row: 0.0492, column: 0.0144, duration: 0.8606, ease: [0.839, -0.042, 0.213, 1], metal: 0.333 },
};
/** When month `m` (0 = January) starts to move in `motion`'s stagger. */
export const monthAt = (m, { first, row, column }) => first + Math.floor(m / 3) * row + (2 - (m % 3)) * column;

/**
 * Each month's bubble is a different part of 05's field (Phase, Evolution), as Figma's and
 * the video's months are each shaded their own way: per month, the one closest to the
 * video's bubble (block-averaged colour, on a 5-step grid; none is close, the video's
 * metal is not 05's: docs/effects.md).
 */
export const MONTH_SHIFT = [[60, 40], [10, 70], [0, 50], [25, 85], [95, 75], [0, 55], [45, 25], [50, 85], [15, 10], [75, 15], [5, 75], [10, 25]];
/** The bubble document's width in its own units (web/scripts/import-motion.mjs TOP_MONTH). */
const BUBBLE_SPAN = 36;
/** The bevel, in pt at any size (Figma's and the video's Rounding). */
const BEVEL = 10;
// As wide as the month's flat disc, as the video's are (its picked month is as wide as
// the flat ones): drawn unclipped, its silhouette kept on its outline (`outline`).
const bubble = (m, extra = {}) => ({
  document: 'top-month',
  loop: false,
  hold: [0.3, 6],
  stillAt: 2,
  values: { mPhase: MONTH_SHIFT[m][0], mEvolution: MONTH_SHIFT[m][1] },
  pixels: { mRounding: BEVEL },
  outline: true,
  anchor: { selector: `[data-month="${m}"] .tm-slot`, span: BUBBLE_SPAN, box: true, clip: false, margin: 3 * BEVEL },
  ...extra,
});
export const topMonthPick = (m) => ({ stack: { name: `top-month-pick-${m}`, layers: [bubble(m)] }, replaces: [0, MONTH_MOTION.pick.out], sharp: true });
export function topMonthReveal(sizes) {
  const { duration, ease, metal } = MONTH_MOTION.reveal;
  return {
    stack: {
      name: 'top-month-reveal',
      layers: sizes.map((size, m) => bubble(m, { delay: monthAt(m, MONTH_MOTION.reveal) + metal, size: [-metal, duration - metal, MONTH_SIZE.guess / size, ease] })),
    },
    sharp: true,
  };
}

/**
 * Where a page fades out as it leaves (the top month on to Play again), it fades out over
 * PAGE_OUT (everything together, linearly, as the P2's videos' ways out do) and the next starts
 * coming in OVERLAP_IN after the tap, a third of the way into that fade rather than once it has
 * gone, so the screen is never the bare ground in between (PCIOS-1258). A page whose video
 * opens on the bare ground starts that much earlier (COMPARISON_IN, COMPLETION_IN).
 */
export const PAGE_OUT = 0.32;
export const OVERLAP_IN = 0.1;
/**
 * Going back, the page comes back as it was left, its way in done: as it is BACK_SETTLED s
 * into its visit (every page's way in is done by then: the longest, the completion rate's
 * sweep, by COMPLETION_SHOWN), what holds or loops carrying on from there. It crossfades in
 * over BACK_FADE as the page left fades out, what each draws with it (ui/app.js, ui/backdrop.js).
 */
export const BACK_FADE = 0.22;
export const BACK_SETTLED = 4;

/**
 * Total minutes (Figma "Total minutes listened", moving as the P2's minutes video does,
 * measured from it frame by frame; see docs/effects.md).
 *
 * The number is Creative Lab's 06 (Thermal) with the user's minutes as its type (`text`,
 * formatted for the locale by ui/backdrop.js), drawn as the video draws 06: its canvas at
 * 0.451 pt a pixel on the video's 375 pt phone, so the type takes 0.9 of the screen's width
 * (Figma's 0.91), centred in the space Figma leaves it between the copy and the share
 * button (`anchor`: across that space's width `span` pixels, never taller than it, `spanY`).
 * Two things are the video's, not 06's: the colour drifts 0.339 cycles a second (06 has
 * 0.33) and the type is centred (06 draws it 1.6 pt right, `textX` 50.37). Its glyphs' thin
 * contours want the screen's density (`sharp`).
 *
 * The video has no way in (it opens on the page settled), so the way in is designed: the
 * top month fades out, everything together, linearly over 0.32 s, as its own video's way
 * out does (its bubbles under it: `replaces`), and the page comes in over it (MINUTES_IN) as
 * the top 5 does, the number fading in from the ground on the curve the top 5's wave does
 * (`fade`), the copy and the share button after it (playback.css, from MINUTES_IN). Without
 * a month to guess, the page follows the top 5, which falls away as it does into the top
 * month, its wave dimming to the ground, and the page comes in 0.7 s after the tap.
 * Reduced Motion: a still (the engine's, of the page as it settles).
 */
export const MINUTES_IN = OVERLAP_IN;
export const MINUTES_MOTION = { drift: 0.3394, textX: 50, span: 831.3, spanY: 902 };
export function minutesBackdrop(minutes, { afterTopShows = false } = {}) {
  return {
    document: 'minutes-listened',
    text: minutes,
    values: { speed: MINUTES_MOTION.drift, textX: MINUTES_MOTION.textX },
    anchor: { selector: '.mn-number', span: MINUTES_MOTION.span, spanY: MINUTES_MOTION.spanY },
    delay: afterTopShows ? TOP_MONTH_IN : MINUTES_IN,
    fade: [0, TOP_SHOWS_FADE_IN.duration, 1, 0, TOP_SHOWS_FADE_IN.ease],
    replaces: afterTopShows ? TOP_MONTH_GUESS_BACKDROP.replaces : [0, PAGE_OUT],
    sharp: true,
  };
}

/**
 * The year comparison (Figma "Year comparison", node 1002-10893, moving as the P2's
 * comparing video does, measured from it frame by frame; see docs/effects.md).
 *
 * Two touching circles, a year each, sized by its listening (comparisonLayout): Creative
 * Lab's 07, one per circle (`comparison-circle`, composed in the importer), drawn on each
 * circle's slot on the page (`anchor`), each shaded its own way, as Figma's are (`values`:
 * Figma's Phase and Evolution for that place), its colour drifting at the video's pace on its
 * own clock, never jumping at 07's loop (`rates`). The look is 07's; the video draws circles
 * of a material of its own (docs/effects.md). Their rims want the screen's density (`sharp`).
 *
 * The way in is designed (the total minutes video has no way out): total minutes fades out,
 * everything together, linearly over 0.32 s, as this video's own way out and the best-months
 * video's do (its number under it: `replaces`), and the page comes in over it as the video
 * does: each circle fades in (`fade`) as it grows on 07's entrance at the video's pace (its own
 * start, `grow`), its label fading in as it scales up about its centre; the copy, then the share
 * button (playback.css). The video opens on the bare ground, its circles fading in from 0.25 s,
 * so the page starts 0.2 s into it at the tap (COMPARISON_IN): the circles are there as total
 * minutes goes. Reduced Motion: a still.
 */
export const COMPARISON_IN = -0.2;
export const COMPARISON_MOTION = {
  // Each circle fades in from `at` over `fade` on `ease`, so it brightens as the video's does
  // (07's flat start is brighter than its settled metal, up to twice, each circle's shade its
  // own way: measured on the app's and divided out), and grows on its document's entrance
  // from `grow`.
  left: { at: 0.2792, fade: 0.6971, ease: [0.837, 0.077, 0.77, 0.531], grow: 0.2956 },
  right: { at: 0.2535, fade: 0.8329, ease: [0.446, 0, 0.926, 1], grow: 0.3395 },
  // Each label fades in as it scales up from 0.933 (playback.css): its own opacity (the tracker
  // under-reads a label while it is scaled, which was measured on the app's and divided out of
  // the video's).
  label: { at: 0.25, fade: 0.8174, ease: [0.475, -0.265, 0.472, 1], scale: 0.9334, scaleAt: 0.506, scaleFor: 0.7275 },
  // The colour's drift, as a rate on 07's Offset (a second): the video's pace, 0.64 of 07's
  // (38 to 2 over its 7 s). Its 2025 circle is most magenta at 6.6 s, where 07's pace has it at
  // 4.2 s; fitted on both circles' colour, 0.57–0.73 of 07's fit about as well (the video's
  // material is not 07's).
  drift: -3.27,
};
/**
 * 07's circle across the circle's slot, in its authored pixels: its disc is 96% of its 432 px
 * frame, filled from the middle and fading out from 0.74 of its radius (its radial fill), so
 * its silhouette (the blurred coverage cut at half) is 0.87 of that, as wide as Figma's circle.
 */
const CIRCLE_SPAN = (0.96 * 432 * (1 + 0.74)) / 2;

/**
 * Where Figma puts the circles, in pt from the middle of the space between the copy and the
 * share button (Figma's 163–769): the larger on the right (its centre `right`), the smaller
 * touching it along `axis`, their radii summing to `sum`, as Figma's 225 and 386.5 pt do. The
 * larger never outgrows Figma's (`maxRadius`); past that, the smaller shrinks towards it, never
 * under `minRadius`, where its label still fits. Going down, the pair is turned upside down
 * about its middle (`flip`), so the larger, last year's, is on top, clear of the copy. The
 * right circle's label is pulled in from the screen's edge to Figma's (`labelMax`).
 */
export const PAIR = { sum: 305.75, maxRadius: 193.25, minRadius: 65, right: [139, 60], axis: [0.84075, 0.54142], flip: 35.25, labelMax: 103 };
/** Figma's Phase and Evolution for each place, over 07's (its circles are shaded their own way). */
const CIRCLE_SHADE = { left: { mPhase: 48, mEvolution: -50 }, right: { mPhase: -12, mEvolution: -21 } };

/**
 * The two circles: this year's on the right and last year's on the left (going down, the other
 * way round), each `r` pt in radius, its centre and its label's `x`, `y` and `labelX` from the
 * pair's middle (pt, Figma's frame).
 */
export function comparisonLayout({ previousSeconds, totalSeconds, direction }, year) {
  const down = direction === 'down';
  const right = down ? { year: year - 1, seconds: previousSeconds } : { year, seconds: totalSeconds };
  const left = down ? { year, seconds: totalSeconds } : { year: year - 1, seconds: previousSeconds };
  const both = Math.max(1, right.seconds + left.seconds);
  let R = (PAIR.sum * right.seconds) / both, r = (PAIR.sum * left.seconds) / both;
  if (R > PAIR.maxRadius) {
    R = PAIR.maxRadius;
    r = Math.max(PAIR.minRadius, (R * left.seconds) / Math.max(1, right.seconds));
  }
  const [x, y] = [PAIR.right[0], down ? PAIR.flip - PAIR.right[1] : PAIR.right[1]];
  const [ax, ay] = [PAIR.axis[0], down ? -PAIR.axis[1] : PAIR.axis[1]];
  const lx = x - (R + r) * ax, ly = y - (R + r) * ay;
  const round = (v) => +v.toFixed(2);
  return [
    { ...left, side: 'left', r: round(r), x: round(lx), y: round(ly), labelX: round(lx) },
    { ...right, side: 'right', r: round(R), x, y, labelX: Math.min(x, PAIR.labelMax) },
  ];
}

export function comparisonBackdrop(circles) {
  const { drift } = COMPARISON_MOTION;
  // The larger first, under the other, as Figma has them.
  const order = [...circles].sort((a, b) => b.r - a.r);
  return {
    stack: {
      name: 'year-comparison',
      layers: order.map((c) => {
        const { at, fade, ease, grow } = COMPARISON_MOTION[c.side];
        const from = at - grow;
        return {
          document: 'comparison-circle',
          loop: false,
          delay: COMPARISON_IN + at,
          from,
          fade: [from, from + fade, 1, 0, ease],
          values: CIRCLE_SHADE[c.side],
          rates: { mOffset: drift },
          anchor: { selector: `[data-side="${c.side}"] .yc-slot`, span: CIRCLE_SPAN },
          stillAt: 2,
        };
      }),
    },
    replaces: [0, PAGE_OUT],
    sharp: true,
  };
}

/**
 * The completion rate (Figma "Completion rate", node 1002-9133, moving as the P2's percentage
 * video does, measured from it frame by frame; see docs/effects.md).
 *
 * Creative Lab's 08 as Figma and the video draw it (`completion-reveal`, composed in the
 * importer): its shape whole, dimmed, and over it lit from the left up to the user's rate, the
 * composed document's clock being the share lit (`scrub`, to `percent / 100`). Placed where
 * Figma's picture is (`.cr-slot`, Figma's 361 × 362 pt box): 08's lit width as wide as Figma's
 * (`span` of its authored pixels across the box) and its middle on Figma's (`offset`, authored
 * pixels from the box's centre: 08 draws its shape left of and above its frame's centre).
 * Hard-edged, so drawn at the screen's density (`sharp`).
 *
 * The way in is designed, as the year comparison's was: the page before (the year comparison,
 * or total minutes without one) fades out, everything together, linearly over 0.32 s, as the
 * comparing video's way out does, what it drew fading out underneath (`replaces`), and the
 * page comes in over it as the video does: the shape whole fading in (`fade`), then lit from the
 * left (`sweep`), the copy and the share button meanwhile (playback.css). As the year
 * comparison's, the video opens on the bare ground, its shape fading in from 0.22 s, so the page
 * starts 0.15 s into it at the tap (COMPLETION_IN). Reduced Motion: a still, lit to the rate.
 */
export const COMPLETION_IN = -0.15;
export const COMPLETION_MOTION = {
  // The shape whole fades in from `at` over `fade` on `ease` (the video's, to 0.015).
  whole: { at: 0.2206, fade: 0.6717, ease: [0.508, 0.114, 0.171, 0.933] },
  // Then it is lit from the left, the share lit moving to the rate from `at` over `duration`
  // on `ease`, whatever the rate (fitted so the lit area grows as the video's does, to 0.008 of
  // its settled area, through the app's own area at each share).
  sweep: { at: 0.9317, duration: 2.7467, ease: [0.2328, 1, 0.5053, 1] },
};
/** Figma's picture box (361 pt across), in 08's authored pixels, and where 08's frame centre sits from its centre. */
export const COMPLETION_SHAPE = { span: 503.9, offset: [7.28, 21.72] };
/** When the shape is lit to the rate, after entering the page (its `shows`): later than the copy settles. */
export const COMPLETION_SHOWN = COMPLETION_IN + COMPLETION_MOTION.sweep.at + COMPLETION_MOTION.sweep.duration;

export function completionBackdrop(percent) {
  const { whole, sweep } = COMPLETION_MOTION;
  return {
    document: 'completion-reveal',
    loop: false,
    // Started before the page (COMPLETION_IN < 0), that far into its document.
    delay: Math.max(0, COMPLETION_IN),
    from: Math.max(0, -COMPLETION_IN),
    fade: [whole.at, whole.at + whole.fade, 1, 0, whole.ease],
    scrub: [sweep.at, sweep.at + sweep.duration, 0, Math.max(0, Math.min(1, percent / 100)), sweep.ease],
    anchor: { selector: '.cr-slot', ...COMPLETION_SHAPE },
    stillAt: sweep.at + sweep.duration,
    replaces: [0, PAGE_OUT],
    sharp: true,
  };
}

/**
 * Roles intro and the role (Figma "Roles intro", node 1031-32538, and "Role 1–5", nodes
 * 1002-9328 to 9394, the role moving as the P2's role video does, measured from it frame by
 * frame; see docs/effects.md).
 *
 * Both draw Figma's two logos (its shader layers on the Pocket Casts logo): A, a disc at the
 * bottom left, and B, a disc in the corner of a box turned -58.69° at the top right, only its
 * refracted edge on screen, each in its Figma box on the page (`anchor`, `box`). The video draws
 * them with 09 B's layer (its Waves relief, its metal, its palette, its slide), not Figma's, so
 * they are composed from 09 B (`role-logo-a`, `role-logo-b`, web/scripts/import-motion.mjs),
 * their relief fitted to the video's. They grow in as the video's do, their relief slides across
 * its ridges a period every 4.02 s (09 B's pace, the video's: `drift`), and they shrink back on
 * the way out (their documents' `exit`). Hard-edged, so drawn at the screen's density (`sharp`).
 *
 * Roles intro comes in (ROLES_IN) as the page before it fades out (the completion rate's
 * video's way out: `replaces`); the role's backdrop is the same logos, carried on with their clock
 * (`carries`), so only the copy changes; opened on the role, they grow in as the video's. The
 * summary after it replaces them, so they shrink back under its cards (SUMMARY_BACKDROP).
 * Reduced Motion: stills.
 */
export const ROLES_IN = OVERLAP_IN;
/** Each logo's box (Figma's, pt), how it is turned, and its relief's slide (% of the box a second). */
export const ROLE_LOGO = {
  a: { span: 243, rotate: 0, drift: [5.0004, 3.1066] },
  b: { span: 714.372, rotate: -58.69, drift: [1.6367, 1.0549] },
};
const roleLogo = (k, delay) => ({
  document: `role-logo-${k}`,
  delay,
  loop: false,
  hold: [2, 2.01],
  stillAt: 2,
  anchor: { selector: `[data-glow="role-${k}"]`, span: ROLE_LOGO[k].span, box: true, ...(ROLE_LOGO[k].rotate ? { rotate: ROLE_LOGO[k].rotate } : {}) },
  drift: { rate: ROLE_LOGO[k].drift, since: 0 },
});
const roleLogos = (delay) => ['b', 'a'].map((k) => roleLogo(k, delay));
export const ROLES_INTRO_BACKDROP = { stack: { name: 'roles-intro', layers: roleLogos(ROLES_IN) }, replaces: [0, PAGE_OUT], carries: true, sharp: true };
export const ARCHETYPE_BACKDROP = { stack: { name: 'archetype', layers: roleLogos(0) }, carries: true, sharp: true };
/** The role's way out, from the tap (playback.css): its logos shrink back by then. */
export const ARCHETYPE_OUT = 1.41;

/**
 * The summary (Figma "Summary 1–3", nodes 1002-9410, 9673, 9766, moving as the P2's cards video
 * does, measured from it frame by frame; see docs/effects.md).
 *
 * Three cards on a carousel, the same data on each, only the background changing: Creative
 * Lab's 10 and 11 (Wave) and, on the third, Figma's five bubbles drawn with 07 - summary card
 * with dots (`summary-bubble`, composed in the importer: 07 is one bubble) over Figma's dark
 * ground (`summary-ground`). Each is drawn in its card's box on the page (`anchor`, `box`, its
 * corners rounded as the card's), following the card as the carousel moves (`follow`); each
 * bubble in its Figma box, clipped to its card (`within`), shaded its own way (`values`), its
 * colour drifting on the page's clock (`rates`), as the video's do whether the card shows or not.
 * Hard-edged (the bubbles, the cards' corners), so drawn at the screen's density (`sharp`).
 *
 * The way in is designed (the video opens on the page settled): the role goes as its video's
 * way out does, its logos shrinking back under the summary (`replaces`), and the summary comes in
 * as they shrink back (SUMMARY_IN), the role's name still sweeping out: the cards fade in, their backgrounds with them (`fade`, on the
 * DOM's curve, playback.css), as they rise. The way out (on to Play again) fades everything out
 * linearly over SUMMARY_OUT, the cards' backgrounds under Play again's wave (OUTRO_BACKDROP).
 * Reduced Motion: stills.
 */
export const SUMMARY_IN = 0.8;
export const SUMMARY_OUT = 0.32;
/** The cards' entrance (playback.css `.sc-card`), from SUMMARY_IN: their backgrounds fade in with them. */
export const SUMMARY_CARD_IN = { at: 0.205, fade: 0.234 };
/** Figma's card (pt) and the corner its backgrounds are rounded to. */
export const SUMMARY_CARD = { width: 265, height: 469, radius: 4 };
/**
 * Figma's bubbles on the third card (its PC_Logo layers, a disc each): box left, top and width
 * in pt from the card's top left, and the part of 07's field each shows (Phase, Evolution), as
 * Figma's are each shaded their own way. `share`: the same bubble's box on the card's share
 * frame (393 × 853 pt, the QA page's node 1439-20238), enlarged, bleeding off its edges.
 */
export const SUMMARY_BUBBLES = [
  { x: -18, y: -9, size: 86.066, shade: [-12, -50], share: { x: -28, y: 25, size: 106 } },
  { x: 237, y: 188, size: 86.066, shade: [24, -14], share: { x: 329, y: 407, size: 106 } },
  { x: 117, y: 415, size: 92.078, shade: [-40, 20], share: { x: -20, y: 796, size: 95.186 } },
  { x: 111, y: 7, size: 131.823, shade: [-12, -50], share: { x: 138, y: 185, size: 162 } },
  { x: 18, y: 165, size: 86.452, shade: [40, -30], share: { x: 22, y: 374, size: 106 } },
];
/** 07's disc across its slot, in its authored pixels: its silhouette, 0.87 of its 96% of 432 (as the year comparison's circle). */
const DOT_SPAN = (0.96 * 432 * (1 + 0.74)) / 2;
/** The bubbles' colour drift, on 07's Offset (a second): 07's own pace (38 to 2 over its 7 s). */
const DOT_DRIFT = -36 / 7;
export const SUMMARY_VARIANT_CARDS = { a: 'summary-card-1', b: 'summary-card-2', c: 'summary-ground' };

function summaryBackdrop() {
  const { at, fade } = SUMMARY_CARD_IN;
  const inAt = { delay: SUMMARY_IN + at, fade: [0, fade, 1, 0], stillAt: 2 };
  const card = (k) => ({ selector: `.sc-card[data-card="${k}"]`, follow: true, box: true, radius: SUMMARY_CARD.radius });
  return {
    stack: {
      name: 'summary',
      layers: [
        // 10 and 11 are Wave, 9:16 frames: fitted across the card (a pt taller than it, cut).
        { document: 'summary-card-1', ...inAt, anchor: { ...card('a'), span: 576, edge: 0 } },
        { document: 'summary-card-2', ...inAt, anchor: { ...card('b'), span: 576, edge: 0 } },
        { document: 'summary-ground', ...inAt, anchor: { ...card('c'), span: SUMMARY_CARD.width, edge: 0 } },
        ...SUMMARY_BUBBLES.map((b, i) => ({
          document: 'summary-bubble',
          ...inAt,
          values: { mPhase: b.shade[0], mEvolution: b.shade[1] },
          rates: { mOffset: DOT_DRIFT },
          anchor: { selector: `.sc-card[data-card="c"] .sc-bubble[data-bubble="${i}"]`, span: DOT_SPAN, follow: true, box: true, within: { selector: '.sc-card[data-card="c"]', radius: SUMMARY_CARD.radius } },
        })),
      ],
    },
    replaces: [0, ARCHETYPE_OUT],
    sharp: true,
  };
}
export const SUMMARY_BACKDROP = summaryBackdrop();

/**
 * Play again (Figma "Repeate or close", node 1002-9098, moving as the P2's outro video does,
 * measured from it frame by frame; see docs/effects.md).
 *
 * Creative Lab's 12 (Wave: mirrored waves, rippled into rings), drawn as the video draws it: its
 * 800 × 800 canvas whole, as Creative Lab's runtime draws it, as tall as the screen and cut at
 * its sides (`fit: 'cover'`; the video's is that canvas at 812/800 on its 812 pt phone, to 0.3
 * levels at every moment). It loops every 10 s, as the video does (the video plays its loop in
 * 9.73 s: it skips a frame every 36, an artefact of its export). Under the copy, Figma's dark disc,
 * drawn by the page as the video draws it, feathered into the wave (playback.css).
 *
 * The video has no way in (it opens on the page settled), so the way in is designed, as total
 * minutes' is: the summary fades out (SUMMARY_OUT), its cards' backgrounds under the wave
 * (`replaces`), and as it does (OUTRO_IN) the wave fades in from the ground on the curve
 * the top 5's wave does, the copy, then Play again, coming in as total minutes' do (playback.css);
 * 12 reaches its own start, the video's first frame, as the page has come in (OUTRO_SETTLED). The
 * way out is Play again's (OUTRO_OUT, above); closing is the host's. Reduced Motion: a still, the
 * video's first frame.
 */
export const OUTRO_IN = OVERLAP_IN;
/** The page has come in, from OUTRO_IN: Play again's rise ends (playback.css `.ou-pill`). */
export const OUTRO_SETTLED = 1.643;
/** 12's loop (s): it starts this far before its end, so it is at its own start once the page has come in. */
const PLAY_AGAIN_LOOP = 10;
const OUTRO_FROM = PLAY_AGAIN_LOOP - OUTRO_SETTLED;
export const OUTRO_BACKDROP = {
  document: 'play-again',
  fit: 'cover',
  delay: OUTRO_IN,
  from: OUTRO_FROM,
  fade: [OUTRO_FROM, OUTRO_FROM + TOP_SHOWS_FADE_IN.duration, 1, 0, TOP_SHOWS_FADE_IN.ease],
  stillAt: PLAY_AGAIN_LOOP,
  replaces: [0, SUMMARY_OUT],
};

/**
 * Not enough listening (POC-1016): the story's last screen, Play again, with its own copy and
 * Close where Play again is. It is the first and only page, so it comes in as Play again does
 * once the summary has gone, from the moment it opens: no wait, nothing to replace.
 */
export const EMPTY_BACKDROP = { document: 'play-again', fit: 'cover', from: OUTRO_FROM, fade: OUTRO_BACKDROP.fade, stillAt: PLAY_AGAIN_LOOP };

/** Covers on the first card's grid (Figma's 3 × 3), and on the second card's stack (Figma's 4). */
export const SUMMARY_GRID = 9;
export const SUMMARY_STACK = 4;
/** The grid's covers, top shows first, row by row; fewer shows go round again to fill it. */
export function summaryCovers(ranking, n = SUMMARY_GRID) {
  return ranking.length ? Array.from({ length: n }, (_, i) => ranking[i % ranking.length]) : [];
}

function page(id, extra = {}) {
  return { id, kind: id, shareable: false, ownShare: false, quiz: null, steps: null, backdrop: null, pickBackdrop: null, revealBackdrop: null, leaves: 0, shows: 0, motion: MOTION[id] ?? null, data: {}, ...extra };
}

function topPodcastPage(stats) {
  const top = stats.topPodcast;
  const options = stats.ranking.slice(0, stats.rules.quizMaxOptions);
  const hasQuiz = options.length >= stats.rules.quizMinOptions;
  return page('top-podcast', {
    shareable: true,
    backdrop: TOP_GUESS_BACKDROP,
    pickBackdrop: TOP_PICK_BACKDROP,
    revealBackdrop: TOP_REVEAL_BACKDROP,
    data: { podcast: top },
    quiz: hasQuiz
      ? {
          answerId: top.uuid,
          options: seededShuffle(options, `${stats.year}:top-podcast:${top.uuid}`).map((p) => ({
            id: p.uuid,
            podcast: p,
          })),
        }
      : null,
  });
}

function bestMonthPage(stats) {
  const best = stats.bestMonth;
  const hasQuiz = stats.monthsWithData >= stats.rules.monthQuizMinMonths;
  const sizes = monthSizes(stats.months.map((m) => m.seconds));
  return page('best-month', {
    shareable: true,
    backdrop: TOP_MONTH_GUESS_BACKDROP,
    pickBackdrop: { options: Object.fromEntries(stats.months.map((m) => [String(m.month), topMonthPick(m.month)])) },
    revealBackdrop: topMonthReveal(sizes),
    data: { month: best.month, seconds: best.seconds, months: stats.months.map((m, i) => ({ ...m, size: sizes[i] })) },
    quiz: hasQuiz
      ? { answerId: String(best.month), options: stats.months.map((m) => ({ id: String(m.month), month: m.month })) }
      : null,
  });
}

/**
 * The intro: the one page that needs no data, so the story can open on it while the host
 * reads the user's listening history (PCIOS-1324, core/session.js).
 * @param {{reduceMotion?: boolean}} [options]
 */
export function introPage(options = {}) {
  return page('intro', { steps: options.reduceMotion ? INTRO_STILL : INTRO_STEPS });
}

/**
 * The story's length with every page in it (each optional page earned), which the progress
 * bar shows while the host's data is still to come: most stories are this long or one short.
 */
export const STORY_LENGTH = 12;

/**
 * @param {ReturnType<import('./stats.js').deriveStats>} stats
 * @param {{id: string, evidence: object}} archetype
 * @param {{reduceMotion?: boolean}} [options]
 */
export function buildPages(stats, archetype, options = {}) {
  if (!stats.eligible) {
    return [page('empty', { backdrop: EMPTY_BACKDROP })];
  }

  const pages = [];
  pages.push(introPage(options));
  pages.push(page('shows-and-episodes', { shareable: true, backdrop: options.reduceMotion ? SHOWS_STILL : SHOWS_BACKDROP, data: { shows: stats.showsCount, episodes: stats.episodesCount, podcasts: stats.ranking } }));
  pages.push(topPodcastPage(stats));
  pages.push(page('top-shows', { shareable: true, backdrop: options.reduceMotion ? TOP_SHOWS_STILL : TOP_SHOWS_BACKDROP, data: { podcasts: stats.top } }));
  if (stats.bestMonth) pages.push(bestMonthPage(stats));
  const afterTopShows = !stats.bestMonth;
  pages.push(page('total-minutes', {
    shareable: true,
    backdrop: minutesBackdrop(stats.totalMinutes, { afterTopShows }),
    data: { totalSeconds: stats.totalSeconds, minutes: stats.totalMinutes, after: afterTopShows ? 'top-shows' : 'best-month' },
  }));
  if (stats.comparison) {
    const circles = comparisonLayout(stats.comparison, stats.year);
    pages.push(page('year-comparison', { shareable: true, backdrop: comparisonBackdrop(circles), data: { ...stats.comparison, year: stats.year, circles } }));
  }
  if (stats.completion) pages.push(page('completion-rate', { shareable: true, backdrop: completionBackdrop(stats.completion.percent), shows: options.reduceMotion ? 0 : COMPLETION_SHOWN, data: stats.completion }));
  pages.push(page('roles-intro', { backdrop: ROLES_INTRO_BACKDROP }));
  pages.push(page('archetype', { shareable: true, backdrop: ARCHETYPE_BACKDROP, data: archetype }));
  pages.push(page('summary', {
    shareable: true,
    ownShare: true,
    backdrop: SUMMARY_BACKDROP,
    data: {
      year: stats.year,
      minutes: stats.totalMinutes,
      top: stats.top,
      grid: summaryCovers(stats.ranking, SUMMARY_GRID),
      stack: stats.ranking.slice(0, SUMMARY_STACK),
      archetype,
    },
  }));
  pages.push(page('outro', { backdrop: OUTRO_BACKDROP, leaves: OUTRO_OUT }));
  return pages;
}
