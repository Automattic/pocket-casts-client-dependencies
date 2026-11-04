// The system's text size, Bold Text and Increase Contrast, as the host reports them.
//
// The pages are laid out in fixed positions from Figma's frame (no scrolling, no reflow), so
// they cannot follow Dynamic Type or Android's font size as far as the system lets people go:
// at the largest sizes titles run over each other and controls go off the screen. Text size is
// therefore supported inside a narrow range only: never smaller than the design (its sizes are
// already small), and no larger than the layout holds (TEXT_SCALE.max). Outside it the text
// stays at the nearest end of the range, whatever the system asks for.

/**
 * The text sizes supported, as multiples of the design's (1 = the default size). The layout was
 * measured on a 360 and a 393 px wide screen up to 1.3, where English still fits; 1.2 leaves room
 * for longer words. That is iOS's Extra Large (1.12) and, nearly, Extra Extra Large (1.24), and
 * Android's font scale 1.15; the larger sizes (to Accessibility 5, 3.1 on iOS, 2.0 on Android) and
 * the smaller ones get the end of this range.
 */
export const TEXT_SCALE = Object.freeze({ min: 1, max: 1.2 });

export const clampTextScale = (scale) => {
  const n = Number(scale);
  return Number.isFinite(n) ? Math.min(TEXT_SCALE.max, Math.max(TEXT_SCALE.min, n)) : 1;
};

/**
 * @param {Document} doc
 * @param {{textScale?: number, boldText?: boolean, increaseContrast?: boolean}} settings the host's
 *   values, unclamped: `textScale` is the system's text size over its default (iOS: the body
 *   style's scale at the current Dynamic Type size; Android: the font scale).
 * @returns {number} the text scale used (`--text-scale`)
 */
export function applyAccessibility(doc, { textScale = 1, boldText = false, increaseContrast = false } = {}) {
  const el = doc.documentElement;
  const k = clampTextScale(textScale);
  // Every font size and line height in playback.css is multiplied by it. (The web views' own text
  // scaling is not used: iOS's WKWebView has none, Chromium ignores percentages in text-size-adjust,
  // and Android's WebView `textZoom` is held at 100 by the library.)
  el.style.setProperty('--text-scale', String(k));
  el.toggleAttribute('data-bold-text', Boolean(boldText));
  el.toggleAttribute('data-increase-contrast', Boolean(increaseContrast));
  return k;
}
