// Performance walk for the rig: plays the whole flow unattended, dwelling on every page,
// and measures what the device really delivers. Turn it on with `?perf=15` in a browser
// or `PLAYBACK_ENV.perf = 15` from a host (seconds a page, default 15). It is for
// PCIOS-1257: frame cost per page, per device, after a sustained run.
//
// What it records, per page (a quiz page twice: guessing, then revealed):
//   - the display's frame intervals (requestAnimationFrame): median, p95, p99, max, and
//     the share of frames that took 1.5 display intervals or more ("jank"; on a page with
//     no backdrop drawing, against that page's own pace, see `pageInterval`)
//   - the backdrop's own cadence: draws in the last second against the cadence it asks for
//     (30 for Pattern refraction, the display's for Wave and Thermal), its buffer size and
//     the time its last frame took to submit (`backdropStats()`)
// and for the run: the device (cores, memory, GPU renderer, pixel ratio), battery level at
// every page when the web view has `navigator.getBattery`, and with `loops` above 1 the
// same pages again, so the first pass (cold) can be set against the last (hot).
//
// The page's rAF interval is the honest number: a GPU that cannot keep up stretches it
// whatever cadence the backdrop asked for. Thermal state is not visible to a web view;
// the repeat pass stands in for it, and a host can note the device's own readout beside
// the page timestamps in the report.
//
// The analysis (`summarize`, `classify`, `buildReport`) is pure; `startPerf` is the
// driver, and `showReport` the on-screen table, with the JSON to copy.

const percentile = (sorted, q) => {
  if (!sorted.length) return null;
  const at = (sorted.length - 1) * q;
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo);
};
const round = (v, digits = 1) => (v == null ? null : +v.toFixed(digits));

/** Gaps longer than this are the page being hidden or the app suspended, not frames. */
export const GAP_MS = 1000;

/**
 * One page's frame intervals (ms) as numbers.
 * @param {number[]} intervals
 * @param {number} refreshMs  the display's interval, for counting dropped frames
 */
export function summarize(intervals, refreshMs) {
  const sorted = intervals.filter((d) => d < GAP_MS).sort((a, b) => a - b);
  const n = sorted.length;
  const seconds = sorted.reduce((s, d) => s + d, 0) / 1000;
  const late = refreshMs ? sorted.filter((d) => d >= refreshMs * 1.5).length : 0;
  return {
    frames: n,
    seconds: round(seconds),
    fps: seconds ? round(n / seconds) : null,
    medianMs: round(percentile(sorted, 0.5)),
    p95Ms: round(percentile(sorted, 0.95)),
    p99Ms: round(percentile(sorted, 0.99)),
    maxMs: round(sorted[n - 1]),
    jank: n ? round((late / n) * 100) : null,
    gaps: intervals.length - n,
  };
}

/**
 * The interval to count a page's dropped frames against. A page that draws no backdrop and
 * is still gives the system nothing to hold the display's rate for, and a phone drops from
 * 90 Hz to 60 on it (or sits between the two): steady 60 is not a third of its frames late,
 * and a 60 Hz frame is right on the 1.5 x 11.1 ms line, so it would be counted by rounding.
 * So such a page is held to the slowest rate of 60 Hz or more that a quarter of its own
 * frames sit on, if that is slower than the display's. Below 60 is never taken for a
 * rate: that is a page missing frames. A page the backdrop draws on is held to the display's.
 */
export function pageInterval(intervals, refreshMs, drawing) {
  if (!refreshMs || drawing) return refreshMs;
  const xs = intervals.filter((d) => d < GAP_MS);
  for (const hz of [60, 72, 90, 120, 144, 165]) {
    const ms = 1000 / hz;
    if (ms <= refreshMs * 1.05) break;
    if (xs.filter((d) => Math.abs(d - ms) <= ms * 0.1).length >= xs.length * 0.25) return ms;
  }
  return refreshMs;
}

const RATES = [165, 144, 120, 90, 72, 60, 50, 48, 30, 24];

/**
 * The display's refresh interval. The highest common rate that a quarter of all the frames
 * sit on (within 10%): a GPU that cannot keep up makes late frames and then catch-up frames
 * that are quicker than the display, so the quick end of the frames alone reads too fast
 * (a 60 Hz phone as 72). Failing that, the quick end.
 */
