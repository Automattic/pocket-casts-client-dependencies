// Old web views (Android System WebView 80–104).
//
// The story is written for current engines. An Android phone that never updates its WebView
// (the Galaxy A10 in Test Lab has 81) lacks some of what it uses: Web Animations' promises and
// getAnimations() (84), replaceChildren() (86), single keyframes (84), @property (85), and in
// CSS :is(), inset, flex gap, aspect-ratio, individual transforms and container queries (84–105).
// On such an engine the story runs as "legacy": index.html loads legacy.css in place of
// playback.css (the same rules, rewritten by web/scripts/legacy-css.mjs), this module fills in
// the scripting and the layout legacy.css leaves to it, and the story shows with Reduced Motion
// and static backgrounds instead of the WebGL backdrop (ui/static-backdrop.js).
//
// Imported first (main.js), before anything that uses what it fills in. index.html decides
// (`data-legacy` on the root), before first paint; nothing here runs on an engine that has it
// all. Below Chromium 80 the module graph cannot even parse (`?.`): index.html sends `error`.

/** True when this engine lacks what the full story uses: index.html's check. */
export const LEGACY = typeof document !== 'undefined' && document.documentElement.hasAttribute('data-legacy');

/**
 * playback.css's @property rules, which Chromium 81 drops: the summary's swipe animates
 * `--sc-x`, so it has to be a length to move rather than jump. web/test/legacy.test.js checks
 * the list against playback.css.
 */
export const PROPERTIES = [
  ['--ar-in', '<length>', '0px'],
  ['--ar-out', '<length>', '0px'],
  ['--ar-lift', '<length>', '-200px'],
  ['--ar-shine', '<length>', '-200px'],
  ['--sc-x', '<length>', '0px'],
  ['--intro-hole', '<percentage>', '0%'],
];

if (LEGACY) {
  fillDom();
  fillAnimations();
  for (const [name, syntax, initialValue] of PROPERTIES) {
    try { CSS.registerProperty({ name, syntax, inherits: false, initialValue }); } catch { /* registered */ }
  }
  fillLayout();
}

/**
 * What legacy.css leaves to script, kept up as the story changes the page:
 *
 * - container query units: each container (`--legacy-container`) gets its content box as
 *   `--cqw` / `--cqh` (px per 1%), which legacy.css's rewritten cqw / cqh read;
 * - aspect-ratio on a box whose one side is a percentage (`--legacy-ratio`): the other side;
 * - flex `gap` (Chromium 84): as margins between the items (no flex container here wraps);
 * - `text-wrap: balance` (`--legacy-balance`, the headlines): the box narrowed as far as it
 *   goes without another line, each block of it on its own (a verdict's two lines).
 *
 * A ResizeObserver reports before the frame is painted, so nothing shows unsized.
 */
