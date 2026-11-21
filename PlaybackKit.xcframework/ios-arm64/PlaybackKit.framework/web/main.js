// Boot. Reads what the host injected before first paint, mounts, installs the API.
//
//   window.PLAYBACK_DATA   the payload (facts); absent with PLAYBACK_ENV.pending, when the
//                          host gives it later through Playback.setData (PCIOS-1324)
//   window.PLAYBACK_ENV    host settings: platform, locale, startAt, rules, answers,
//                          debug, backdrop, reduceMotion, pending
//
// With neither present (a plain browser) the query string stands in for the host:
//   ?scenario=typical   load fixtures/scenarios/typical.json from `fixturesBase`
//   &page=top-shows     open on a page        &debug=1       show the HUD
//   &autoplay=1500      a step every 1.5 s    &timeout=5000  auto-reveal timeout (ms)
//   &log=1              mirror bridge messages to the console
//   &locale=de          the page's language, over the scenario's (src/locales)
//   &backdrop=0         no WebGL backdrop      &reduceMotion=1 the intro as one still
//   &textScale=1.2      the system's text size (held to 1–1.2)   &boldText=1   &increaseContrast=1
//   &perf=15            performance walk: every page watched for 15 s, then a table of
//                       frame times (&loops=2 walks the flow twice, cold against hot)
//   &tune=samples=2,res=1,fps=30,sharp=0,backdrop=0,only=archetype|summary
//                       with the walk: change one lever and run again (see host/perf.js)
//   &delay=6000         the data comes late, as the apps' does (PCIOS-1324): the story opens
//                       on the intro and the scenario arrives this many ms later (setData)

// First: fills in what an old web view lacks before anything uses it.
import { LEGACY } from './host/legacy.js';
import { mountPlayback } from './ui/app.js';
import { connectBackdrop } from './ui/backdrop.js';
import { installApi } from './host/api.js';
import { applyAccessibility } from './host/accessibility.js';

/** On an old web view, the longest the story waits for its first stills before it shows. */
const STILLS_WAIT_MS = 2000;

function envFromQuery() {
  const q = new URLSearchParams(location.search);
  const env = { platform: 'web' };
  if (q.has('page')) env.startAt = q.get('page');
  if (q.has('debug')) env.debug = q.get('debug') !== '0';
  if (q.has('log')) env.log = q.get('log') !== '0';
  if (q.has('timeout')) env.rules = { revealTimeoutMs: Number(q.get('timeout')) };
  if (q.has('autoplay')) env.autoplay = Number(q.get('autoplay')) || 1500;
  if (q.has('guess')) env.guess = q.get('guess');
  if (q.has('locale')) env.locale = q.get('locale');
  if (q.has('backdrop')) env.backdrop = q.get('backdrop') !== '0';
  if (q.has('captureBackdrop')) env.captureBackdrop = q.get('captureBackdrop') !== '0';
  if (q.has('reduceMotion')) env.reduceMotion = q.get('reduceMotion') !== '0';
  if (q.has('textScale')) env.textScale = Number(q.get('textScale'));
  if (q.has('boldText')) env.boldText = q.get('boldText') !== '0';
  if (q.has('increaseContrast')) env.increaseContrast = q.get('increaseContrast') !== '0';
  if (q.has('perf') && q.get('perf') !== '0') env.perf = Number(q.get('perf')) || true;
  if (q.has('loops')) env.perfLoops = Number(q.get('loops'));
  if (q.has('tune')) env.perfTune = q.get('tune');
  if (q.has('delay')) {
    env.pending = true;
    env.dataDelay = Number(q.get('delay')) || 0;
  }
  return env;
}

async function loadPayload(env) {
  if (globalThis.PLAYBACK_DATA) return globalThis.PLAYBACK_DATA;
  const scenario = new URLSearchParams(location.search).get('scenario');
  if (!scenario) return null;
  const base = env.fixturesBase || '/fixtures/scenarios/';
  const res = await fetch(`${base}${encodeURIComponent(scenario)}.json`);
  if (!res.ok) throw new Error(`scenario "${scenario}" not found (${res.status})`);
  const json = await res.json();
  return json.payload ?? json;
}