export function refreshInterval(all) {
  const xs = all.filter((d) => d < GAP_MS);
  if (!xs.length) return null;
  for (const hz of RATES) {
    const ms = 1000 / hz;
    const near = xs.filter((d) => Math.abs(d - ms) <= ms * 0.1).sort((a, b) => a - b);
    if (near.length >= xs.length * 0.25) return percentile(near, 0.5);
  }
  return percentile(xs.sort((a, b) => a - b), 0.1);
}

/**
 * ok / warn / bad for one page. The backdrop must draw as often as it asks (`drawn` of
 * `target` a second) and the display must not miss frames. Thresholds are a starting point
 * for reading the table, not a product rule.
 */
export function classify({ jank, drawn, target }) {
  const worst = [classifyFrames(jank), classifyDraws(drawn, target)];
  return worst.includes('bad') ? 'bad' : worst.includes('warn') ? 'warn' : 'ok';
}

/** The display's side alone: dropped frames. */
export function classifyFrames(jank) {
  return jank != null && jank > 20 ? 'bad' : jank != null && jank > 5 ? 'warn' : 'ok';
}

/** The backdrop's side alone: draws a second against the cadence it asks for. */
export function classifyDraws(drawn, target) {
  const ratio = drawn != null && target ? drawn / target : null;
  return ratio != null && ratio < 0.8 ? 'bad' : ratio != null && ratio < 0.95 ? 'warn' : 'ok';
}

/** Displays run at a handful of rates; the measured interval is a little off the true one. */
export const snapHz = (hz) => [24, 30, 48, 50, 60, 72, 90, 120, 144, 165].reduce((a, b) => (Math.abs(b - hz) < Math.abs(a - hz) ? b : a));

/** The cadence a backdrop stat asks for, in frames a second (0 follows the display). */
const targetOf = (b, displayHz) => (b == null || b.cadence == null ? null : b.cadence === 0 ? displayHz : b.cadence);

/**
 * The backdrop reading that stands for a page: stats are taken once a second, the first
 * seconds (the page arriving, shaders compiling) are left out, and of the rest the one
 * whose draws-to-target ratio is the median, so a step changing document mid-page does
 * not decide it.
 */
export function pickBackdrop(series, displayHz, skipMs = 2000) {
  const settled = series.filter((b) => b.atMs >= skipMs);
  const pool = (settled.length ? settled : series).filter((b) => targetOf(b, displayHz));
  if (!pool.length) return series[series.length - 1] ?? null;
  const ratio = (b) => b.fps / targetOf(b, displayHz);
  return [...pool].sort((a, b) => ratio(a) - ratio(b))[Math.floor((pool.length - 1) / 2)];
}

/**
 * Reads the walk's tuning: what to change about the backdrop before measuring, so the same
 * pages can be run again with one lever moved (PCIOS-1257, step 1: what does the time go on).
 * A comma-separated list (`?tune=samples=2,res=1,fps=30,sharp=0,only=archetype|summary`):
 *   samples=N   Pattern samples per axis (default 3)     res=N    buffer pixels per CSS pixel
 *   fps=N       cap the backdrop's draws a second        sharp=N  sharp pages' buffer pixels per CSS pixel
 *                                                         (default: the screen's, up to 1.25; 0 = as `res`)
 *   backdrop=0  no backdrop at all: the DOM alone        only=a|b measure these pages only
 *   ladder=1    leave the degrade ladder on (it is off in a walk, so a setting is held; the report's `rung` is where it got to)
 * Anything else is ignored. Returns the backdrop settings (`false` for none), the pages to
 * measure, and the text the report prints.
 * @param {string|null|undefined} text
 */
export function parseTune(text) {
  // The degrade ladder is off while measuring: a fixed setting is what is being timed.
  const out = { backdrop: { ladder: false }, only: null, label: 'defaults' };
  if (!text) return out;
  const parts = [];
  for (const raw of String(text).split(',')) {
    const [key, value = ''] = raw.split('=').map((x) => x.trim());
    const n = Number(value);
    if (key === 'samples' && n >= 1) out.backdrop.samples = n;
    else if ((key === 'res' || key === 'resolution') && n > 0) out.backdrop.resolution = n;
    else if (key === 'fps' && n >= 0 && value !== '') out.backdrop.fps = n;
    else if (key === 'sharp' && n >= 0 && value !== '') out.backdrop.sharp = n;
    else if (key === 'backdrop' && value === '0') out.backdrop = false;
    else if (key === 'ladder' && value === '1' && out.backdrop) delete out.backdrop.ladder;
    else if (key === 'only' && value) out.only = value.split('|').map((x) => x.trim()).filter(Boolean);
    else continue;
    parts.push(`${key}=${value}`);
  }
  out.label = parts.join(' ') || 'defaults';
  return out;
}