function fillLayout() {
  for (const name of ['--legacy-container', '--legacy-ratio', '--legacy-ratio-from', '--legacy-balance']) {
    try { CSS.registerProperty({ name, syntax: '*', inherits: false }); } catch { /* registered */ }
  }
  const sheet = [...document.styleSheets].find((s) => /legacy\.css$/.test(s.href || ''));
  const link = document.querySelector('link[href$="legacy.css"]');
  if (sheet) start(sheet);
  else link?.addEventListener('load', () => start(link.sheet), { once: true });

  function start(css) {
    const marked = { container: new Set(), ratio: new Set(), gap: new Set(), balance: new Set() };
    (function collect(rules) {
      for (const r of rules) {
        if (r.cssRules && !r.selectorText) { collect(r.cssRules); continue; }
        if (!r.selectorText || !r.style) continue;
        const sels = r.selectorText.split(/,\s*/).filter((s) => !s.includes('::'));
        if (r.style.getPropertyValue('--legacy-container')) sels.forEach((s) => marked.container.add(s));
        if (r.style.getPropertyValue('--legacy-ratio')) sels.forEach((s) => marked.ratio.add(s));
        if (/\d/.test(r.style.getPropertyValue('row-gap') + r.style.getPropertyValue('column-gap'))) sels.forEach((s) => marked.gap.add(s));
        if (r.style.getPropertyValue('--legacy-balance')) sels.forEach((s) => marked.balance.add(s));
      }
    })(css.cssRules);
    const selector = (set) => [...set].join(',') || ':not(*)';
    const containers = selector(marked.container), ratios = selector(marked.ratio), gaps = selector(marked.gap), balanced = selector(marked.balance);

    const sized = new WeakSet();
    const resize = new ResizeObserver((entries) => {
      for (const { target, contentRect } of entries) {
        const style = getComputedStyle(target);
        if (style.getPropertyValue('--legacy-container').trim()) {
          target.style.setProperty('--cqw', `${contentRect.width / 100}px`);
          target.style.setProperty('--cqh', `${contentRect.height / 100}px`);
          target.style.setProperty('--cqmin', `${Math.min(contentRect.width, contentRect.height) / 100}px`);
          target.style.setProperty('--cqmax', `${Math.max(contentRect.width, contentRect.height) / 100}px`);
        }
        const ratio = style.getPropertyValue('--legacy-ratio').trim();
        if (ratio) {
          const [w, h = 1] = ratio.split('/').map(Number);
          if (style.getPropertyValue('--legacy-ratio-from').trim() === 'width') target.style.height = `${(contentRect.width * h) / w}px`;
          else target.style.width = `${(contentRect.height * w) / h}px`;
        }
      }
    });

    function pass() {
      for (const el of document.querySelectorAll(`${containers},${ratios}`)) {
        if (sized.has(el)) continue;
        sized.add(el);
        resize.observe(el);
      }
      for (const el of document.querySelectorAll(gaps)) spaceItems(el);
      for (const el of document.querySelectorAll(balanced)) balanceLines(el);
    }

    pass();
    new MutationObserver((records) => {
      if (records.some((r) => r.type === 'childList' || r.type === 'characterData' || r.attributeName !== 'style')) pass();
    }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });
    // Lines break anew at another width, and once the type has loaded.
    const again = () => { balancedFor = new WeakMap(); pass(); };
    window.addEventListener('resize', again);
    document.fonts?.ready.then(again);
    document.fonts?.addEventListener?.('loadingdone', again);
  }
}

/** What each balanced box was balanced for (its text and its widest) and the width it took, so it is not measured again for nothing. */
let balancedFor = new WeakMap();

/**
 * Balanced lines (`text-wrap: balance`): the narrowest box the text takes without breaking
 * into more lines than it does at its widest, found by halving. A box of blocks (a verdict's
 * two lines) is balanced block by block, each centred in it.
 */
function balanceLines(el) {
  const blocks = [...el.children].filter((c) => getComputedStyle(c).display === 'block');
  const boxes = blocks.length ? blocks : [el];
  for (const box of boxes) {
    box.style.maxWidth = '';
    const widest = box.getBoundingClientRect().width;
    const key = `${box.textContent}|${widest}|${getComputedStyle(box).fontSize}`;
    const was = balancedFor.get(box);
    if (was?.key === key) { box.style.maxWidth = was.fit; continue; }
    const tall = box.offsetHeight;
    const lineHeight = parseFloat(getComputedStyle(box).lineHeight) || tall;
    let fit = '';
    if (widest > 0 && tall > lineHeight * 1.5) {
      let lo = widest / 2, hi = widest;
      while (hi - lo > 1) {
        const mid = (lo + hi) / 2;
        box.style.maxWidth = `${mid}px`;
        if (box.offsetHeight > tall) lo = mid;
        else hi = mid;
      }
      fit = `${Math.ceil(hi)}px`;
    }
    box.style.maxWidth = fit;
    if (box !== el && fit) Object.assign(box.style, { marginLeft: 'auto', marginRight: 'auto' });
    balancedFor.set(box, { key, fit });
  }
}

/** The margin each item was given for its container's gap (kept off the DOM: an attribute would wake the observer). */
const spaced = new WeakMap();

/** Flex `gap` as margins: before every item but the first, on the side the items run along. */
function spaceItems(el) {
  const style = getComputedStyle(el);
  const flex = style.display === 'flex' || style.display === 'inline-flex';
  const column = style.flexDirection.startsWith('column');
  const gap = flex ? parseFloat(column ? style.rowGap : style.columnGap) || 0 : 0;
  const side = column ? (style.flexDirection.endsWith('reverse') ? 'marginBottom' : 'marginTop') : (style.flexDirection.endsWith('reverse') ? 'webkitMarginEnd' : 'webkitMarginStart');
  let first = true;
  for (const item of el.children) {
    const was = spaced.get(item);
    if (was) {
      item.style[was] = '';
      spaced.delete(item);
    }
    if (!gap) continue;
    const s = getComputedStyle(item);
    if (s.display === 'none' || s.position === 'absolute' || s.position === 'fixed') continue;
    if (first) { first = false; continue; }
    item.style[side] = `${(parseFloat(s[side]) || 0) + gap}px`;
    spaced.set(item, side);
  }
}

