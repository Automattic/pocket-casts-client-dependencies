// Tiny DOM builder. Text always goes in as text nodes, never as HTML: show titles and
// authors come from the outside world.

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'disabled' || k === 'hidden') el[k] = true;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

/**
 * The lines a heading takes past the design's (a translation longer than Figma's English),
 * as `--title-extra` on `page`, so what Figma places under it can move down with it.
 * Measured on every layout, before paint; nothing moves where the heading fits.
 */
export function followTitle(page, title, designLines = 2) {
  if (typeof ResizeObserver === 'undefined') return;
  const resized = new ResizeObserver(() => {
    if (!page.isConnected) return resized.disconnect();
    const line = parseFloat(getComputedStyle(title).lineHeight);
    if (!title.offsetHeight || !line) return;   // hidden (the answer), or not laid out yet
    page.style.setProperty('--title-extra', `${Math.max(0, Math.round(title.offsetHeight - designLines * line))}px`);
  });
  resized.observe(title);
}