/** Whether a page (`summary:b` is part of `summary`) is one the walk was asked to measure. */
export function isWanted(label, only) {
  return !only || only.includes(label) || only.includes(String(label).split(':')[0]);
}

/**
 * Turns the walk's samples into the report.
 * @param {{label: string, pass: number, intervals: number[], backdropSeries?: object[], backdrop?: object|null, battery?: number|null, at: number}[]} samples
 * @param {object} device
 * @param {string} [tune]  what was changed about the backdrop (`parseTune(...).label`)
 */
export function buildReport(samples, device, tune = 'defaults') {
  const refreshMs = refreshInterval(samples.flatMap((s) => s.intervals));
  const displayHz = refreshMs ? snapHz(1000 / refreshMs) : null;
  const pages = samples.map((s) => {
    const b = s.backdropSeries ? pickBackdrop(s.backdropSeries, displayHz) : s.backdrop;
    // A cadence of 0 follows the display; null means nothing is drawing on this page.
    const target = targetOf(b, displayHz);
    const stats = summarize(s.intervals, pageInterval(s.intervals, refreshMs, target != null));
    const row = {
      page: s.label,
      pass: s.pass,
      at: round(s.at, 0),
      ...stats,
      drawn: b?.fps ?? null,
      target,
      buffer: b ? `${b.width}×${b.height}` : null,
      samples: b?.samples ?? null,
      submitMs: b?.cpuMs ?? null,
      rung: b?.rung ?? null,
      battery: s.battery ?? null,
    };
    row.status = classify(row);
    row.frameStatus = classifyFrames(row.jank);
    row.drawStatus = classifyDraws(row.drawn, row.target);
    return row;
  });
  const passes = [...new Set(pages.map((p) => p.pass))];
  // Cold against hot: the same page's p95 on the first pass and on the last.
  const repeat = passes.length > 1
    ? pages.filter((p) => p.pass === passes[0]).map((first) => {
        const last = pages.find((p) => p.pass === passes[passes.length - 1] && p.page === first.page);
        return last ? { page: first.page, firstP95: first.p95Ms, lastP95: last.p95Ms, firstFps: first.fps, lastFps: last.fps } : null;
      }).filter(Boolean)
    : [];
  const totalSeconds = pages.reduce((s, p) => s + p.seconds, 0);
  return {
    device: { ...device, displayHz },
    tune,
    totalSeconds: round(totalSeconds, 0),
    worst: [...pages].filter((p) => p.frames > 30).sort((a, b) => (b.p95Ms ?? 0) - (a.p95Ms ?? 0)).slice(0, 3).map((p) => p.page),
    pages,
    repeat,
  };
}

/** What the device is, as far as a web view will say. */
export function describeDevice(win = globalThis) {
  const nav = win.navigator || {};
  let renderer = null;
  try {
    const gl = win.document.createElement('canvas').getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER) ?? null;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { /* leave it unknown */ }
  return {
    userAgent: nav.userAgent ?? null,
    cores: nav.hardwareConcurrency ?? null,
    memoryGB: nav.deviceMemory ?? null,
    pixelRatio: win.devicePixelRatio ?? null,
    screen: win.innerWidth ? `${win.innerWidth}×${win.innerHeight}` : null,
    gpu: renderer,
    reduceMotion: win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? null,
  };
}

/**
 * Plays the flow and measures it.
 *
 * @param {object} controller  from mountPlayback
 * @param {object} [options]
 * @param {number} [options.dwellMs=15000]  how long a page (or a quiz's half) is watched
 * @param {number} [options.loops=1]        passes through the whole flow
 * @param {string[]|null} [options.only]    measure these pages only (the rest are passed through quickly)
 * @param {string} [options.tune]           the report's note on what was changed
 * @param {() => object|null} [options.backdropStats]
 * @param {(line: object) => void} [options.onProgress]  {label, pass, elapsedMs, dwellMs}
 * @param {(report: object) => void} [options.onDone]
 */