function fillDom() {
  for (const proto of [Element.prototype, Document.prototype, DocumentFragment.prototype]) {
    if (!proto.replaceChildren) {
      proto.replaceChildren = function replaceChildren(...nodes) {
        while (this.lastChild) this.removeChild(this.lastChild);
        this.append(...nodes);
      };
    }
  }
}

/**
 * Web Animations as the story uses them: `finished`, `getAnimations()` (of Element.animate's
 * animations and the CSS animations running on an element) and single keyframes.
 */
function fillAnimations() {
  const proto = globalThis.Animation?.prototype;
  if (!proto) return;

  // `finished`: settles with the animation's `finish` or `cancel` event. A new promise once one
  // has settled and the animation plays again, as the spec's.
  if (!('finished' in proto)) {
    const promises = new WeakMap();
    Object.defineProperty(proto, 'finished', {
      configurable: true,
      get() {
        const held = promises.get(this);
        if (held && (!held.settled || this.playState === 'finished')) return held.promise;
        const entry = { settled: false };
        entry.promise = new Promise((resolve, reject) => {
          if (this.playState === 'finished') { entry.settled = true; resolve(this); return; }
          const finish = () => { entry.settled = true; off(); resolve(this); };
          const cancel = () => { entry.settled = true; off(); reject(new DOMException('The animation was cancelled', 'AbortError')); };
          const off = () => { this.removeEventListener('finish', finish); this.removeEventListener('cancel', cancel); };
          this.addEventListener('finish', finish);
          this.addEventListener('cancel', cancel);
        });
        promises.set(this, entry);
        return entry.promise;
      },
    });
  }

  if ('getAnimations' in Element.prototype) return;

  // Element.animate's animations, by element: what getAnimations() gives back of them.
  const scripted = new WeakMap();
  const animate = Element.prototype.animate;
  Element.prototype.animate = function (keyframes, options) {
    const a = animate.call(this, completeKeyframes(this, keyframes), options);
    let list = scripted.get(this);
    if (!list) scripted.set(this, (list = new Set()));
    list.add(a);
    a.addEventListener('cancel', () => list.delete(a));
    a.addEventListener('finish', () => {
      const fill = a.effect?.getTiming?.().fill;
      if (fill !== 'forwards' && fill !== 'both') list.delete(a);
    });
    return a;
  };

  // CSS animations: what an element's computed style runs, one stand-in per element and name.
  const css = new WeakMap();
  const started = new WeakMap();
  // When each began (`animationstart` comes once its delay has passed): untilSettledMs and the
  // fill ask how far along one is. Before it, one just applied (a page just rendered) counts from now.
  document.addEventListener('animationstart', (e) => {
    let names = started.get(e.target);
    if (!names) started.set(e.target, (names = new Map()));
    const stand = css.get(e.target)?.get(e.animationName);
    const delay = stand ? stand.delay : 0;
    names.set(e.animationName, performance.now() - e.elapsedTime * 1000 - Math.max(delay, 0));
    if (stand && stand.playState === 'finished') stand.restart();
  }, true);
  document.addEventListener('animationend', (e) => css.get(e.target)?.get(e.animationName)?.end(), true);

  function cssAnimations(el) {
    const style = getComputedStyle(el);
    const names = style.animationName;
    if (!names || names === 'none') return [];
    const list = names.split(/,\s*/);
    const at = (prop, i) => { const v = style[prop].split(/,\s*/); return v[i % v.length]; };
    let byName = css.get(el);
    if (!byName) css.set(el, (byName = new Map()));
    const out = [];
    list.forEach((name, i) => {
      if (name === 'none') return;
      const timing = {
        duration: seconds(at('animationDuration', i)) * 1000,
        delay: seconds(at('animationDelay', i)) * 1000,
        iterations: at('animationIterationCount', i) === 'infinite' ? Infinity : Number(at('animationIterationCount', i)),
        fill: at('animationFillMode', i),
        paused: at('animationPlayState', i) === 'paused',
      };
      let stand = byName.get(name);
      if (!stand) byName.set(name, (stand = cssAnimation(el, name, started)));
      stand.update(timing);
      if (stand.playState === 'finished' && timing.fill !== 'forwards' && timing.fill !== 'both') return;
      out.push(stand);
    });
    return out;
  }

  function animationsOf(el, subtree) {
    const els = subtree ? [el, ...el.querySelectorAll('*')] : [el];
    const out = [];
    for (const e of els) {
      for (const a of scripted.get(e) || []) if (a.playState !== 'idle') out.push(a);
      out.push(...cssAnimations(e));
    }
    return out;
  }

  Element.prototype.getAnimations = function (options) {
    return animationsOf(this, Boolean(options?.subtree));
  };
  Document.prototype.getAnimations = function () {
    return animationsOf(this.documentElement, true);
  };
}