async function boot() {
  const env = { ...envFromQuery(), ...(globalThis.PLAYBACK_ENV || {}) };
  // An old web view (host/legacy.js): the story holds still, on static backgrounds.
  if (LEGACY) env.reduceMotion = true;
  const root = document.getElementById('app');
  let payload = null;
  // The rig's late data (`&delay=`): the scenario is read now and handed over later, as an app would.
  const late = env.pending && env.dataDelay != null && !globalThis.PLAYBACK_DATA ? loadPayload(env) : null;
  try {
    if (!late) payload = await loadPayload(env);
  } catch (e) {
    env.loadError = String(e.message || e);
  }
  // The query's locale (the rig's language picker) wins over the scenario's; the host's
  // PLAYBACK_ENV.locale only fills in a payload that has none.
  const queryLocale = new URLSearchParams(location.search).get('locale');
  if (payload && (queryLocale || (env.locale && !payload.locale))) payload.locale = queryLocale || env.locale;
  // The performance walk's code, loaded only for a walk; and its tuning (what to change about
  // the backdrop before measuring).
  const perf = env.perf ? await import('./host/perf.js') : null;
  const tune = perf ? perf.parseTune(env.perfTune) : null;
  if (tune && env.backdrop !== false) env.backdrop = tune.backdrop;
  applyAccessibility(document, env);
  const controller = mountPlayback(root, { payload, env });
  if (controller.ok) {
    let canvas = document.getElementById('backdrop');
    let fx = { ok: false, destroy() {} };
    let failed = false;
    if (!LEGACY) fx = connectBackdrop(controller, canvas, env);
    else if (canvas && env.backdrop !== false) {
      // An old web view shows stills where the WebGL canvas would be (ui/static-backdrop.js),
      // loaded only there.
      const layer = Object.assign(document.createElement('div'), { id: 'backdrop', className: 'static-backdrop' });
      layer.setAttribute('aria-hidden', 'true');
      canvas.replaceWith(layer);
      canvas = layer;
      const stills = import('./ui/static-backdrop.js').then((m) => {
        if (failed) return null;
        fx = m.connectStaticBackdrop(controller, layer);
        return fx.ready;
      });
      // The story shows once its first stills are there (the intro's blob with its title, not a
      // beat after it), or after STILLS_WAIT_MS; the intro's clock waits as long.
      root.style.visibility = 'hidden';
      const shown = Promise.race([stills, new Promise((r) => setTimeout(r, STILLS_WAIT_MS))]).catch(() => {});
      shown.then(() => { root.style.visibility = ''; });
      controller.waitForIntro?.(shown);
    }
    // A late payload the page cannot read: the error state shows on the bare page.
    controller.onFail = () => { failed = true; fx.destroy(); canvas?.remove(); };
    installApi(controller, env, fx.ok ? fx.backdrop : null);
    late?.then((data) => setTimeout(() => globalThis.Playback.setData(data), env.dataDelay), (e) => setTimeout(() => globalThis.Playback.setData({ error: String(e.message || e) }), env.dataDelay));
    if (env.perf) {
      // The performance walk (PCIOS-1257) plays the flow itself; nothing else may.
      const progress = perf.showProgress();
      const walk = perf.startPerf(controller, {
        dwellMs: (env.perf === true ? 15 : env.perf) * 1000,
        loops: Math.max(1, env.perfLoops || 1),
        only: tune.only,
        tune: tune.label,
        backdropStats: () => globalThis.Playback.backdropStats(),
        onProgress: progress.update,
      });
      walk.done.then((report) => {
        progress.remove();
        perf.showReport(report);
        // The rig's host prints bridge messages, so a script can collect the run (`perf-report {json}`).
        controller.bridge.send({ type: 'warning', message: `perf-report ${JSON.stringify(report)}` });
      });
    } else if (env.autoplay) globalThis.Playback.autoplay({ intervalMs: env.autoplay, guess: env.guess });
  }
  document.documentElement.dataset.ready = '1';
}

boot();
