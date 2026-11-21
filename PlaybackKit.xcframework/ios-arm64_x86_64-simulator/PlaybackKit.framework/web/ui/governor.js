// The degrade ladder's judge (PCIOS-1257): watches how the page's frames arrive and says
// when the backdrop is costing more than the device has, so it can be drawn cheaper.
//
// Fed the timestamps of requestAnimationFrame callbacks, a second at a time it asks of
// the frames that arrived: did a tenth of them come late (a gap of 1.5 display intervals
// or more), or is the median gap more than 21 ms (under about 48 fps, which is what a GPU
// that cannot keep up locks to, whatever the display)? A window that does is slow; two in
// a row step down one rung; one in which nearly half are late, or the median is past
// 30 ms, steps down at once. A step is followed by two windows of grace, for the buffer to
// be remade and the frames to settle. It never steps back up: a session is short, and
// going back and forth is worse to look at than a steady lower quality.
//
// A step has to help. Two windows after its grace, if the late share has not come down by
// a quarter (nor the median by a tenth), what was slow was not the backdrop (a page whose
// own animation drops frames does it with the backdrop off), so the step is taken back and
// that page, by the `key` it is fed with, is not stepped on again.
//
// The display's interval is the shortest window's mean gap seen: a device already locked to
// half the display rate cannot be told from a slow display by that alone, which is what
// the median is for. A window whose frames all come at one pace and quicker than that
// (a display that dropped to a lower rate when the page went still) is not slow.

export const WINDOW_MS = 1000;
const LATE = 1.5;
const SLOW_SHARE = 0.1;
const SEVERE_SHARE = 0.45;
const SLOW_MEDIAN = 21;
// A window is steady when its 80th percentile gap is within this of its 20th.
const STEADY = 1.2;
const SEVERE_MEDIAN = 30;
const GRACE = 2;
const MIN_FRAMES = 8;
// A window with fewer frames than MIN_FRAMES is judged only when they are this many or more
// and slow: a GPU far behind (Play again at 4 a second on a budget phone) leaves a window
// too few frames to judge as shares, and every one of them late. Fewer is not enough to say.
const SPARSE_FRAMES = 3;
// A page coming in is a one-off cost (the buffer remade, shaders compiled, the DOM built,
// its entrance animating): not a device that cannot keep up, and a step it caused would
// last the whole session. So a page's first moments are not judged.
const SETTLE_MS = 1500;
// Gaps over this are the page being hidden or the thread blocked, not a slow draw. A budget
// phone's GPU can take a quarter of a second over a frame (Play again's, 4 a second): that is.
const MAX_GAP = 500;
// A step has helped if the late share fell by this much, or the median did.
const HELPED_LATE = 0.75;
const HELPED_MEDIAN = 0.9;
const RATES = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165];

/** A measured rate as the common one it is near (within 8%), else as measured. */
export function snapRate(hz) {
  const near = RATES.find((r) => Math.abs(hz - r) / r <= 0.08);
  return near ?? hz;
}

const percentile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];

/**
 * @param {object} options
 * @param {() => void} options.onSlow  called when a rung should be stepped down
 * @param {() => void} [options.onRevert]  called when the last step did not help and is taken back
 * @param {number} [options.maxRung=Infinity]  stop asking once this many steps have been taken
 */
export function createGovernor({ onSlow, onRevert = () => {}, maxRung = Infinity }) {
  let last = 0;
  let windowStart = 0;
  let gaps = [];
  let display = Infinity;
  let slowRun = 0;
  let grace = 0;
  let steps = 0;
  let key = null;
  let settleUntil = 0;
  const futile = new Set();
  // What each step and each taking-back saw, for reading a report: the window's late share
  // and median, the display interval it was judged against, and the page.
  const events = [];
  // The last step, until it is known whether it helped: where it was taken, what the
  // window looked like then, and the windows still to wait.
  let trial = null;

  function judge() {
    const sorted = gaps.slice().sort((a, b) => a - b);
    gaps = [];
    const median = sorted.length ? percentile(sorted, 0.5) : 0;
    // Too few frames to judge, unless they are few because each is slow (SPARSE_FRAMES).
    const sparse = sorted.length < MIN_FRAMES;
    if (sparse && (sorted.length < SPARSE_FRAMES || median <= SEVERE_MEDIAN)) return;
    // The display's interval is the best window's mean gap. Not a low percentile: a page that
    // draws every other frame alternates short and long ones (12 and 21 ms on a 60 Hz phone),
    // and its 20th percentile reads as a display of 83 Hz, against which every frame is late.
    // The mean is the same for any such pattern, and a window that drops frames is longer.
    // (A sparse window's say nothing of the display.)
    if (!sparse) display = Math.max(4, Math.min(display, sorted.reduce((a, g) => a + g, 0) / sorted.length));
    const late = sorted.filter((g) => g >= display * LATE).length / sorted.length;
    // Frames that all arrive at one pace are a display running at that rate, not frames
    // missed: a still page lets a phone drop from 90 Hz to 60, and 60 steady is smooth. What
    // the median test is for is a pace too slow to look smooth, steady or not.
    const steady = sorted[Math.floor(sorted.length * 0.8)] <= sorted[Math.floor(sorted.length * 0.2)] * STEADY && median <= SLOW_MEDIAN;
    const severe = !steady && (late >= SEVERE_SHARE || median > SEVERE_MEDIAN);
    const slow = !steady && (severe || late >= SLOW_SHARE || median > SLOW_MEDIAN);
    if (grace > 0) { grace -= 1; return; }
    if (trial) {
      // Judged on the page it was taken on; on another, the numbers are not comparable.
      const t = trial;
      trial = null;
      if (t.key === key && slow && late > t.late * HELPED_LATE && median > t.median * HELPED_MEDIAN) {
        futile.add(key);
        steps -= 1;
        slowRun = 0;
        events.push({ what: 'revert', key, late: +late.toFixed(2), median: +median.toFixed(1), display: +display.toFixed(1) });
        onRevert();
        return;
      }
    }
    if (steps >= maxRung || futile.has(key)) { slowRun = 0; return; }
    slowRun = slow ? slowRun + 1 : 0;
    if (severe || slowRun >= 2) {
      steps += 1;
      slowRun = 0;
      grace = GRACE;
      trial = { key, late, median };
      events.push({ what: severe ? 'severe' : 'slow', key, late: +late.toFixed(2), median: +median.toFixed(1), display: +display.toFixed(1), p80: +percentile(sorted, 0.8).toFixed(1) });
      if (events.length > 24) events.shift();
      onSlow();
    }
  }

  return {
    /** A frame arrived at `now` (ms, the rAF timestamp), while `where` (a page) showed. */
    feed(now, where = null) {
      if (where !== key) {
        // A new page: its first moments are left out, and a slow run does not carry over to it.
        key = where;
        settleUntil = now + SETTLE_MS;
        gaps = [];
        slowRun = 0;
        windowStart = now;
      }
      if (now < settleUntil) { last = now; return; }
      if (last) {
        const gap = now - last;
        if (gap > 0 && gap < MAX_GAP) gaps.push(gap);
      }
      last = now;
      if (!windowStart) windowStart = now;
      if (now - windowStart >= WINDOW_MS) {
        windowStart = now;
        judge();
      }
    },
    /** The steps and take-backs so far, with what the window looked like. */
    get events() { return events; },
    /** Steps taken so far. */
    get steps() { return steps; },
    /** The display's interval as far as it has been seen (ms), or null. */
    get displayInterval() { return Number.isFinite(display) ? display : null; },
    /** The display's rate (frames a second), as one of the common rates where it is near one; null if not seen. */
    get displayRate() { return Number.isFinite(display) ? snapRate(1000 / display) : null; },
  };
}

