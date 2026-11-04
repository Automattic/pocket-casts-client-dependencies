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
// A page coming in is a one-off cost (the buffer remade, shaders compiled, the DOM built,
// its entrance animating): not a device that cannot keep up, and a step it caused would
// last the whole session. So a page's first moments are not judged.
const SETTLE_MS = 1500;
// Gaps over this are the page being hidden or the thread blocked, not a slow draw.
const MAX_GAP = 250;
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
    if (sorted.length < MIN_FRAMES) return;
    // The display's interval is the best window's mean gap. Not a low percentile: a page that
    // draws every other frame alternates short and long ones (12 and 21 ms on a 60 Hz phone),
    // and its 20th percentile reads as a display of 83 Hz, against which every frame is late.
    // The mean is the same for any such pattern, and a window that drops frames is longer.
    display = Math.max(4, Math.min(display, sorted.reduce((a, g) => a + g, 0) / sorted.length));
    const median = percentile(sorted, 0.5);
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
  return {
    samples: rung >= 1 ? Math.min(base.samples, 2) : base.samples,
    resolution: base.resolution * (rung >= 3 ? 0.5 : rung >= 1 ? 0.75 : 1),
    sharp: rung >= 3 ? Math.min(base.sharp, 1) : base.sharp,
    maxFps: rung >= 4 ? rate / Math.ceil(rate / 30) : rung >= 2 ? rate / 2 : 0,
  };
}
