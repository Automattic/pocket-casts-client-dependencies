// A show's colours, for documents drawn in the cover's colours (fx/palette.js): the
// cover's pixels, read once per cover and kept.
//
// The pixels can only be read when the image is same-origin or served with CORS (the
// rigs' data: URLs and files are, and so is Pocket Casts' artwork CDN, the fixtures'; a
// remote artwork host has to send Access-Control-Allow-Origin). When they cannot be read,
// the ramp is null and the document keeps its own gradient. A show without artwork is
// drawn as its tile, so its colours are the tile's.

import { coverRamp, extractPaletteAsync, rgb2oklab, sampleSize } from '../fx/palette.js';
import { coverImage, tileColours } from './artwork.js';

const cache = new Map();
const ready = new Map();

/**
 * The ramp for a show's cover in a document's mood (`coverMood`: 0 vibrant, 1 muted,
 * 2 full), or null when its pixels cannot be read. Cached per artwork and mood.
 * @returns {Promise<Array<{position: number, color: string}>|null>}
 */
export function showRamp(podcast, mood = 2) {
  const key = keyOf(podcast, mood);
  if (!cache.has(key)) cache.set(key, clustersOf(podcast).then((c) => coverRamp(c, mood), () => null).then((r) => { ready.set(key, r); return r; }));
  return cache.get(key);
}

/** The ramp if it has been read already (null when it cannot be), else undefined. */
export const readyRamp = (podcast, mood = 2) => ready.get(keyOf(podcast, mood));

const keyOf = (podcast, mood) => `${podcast.artworkUrl || `tile:${podcast.uuid}`}|${mood}`;

async function clustersOf(podcast) {
  if (!podcast.artworkUrl) return tileClusters(podcast);
  // Only a CORS request leaves the canvas readable; a same-origin or data: URL needs none.
  const img = coverImage(podcast.artworkUrl);
  await img.decode();
  const [w, h] = sampleSize(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, h);
  // Spread over tasks: read as a page comes in, it costs the page no frames.
  return extractPaletteAsync(g.getImageData(0, 0, w, h).data, w, h);   // throws on a tainted canvas
}

/** A tile is its two colours, half and half. */
function tileClusters(podcast) {
  return tileColours(podcast).map((hex) => {
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const [L, a, b] = rgb2oklab(...rgb);
    return { rgb, w: 0.5, L, chroma: Math.hypot(a, b) };
  });
}
