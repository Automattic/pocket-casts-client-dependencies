// The reference frame: the rectangle a document's content was authored on.
//
// Every percentage in a document is a percentage of this frame (refWidth × refHeight)
// and every size is a percentage of its short edge, never of the render buffer. The
// app's canvas is a viewport onto it: the frame is scaled to fit the canvas whole and
// centred, and whatever the canvas has beyond it shows more of the field at the same
// scale. Nothing authored is ever cropped, whatever the device's aspect ratio.
//
// Lengths the tool states in pixels (pattern period, blur radius, noise cell) are
// pixels of the frame as authored, so they scale with `unit`, the buffer pixels per
// authored pixel. That is what keeps the picture the same at any render resolution.
//
// Coordinates are canvas pixels with the origin at the top left, y down.
//
// `authoredWidth` renders a document exactly as it was exported instead: the frame at
// its authored pixel size inside the authored canvas (cropped if the canvas was
// smaller), scaled only by the render resolution. The rig compares against
// Creative Lab's runtime this way.
//
// `canvas` ([width, height], the document's authored canvas) fits that whole instead of
// the frame: what Creative Lab's preview showed. For documents whose content outgrows
// the frame it was authored on (the canvas was widened afterwards to see it), when the
// design shows all of it.
//
// `zoom` scales the fitted frame about the canvas centre: for a design that shows a
// document smaller (or larger) than either fit.
//
// `placeFrame` puts the frame's centre at a point instead, at a given scale: for a
// document drawn behind something on the page (the cover the shape sits behind), which
// follows the page's layout rather than the screen's.

export function fitFrame(width, height, refWidth, refHeight, authoredWidth = 0, canvas = null, zoom = 1) {
  const unit = (authoredWidth > 0 ? width / authoredWidth
    : canvas ? Math.min(width / canvas[0], height / canvas[1])
    : Math.min(width / refWidth, height / refHeight)) * zoom;
  return placeFrame(width, height, refWidth, refHeight, width / 2, height / 2, unit);
}

/** The frame centred on (cx, cy), `unit` buffer pixels per authored pixel. */
export function placeFrame(width, height, refWidth, refHeight, cx, cy, unit) {
  const w = refWidth * unit, h = refHeight * unit;
  const ox = cx - w / 2, oy = cy - h / 2;
  return {
    width, height, unit, w, h, ox, oy,
    /** The sizing base: the frame's short edge, in buffer pixels. */
    S: Math.min(w, h),
    x: (p) => ox + w * (p / 100),
    y: (p) => oy + h * (p / 100),
  };
}
