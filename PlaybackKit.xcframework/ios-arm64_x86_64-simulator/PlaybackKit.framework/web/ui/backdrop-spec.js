// What the backdrop shows and where, shared by the WebGL backdrop (ui/backdrop.js) and the
// static one an old web view shows instead (ui/static-backdrop.js).

/** A backdrop spec's entries: a stack's layers, or the one document. */
export const entriesOf = (spec) => spec?.stack?.layers ?? (spec ? [spec] : []);

/**
 * What the current page shows on the backdrop: its step's, or on a quiz page its reveal's
 * once the answer shows and its pick's once something is picked (with `options`, the pick's
 * own: the top month's picked bubble), or the page's own. `phase` names which.
 */
export function backdropNow(flow) {
  const page = flow.getPage();
  const step = flow.step();
  const revealed = !step && Boolean(page.revealBackdrop) && flow.isRevealed();
  const selected = flow.getState().answers[page.id]?.selectedId;
  const pickSpec = page.pickBackdrop?.options ? page.pickBackdrop.options[selected] : page.pickBackdrop;
  const picked = !step && !revealed && Boolean(pickSpec) && selected != null;
  const spec = step ? step.backdrop : revealed ? page.revealBackdrop : picked ? pickSpec : page.backdrop;
  const phase = step ? `step-${step.id}` : revealed ? 'reveal' : picked ? 'pick' : 'page';
  return { page, step, spec, revealed, picked, selected, phase };
}

/**
 * Where an anchor's box is, from `origin` (a box's top left, CSS pixels), and the scale it
 * asks for: `span` authored pixels across its width, and no more than `spanY` down its
 * height; the frame's centre on the box's, or `offset` authored pixels from it. A boxed
 * one's corners are rounded by `radius` CSS pixels, `edge` authored pixels are drawn past
 * its edge, and `within` clips it to another element's box (its corners rounded by its own
 * `radius`: a summary card's bubble, clipped to its card). Null while it is not laid out.
 */
export function anchorPlace(anchor, origin = { left: 0, top: 0 }) {
  const el = document.querySelector(anchor.selector);
  const r = el?.getBoundingClientRect();
  if (!r?.width) return null;
  const unit = Math.min(r.width / anchor.span, anchor.spanY > 0 ? r.height / anchor.spanY : Infinity);
  const [dx, dy] = Array.isArray(anchor.offset) ? anchor.offset.map((v) => (Number(v) || 0) * unit) : [0, 0];
  const w = anchor.within && document.querySelector(anchor.within.selector)?.getBoundingClientRect();
  if (anchor.within && !w?.width) return null;
  return {
    x: r.left + r.width / 2 - origin.left + dx,
    y: r.top + r.height / 2 - origin.top + dy,
    unit,
    box: Boolean(anchor.box),
    rotate: Number(anchor.rotate) || 0,
    ...(anchor.clip === false ? { clip: false, margin: anchor.margin } : {}),
    ...(anchor.radius > 0 ? { radius: anchor.radius } : {}),
    ...(Number.isFinite(anchor.edge) ? { edge: anchor.edge } : {}),
    ...(w ? { within: { x: w.left + w.width / 2 - origin.left, y: w.top + w.height / 2 - origin.top, w: w.width, h: w.height, radius: anchor.within.radius ?? 0 } } : {}),
  };
}

/**
 * The middle of the column the page lays itself out in, from `origin`'s left (CSS pixels): the
 * stage's box less its padding, which is the safe area's sides (none in the share image).
 * What the backdrop draws across the screen is centred on it. Null while it is not laid out.
 */
export function columnCentre(origin = { left: 0 }) {
  const stage = document.querySelector('.stage');
  const r = stage?.getBoundingClientRect();
  if (!r?.width) return null;
  const s = getComputedStyle(stage);
  return (r.left + parseFloat(s.paddingLeft) + r.right - parseFloat(s.paddingRight)) / 2 - origin.left;
}