/**
 * GPUs that cannot keep up with the defaults, by the name the context gives, and the rung
 * each starts on, so that their first pages are not the ladder's to find out (it takes a
 * couple of seconds a page to step, and the intro is the first thing seen). From the device
 * lab (2026-11-20; docs/effects.md, Performance): the moto g play 2024's Adreno 610, the
 * Galaxy A06's Mali-G52 MC2, the Galaxy A15's Mali-G57 MC2, and the smaller GPUs of their
 * families. Any other GPU, Apple's among them, starts at the defaults, and has the ladder.
 */
const BUDGET_GPUS = [
  // Snapdragon 4 and 6 series: Adreno 505 to 512, 605 to 613.
  [/\bAdreno \(TM\) (?:50[5-9]|51[0-2]|60\d|61[0-3])\b/, 1],
  // Mali's smallest: G31, G51, G52, and G57 in two or three cores (MediaTek's Helio G and Dimensity 6000s).
  [/\bMali-(?:G31|G51|G52|G57(?! MC(?:[4-9]|\d\d)))(?!\d)/, 1],
  // MediaTek's Helio A, P and G35/G37.
  [/\bPowerVR Rogue GE8\d{3}\b/, 1],
];

/** The rung a device starts on, from its GPU's name (see BUDGET_GPUS): 0 for any not listed. */
export function deviceRung(gpu) {
  const name = String(gpu || '');
  return BUDGET_GPUS.find(([re]) => re.test(name))?.[1] ?? 0;
}

/**
 * The ladder, rung by rung (rung 0 is the defaults): what each step takes away, cheapest
 * to see first. `quality(rung, hz, base)` is what the backdrop is drawn with at that rung,
 * from the settings it started with (`base`: samples, the soft pages' resolution, the
 * sharp pages' density) and the display's rate `hz`. Measured on a Pixel 7 (90 Hz): Wave's
 * cost follows its pixels, not its samples (the outro: 3 samples, 55 fps; 2, 56; 0.75 of the
 * pixels, 83; half of them, 90), so resolution comes with the first rung, not after it.
 *
 *   1  supersampling 3 → 2 per axis, soft pages at 0.75 of a buffer pixel a point
 *   2  half the display's rate for what follows it (30 at 60 Hz, 45 at 90, 60 at 120)
 *   3  soft pages at half a buffer pixel a point, sharp pages at one
 *   4  30 frames a second at most
 */
export const LAST_RUNG = 4;

export function quality(rung, hz, base) {
  const rate = hz > 0 ? hz : 60;
  // A cap on a count the effect sets itself (0: none, its own).
  const cap = (own, most) => (own > 0 ? Math.min(own, most) : most);
  return {
    samples: rung >= 1 ? Math.min(base.samples, 2) : base.samples,
    resolution: base.resolution * (rung >= 3 ? 0.5 : rung >= 1 ? 0.75 : 1),
    sharp: rung >= 3 ? Math.min(base.sharp, 1) : base.sharp,
    maxFps: rung >= 4 ? rate / Math.ceil(rate / 30) : rung >= 2 ? rate / 2 : 0,
    walls: rung >= 3 ? cap(base.walls, 4) : rung >= 1 ? cap(base.walls, 8) : base.walls || 0,
    ripple: rung >= 3 ? cap(base.ripple, 3) : rung >= 1 ? cap(base.ripple, 4) : base.ripple || 0,
  };
}