/**
 * A CSS animation as getAnimations() gives it: its name, timing and `finished`. Read only: the
 * story cancels or finishes its own animations (Element.animate's), not its CSS ones, except to
 * show a page come back to as it was left (`settle`), which an old engine replays instead.
 */
function cssAnimation(el, name, started) {
  let timing = { duration: 0, delay: 0, iterations: 1, fill: 'none', paused: false };
  let firstSeen = performance.now();
  let ended = false;
  let settle = null;
  let promise = null;
  let timer = 0;
  const endTime = () => Math.max(0, timing.delay + timing.duration * timing.iterations);
  const begun = () => started.get(el)?.get(name) ?? firstSeen;
  const stand = {
    animationName: name,
    playbackRate: 1,
    get startTime() { return begun(); },
    set startTime(_) {},
    get currentTime() { return ended ? endTime() : performance.now() - begun(); },
    get playState() { return ended ? 'finished' : timing.paused ? 'paused' : 'running'; },
    effect: {
      getComputedTiming() {
        const end = endTime();
        const t = stand.currentTime;
        const active = timing.duration * timing.iterations;
        const progress = !Number.isFinite(end) ? null : t >= end ? 1 : t < timing.delay ? null : timing.duration ? ((t - timing.delay) % timing.duration) / timing.duration : 1;
        return { endTime: end, activeDuration: active, delay: timing.delay, duration: timing.duration, iterations: timing.iterations, progress, localTime: t };
      },
      getTiming() { return { ...timing }; },
    },
    get finished() {
      if (!promise) {
        promise = new Promise((resolve) => { settle = resolve; });
        if (ended) settle(stand);
        else arm();
      }
      return promise;
    },
    update(next) { timing = next; if (promise && !ended) arm(); },
    end() {
      if (ended) return;
      ended = true;
      clearTimeout(timer);
      settle?.(stand);
    },
    restart() {
      ended = false;
      promise = null;
      settle = null;
      firstSeen = performance.now();
    },
    cancel() {},
    finish() {},
    pause() {},
    play() {},
  };
  // `animationend` does not come for an animation taken off its element (a class changed, the
  // element removed): it counts as over once it would have ended.
  function arm() {
    clearTimeout(timer);
    const left = endTime() - stand.currentTime;
    if (Number.isFinite(left)) timer = setTimeout(() => stand.end(), Math.max(0, left) + 50);
  }
  return stand;
}

/** Keyframes as an old engine takes them: an implicit first or last one (Chromium 84) made explicit from the element's style now. */
function completeKeyframes(el, keyframes) {
  if (!Array.isArray(keyframes) || !keyframes.length) return keyframes;
  const first = keyframes[0], last = keyframes[keyframes.length - 1];
  const firstAt0 = keyframes.length > 1 && (first.offset == null || first.offset === 0);
  const lastAt1 = keyframes.length > 1 && (last.offset == null || last.offset === 1);
  if (firstAt0 && lastAt1) return keyframes;
  const props = new Set();
  for (const k of keyframes) for (const p of Object.keys(k)) if (!['offset', 'easing', 'composite'].includes(p)) props.add(p);
  const style = getComputedStyle(el);
  const now = {};
  for (const p of props) now[p] = p.startsWith('--') ? style.getPropertyValue(p).trim() : style[p];
  const out = keyframes.map((k) => ({ ...k }));
  if (!firstAt0) out.unshift({ ...now, offset: 0 });
  if (!lastAt1) out.push({ ...now, offset: 1 });
  return out;
}

function seconds(v) {
  const n = parseFloat(v);
  return /ms$/.test(v) ? n / 1000 : n;
}