export function startPerf(controller, { dwellMs = 15000, loops = 1, only = null, tune = 'defaults', backdropStats = () => null, onProgress, onDone } = {}) {
  const { flow, dispatch } = controller;
  const win = globalThis;
  const samples = [];
  let stopped = false;
  let current = null; // {label, pass, intervals, at}
  let last = null;
  let raf = 0;
  let ladderLog = null;
  let battery = null;
  const t0 = performance.now();

  win.navigator?.getBattery?.().then((b) => { battery = b; }).catch(() => {});

  const tick = (now) => {
    if (stopped) return;
    if (last != null && current) current.intervals.push(now - last);
    last = now;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  // A hidden page runs no frames; the next interval is a gap and is not counted.
  const onVisibility = () => { last = null; };
  document.addEventListener('visibilitychange', onVisibility);

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (test, timeoutMs = 20000) => {
    const end = performance.now() + timeoutMs;
    while (!stopped && !test() && performance.now() < end) await sleep(100);
  };

  /** Watches the current state of the page for the dwell, then files its sample. */
  async function watch(label, pass) {
    // A page that is not being measured is passed through: long enough to let it settle.
    if (!isWanted(label, only)) { await sleep(800); return; }
    current = { label, pass, intervals: [], at: (performance.now() - t0) / 1000 };
    last = null;
    const start = performance.now();
    const series = [];
    let nextStat = 0;
    while (!stopped && performance.now() - start < dwellMs) {
      const elapsedMs = performance.now() - start;
      onProgress?.({ label, pass, elapsedMs, dwellMs });
      // The backdrop's own count is draws in the last second, so one reading a second.
      if (elapsedMs >= nextStat) {
        nextStat += 1000;
        const b = backdropStats();
        if (b) { series.push({ ...b, atMs: elapsedMs }); if (b.ladder) ladderLog = b.ladder; }
      }
      await sleep(250);
    }
    const sample = { ...current, backdropSeries: series, battery: battery ? Math.round(battery.level * 100) : null };
    samples.push(sample);
    current = null;
  }

  async function pass(n) {
    for (let guard = 0; guard < 60 && !stopped; guard++) {
      const page = flow.getPage();
      const id = page.id;
      // The intro's timed steps are watched to its title, then a moment longer.
      await watch(id, n);
      if (!flow.stepsDone()) await until(() => flow.stepsDone());
      // Watched longer than it lasts, the intro has moved on by itself.
      if (flow.getPage().id !== id) continue;
      if (page.quiz && !flow.answers()[id]?.revealed) {
        const options = page.quiz.options;
        dispatch({ type: 'select', optionId: (options.find((o) => o.id !== page.quiz.answerId) ?? options[0]).id });
        await sleep(300);
        dispatch({ type: 'confirm' });
        await until(() => flow.answers()[id]?.revealed);
        await watch(`${id}:revealed`, n);
      }
      if (page.kind === 'summary') {
        for (const variant of ['b', 'c']) {
          dispatch({ type: 'setVariant', variant });
          await sleep(600);
          await watch(`${id}:${variant}`, n);
        }
      }
      if (page.kind === 'outro' || page.kind === 'empty') return;
      dispatch({ type: 'next' });
      await until(() => flow.getPage().id !== id);
    }
  }

  const finish = () => {
    stopped = true;
    cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', onVisibility);
  };

  const done = (async () => {
    for (let n = 1; n <= loops && !stopped; n++) {
      await pass(n);
      if (n < loops) {
        const first = flow.pages[0].id;
        dispatch({ type: 'restart' });
        await until(() => flow.getPage().id === first, 30000);
      }
    }
    const report = buildReport(samples, describeDevice(), tune);
    // What the degrade ladder saw at each step, when it ran.
    if (ladderLog) report.ladder = ladderLog;
    finish();
    globalThis.__playbackPerf = report;
    onDone?.(report);
    return report;
  })();

  return { done, stop: finish, samples };
}

/** The report on screen: a table to read on the device, and its JSON to copy. */
export function showReport(report, root = document.body) {
  const el = document.createElement('div');
  el.className = 'perf-report';
  const css = document.createElement('style');
  css.textContent = `
    .perf-report { position: fixed; inset: 0; z-index: 99999; overflow: auto; background: #0c0f14; color: #e8ebf0;
      font: 11px/1.45 ui-monospace, Menlo, monospace; padding: max(12px, env(safe-area-inset-top)) 12px 24px; -webkit-overflow-scrolling: touch; }
    .perf-report h1 { font: 700 15px system-ui, sans-serif; margin: 0 0 4px; }
    .perf-report p { margin: 2px 0; color: #9aa5b5; }
    .perf-report table { border-collapse: collapse; margin: 10px 0; min-width: 100%; }
    .perf-report th, .perf-report td { padding: 3px 6px; text-align: right; white-space: nowrap; border-bottom: 1px solid #232a35; }
    .perf-report th:first-child, .perf-report td:first-child { text-align: left; position: sticky; left: 0; background: #0c0f14; }
    .perf-report .ok { color: #5ec98f; } .perf-report .warn { color: #e5b04f; } .perf-report .bad { color: #f08a82; font-weight: 700; }
    .perf-report .wrap { overflow-x: auto; }
    .perf-report button { font: 600 13px system-ui, sans-serif; padding: 8px 14px; margin-right: 8px; border-radius: 6px; border: 1px solid #3a4452; background: #1a212b; color: inherit; }
  `;
  const d = report.device;
  const head = (text) => Object.assign(document.createElement('p'), { textContent: text });
  const title = Object.assign(document.createElement('h1'), { textContent: `Playback performance: ${report.totalSeconds} s measured` });
  el.append(css, title,
    head(`${d.displayHz ?? '?'} Hz · ${d.screen ?? '?'} @${d.pixelRatio ?? '?'}× · ${d.cores ?? '?'} cores${d.memoryGB ? ` · ≥${d.memoryGB} GB` : ''}`),
    head(`GPU: ${d.gpu ?? 'unknown'}`),
    head(`Backdrop: ${report.tune ?? 'defaults'}`),
    head(`Slowest p95: ${report.worst.join(', ') || 'n/a'}`));

  const table = (columns, rows) => {
    const t = document.createElement('table');
    const thead = t.createTHead().insertRow();
    for (const [name] of columns) thead.appendChild(Object.assign(document.createElement('th'), { textContent: name }));
    const body = t.createTBody();
    for (const row of rows) {
      const tr = body.insertRow();
      for (const [, get, cls] of columns) {
        const td = tr.insertCell();
        td.textContent = get(row) ?? '–';
        if (cls) td.className = cls(row) ?? '';
      }
    }
    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    wrap.appendChild(t);
    return wrap;
  };
  el.append(table([
    ['page', (r) => (report.pages.some((p) => p.pass > 1) ? `${r.page} #${r.pass}` : r.page)],
    ['fps', (r) => r.fps],
    ['p95 ms', (r) => r.p95Ms, (r) => r.frameStatus],
    ['jank %', (r) => r.jank, (r) => r.frameStatus],
    ['drawn/s', (r) => (r.drawn == null ? null : `${r.drawn}/${r.target ?? '?'}`), (r) => r.drawStatus],
    ['max', (r) => r.maxMs],
    ['med', (r) => r.medianMs],
    ['buffer', (r) => r.buffer],
    ['spl', (r) => r.samples],
    ['submit ms', (r) => r.submitMs],
    ['batt %', (r) => r.battery],
  ], report.pages));
  if (report.repeat.length) {
    el.append(head('Cold (first pass) against hot (last pass), p95 ms and fps'));
    el.append(table([
      ['page', (r) => r.page],
      ['p95 first', (r) => r.firstP95],
      ['p95 last', (r) => r.lastP95, (r) => (r.lastP95 > r.firstP95 * 1.25 ? 'bad' : null)],
      ['fps first', (r) => r.firstFps],
      ['fps last', (r) => r.lastFps],
    ], report.repeat));
  }
  const json = JSON.stringify(report, null, 2);
  const copy = Object.assign(document.createElement('button'), { textContent: 'Copy JSON' });
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(json); copy.textContent = 'Copied'; } catch { copy.textContent = 'Copy failed; see window.__playbackPerf'; }
  };
  const close = Object.assign(document.createElement('button'), { textContent: 'Close' });
  close.onclick = () => el.remove();
  copy.style.marginTop = close.style.marginTop = '8px';
  el.append(copy, close);
  root.appendChild(el);
  return el;
}

/** A one-line pill while the walk runs, so whoever holds the device knows to leave it alone. */
export function showProgress(root = document.body) {
  const pill = document.createElement('div');
  pill.setAttribute('data-testid', 'perf-progress');
  pill.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:max(6px,env(safe-area-inset-top));z-index:99998;'
    + 'padding:3px 10px;border-radius:99px;background:rgba(0,0,0,.72);color:#fff;font:600 11px ui-monospace,Menlo,monospace;pointer-events:none;white-space:nowrap';
  root.appendChild(pill);
  return {
    update: ({ label, pass, elapsedMs, dwellMs }) => { pill.textContent = `perf ${label}${pass > 1 ? ` #${pass}` : ''} ${Math.round(elapsedMs / 1000)}/${Math.round(dwellMs / 1000)} s`; },
    remove: () => pill.remove(),
  };
}
